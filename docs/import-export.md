---
tags: [be-my-hand, docs, import, export]
---

# Import and export

Import and export run entirely on the device with [SheetJS](https://sheetjs.com) (`xlsx` 0.20, Apache-2.0) and `expo-print`. No Cloud Functions, no Cloud Storage. Files never leave the device except through the system share sheet.

| | Import | Export |
|---|---|---|
| Permission | `beneficiaries_import` (plus `areas_manage` to create missing cities/areas) | `beneficiaries_export` |
| Connection | **Online only** (exact duplicate detection needs a server read) | **Works offline** (reads the local cache; the screen says when data came from cache) |
| Screen | `src/app/(app)/import.tsx` | `src/app/(app)/export.tsx` |
| Pure logic (unit tested) | `src/domain/import.ts` | `src/domain/export.ts` |
| Firebase / files | `src/services/import/api.ts` | `src/services/export/api.ts` |
| Audit event | `import_completed` | `export_created` |

## Import

### Steps

1. **Pick a file** (`expo-document-picker`): `.xlsx`, `.xls` or `.csv`. Only the first sheet is read. Max 5,000 rows per file.
   - xlsx is read with `raw: true` so long phone numbers stay intact (formatted text can turn `201012345678` into `2.01E+11`).
   - CSV is read as UTF-8 text; a leading BOM is removed.
2. **Map columns.** `guessMapping()` recognizes Arabic and English headers (hamza/taa marbuta/diacritics insensitive). Every field can be remapped. Required: name, city, area.
3. **Preview.** The app loads every beneficiary, city and area **from the server** and classifies each row with `planImport()`:

| Kind | Rule | Action |
|---|---|---|
| invalid | missing name/city/area, household not 1–100, invalid phone, >10 phones, text too long | skipped, listed with row number and reason |
| fileDuplicate | same phone, or same name in the same city+area, as an earlier row in the file | skipped |
| existing | same phone as an existing beneficiary, or same normalized name in the same area | **skip** (default) or **update** |
| new | anything else | created |

   Missing cities/areas are listed. Users with `areas_manage` can create them in the import; otherwise those rows are skipped.

4. **Run.** Awaited batches (`commitOnline`), with a progress line.
5. **Summary.** Created / updated / skipped, and an `import_completed` audit entry.

### Field rules

- Phones: split on `,` `،` `;` `؛` `|` or new lines; Arabic digits accepted; normalized to E.164 with the same `libphonenumber-js/max` rules as the form (default country EG). Numbers that lost their leading `0` in Excel (`1012345678`) still parse.
- Household: empty means 1.
- Names, cities and areas: whitespace collapsed; matching uses `nameSearchKey()` (the same normalization as search).

### Updates

`update` overwrites only the columns that have a value in the file (empty cells keep existing data), sets the area from the file, and **adds** new phones (existing phones are kept, max 10). A row whose result is identical to the stored document writes nothing. Each real change writes an `imported` history event with `mode`, `fileName`, `line` and the change types.

### Batching and limits

- Each row costs 2 writes (beneficiary + `imported` history event). Each batch adds 1 workspace counter update and 1 counter update per distinct area touched.
- `chunkForBatches()` keeps every batch at ≤ 200 rows **and** ≤ 490 writes (Firestore limit is 500).
- Missing cities/areas are created first, in batches of ≤ 400, with workspace counters.

### Re-running safely

Batches are committed one by one. If one fails (connection lost, rules denial), earlier batches stay committed and the summary says how many rows were processed. Re-importing the same file is safe: committed rows are now `existing` and are skipped, or updated with no write when nothing changed.

### Cost (Spark plan)

Preview reads every beneficiary once (~500 reads at target scale) plus cities and areas. Writing 500 new rows is ~1,000 writes plus a few counter updates. That is well inside the free daily quota (50k reads / 20k writes), but avoid repeated previews of large files.

## Export

### Presets

| Preset | Source | Contents |
|---|---|---|
| Beneficiary list | `beneficiaries` filtered by city or area; archived optional | One row per beneficiary: name, primary and other phones, household, city, area, address, pickup, notes, last confirmed assistance, pin count, first-pin Maps link, status, created date |
| Beneficiary profile | one beneficiary + assistance records + up to 200 history events (only with `history_view`) | Sections: profile, phones, pins, assistance, history |
| Session report | session doc + its items | Summary (counts computed from items) + one row per item in session order with status, processed time and note |

The session report carries the disclaimer "Check means the operator processed the name in the session; it is not proof of delivery."

### Formats

| Format | How | Arabic handling |
|---|---|---|
| Excel (`.xlsx`) | SheetJS `aoa_to_sheet`; one sheet per section; auto column widths | Workbook view set to right-to-left when the app language is Arabic |
| PDF | `toHtml()` → `expo-print` `printToFileAsync` | `dir="rtl"`; IBM Plex Sans Arabic embedded as base64 (`@font-face`), loaded from the bundled font via `expo-asset`, so PDFs render without network fonts |
| CSV | `toCsv()` | UTF-8 with BOM (Excel opens Arabic correctly), CRLF line endings; multi-section exports put a title line before each section |

All formats share one in-memory model (`ExportDoc`: title, subtitle, sections of columns + rows), so content is identical across formats.

### Safety

- Text cells that start with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'` (spreadsheet formula injection), except plain numbers and phone numbers such as `+2010…`.
- HTML is escaped before printing.
- Files are written to the app cache directory (`Paths.cache`) and handed to `expo-sharing`. The app does not upload them anywhere.
- Rules decide what can be read, so an export can never include data the user cannot already see in the app.

### Offline behaviour

Export uses the default Firestore source: server when online, local cache when offline. When the snapshot comes from cache the screen shows "From data saved on this device; may be out of date." The `export_created` audit event is queued like any other offline write.

## Tests

- `tests/import.test.ts`: header guessing, row parsing (Arabic digits, phones without a leading zero, separators, limits), duplicate classification, missing places, idempotent re-import planning, batch limits, and SheetJS xlsx/CSV round trips.
- `tests/export.test.ts`: the three builders, CSV BOM/quoting/formula neutralization, sheet names, RTL HTML with embedded font and escaping, file names.
- `tests/rules/beneficiaries.test.ts` → "import and export": an import-only member can write the import batch and update profiles but cannot archive or create places; members without permission are rejected; audit events must be written as yourself.

Not covered by automated tests: the document picker, `expo-print` output and the share sheet (native modules). Check them manually on a dev build.
