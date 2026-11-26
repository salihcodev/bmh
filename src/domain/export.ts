import { firstValidPin, mapsUrl } from './maps';
import type { AssistanceRecord, Beneficiary, EventRecord, Session, SessionItem } from './types';

export type Cell = string | number | null;
export type ExportColumn = { key: string; label: string };
export type ExportRow = Record<string, Cell>;
export type ExportSection = { title?: string; columns: ExportColumn[]; rows: ExportRow[] };
export type ExportDoc = { title: string; subtitle?: string; generatedAt: string; sections: ExportSection[] };

export type ExportPreset = 'beneficiaries' | 'profile' | 'session';
export type ExportFormat = 'xlsx' | 'pdf' | 'csv';
export const EXPORT_FORMATS: readonly ExportFormat[] = ['xlsx', 'pdf', 'csv'];

/** Rendering helpers injected by the caller (i18n + locale formatting) to keep this module pure. */
export type ExportContext = {
  t: (key: string, options?: Record<string, unknown>) => string;
  date: (value: Date | null | undefined) => string;
  dateTime: (value: Date | null | undefined) => string;
  phone: (e164: string) => string;
  now: Date;
};

type DateLike = { toDate(): Date } | null | undefined;
const toDate = (value: DateLike) => (value ? value.toDate() : null);

function columns(ctx: ExportContext, keys: readonly string[]): ExportColumn[] {
  return keys.map((key) => ({ key, label: ctx.t(`export.columns.${key}`) }));
}

export const BENEFICIARY_COLUMNS = [
  'fullName',
  'primaryPhone',
  'otherPhones',
  'householdCount',
  'city',
  'area',
  'residentialAddress',
  'pickupLocation',
  'notes',
  'lastConfirmedAssistance',
  'pins',
  'mapLink',
  'status',
  'createdAt',
] as const;

const LOCATION_KEYS = new Set(['pins', 'mapLink']);

export function beneficiaryRow(
  b: Beneficiary,
  ctx: ExportContext,
  includeLocation = true,
): ExportRow {
  const others = b.phones.filter((p) => p.number !== b.primaryPhone).map((p) => ctx.phone(p.number));
  const firstPin = firstValidPin(b.mapPins);
  const row: ExportRow = {
    fullName: b.fullName,
    primaryPhone: b.primaryPhone ? ctx.phone(b.primaryPhone) : null,
    otherPhones: others.join(' / ') || null,
    householdCount: b.householdCount,
    city: b.cityName,
    area: b.areaName,
    residentialAddress: b.residentialAddress ?? null,
    pickupLocation: b.pickupLocation ?? null,
    notes: b.notes ?? null,
    lastConfirmedAssistance: ctx.date(toDate(b.lastConfirmedAssistanceAt)) || null,
    status: ctx.t(b.isArchived ? 'export.statusArchived' : 'export.statusActive'),
    createdAt: ctx.date(toDate(b.createdAt)) || null,
  };
  if (includeLocation) {
    row.pins = b.mapPins.length;
    row.mapLink = firstPin ? mapsUrl(firstPin) : null;
  }
  return row;
}

export function buildBeneficiariesDoc(
  list: Beneficiary[],
  ctx: ExportContext,
  scope?: { cityName?: string; areaName?: string; includeLocation?: boolean },
): ExportDoc {
  const includeLocation = scope?.includeLocation !== false;
  const keys = includeLocation ? BENEFICIARY_COLUMNS : BENEFICIARY_COLUMNS.filter((k) => !LOCATION_KEYS.has(k));
  const sorted = [...list].sort((a, b) => a.nameSearch.localeCompare(b.nameSearch));
  const subtitle = [scope?.cityName, scope?.areaName].filter(Boolean).join(' / ');
  return {
    title: ctx.t('export.presetList'),
    subtitle: subtitle || undefined,
    generatedAt: ctx.dateTime(ctx.now),
    sections: [{ columns: columns(ctx, keys), rows: sorted.map((b) => beneficiaryRow(b, ctx, includeLocation)) }],
  };
}

export function buildProfileDoc(
  b: Beneficiary,
  history: EventRecord[],
  assistance: AssistanceRecord[],
  ctx: ExportContext,
  includeLocation = true,
): ExportDoc {
  const row = beneficiaryRow(b, ctx, includeLocation);
  const profileKeys = includeLocation ? BENEFICIARY_COLUMNS : BENEFICIARY_COLUMNS.filter((k) => !LOCATION_KEYS.has(k));
  const profile: ExportSection = {
    title: ctx.t('export.section.profile'),
    columns: [
      { key: 'field', label: ctx.t('export.columns.field') },
      { key: 'value', label: ctx.t('export.columns.value') },
    ],
    rows: profileKeys.map((key) => ({ field: ctx.t(`export.columns.${key}`), value: row[key] ?? null })),
  };
  const phones: ExportSection = {
    title: ctx.t('export.section.phones'),
    columns: columns(ctx, ['phone', 'label', 'primary']),
    rows: b.phones.map((p) => ({
      phone: ctx.phone(p.number),
      label: p.label ?? null,
      primary: p.isPrimary ? ctx.t('export.value.yes') : null,
    })),
  };
  const pins: ExportSection = {
    title: ctx.t('export.section.pins'),
    columns: columns(ctx, ['label', 'description', 'coordinates', 'mapLink']),
    rows: b.mapPins.map((p) => ({
      label: p.label ?? null,
      description: p.description ?? null,
      coordinates: `${p.lat}, ${p.lng}`,
      mapLink: mapsUrl(p),
    })),
  };
  const assistanceSection: ExportSection = {
    title: ctx.t('export.section.assistance'),
    columns: columns(ctx, ['deliveredAt', 'type', 'description', 'confirmation', 'recordedBy']),
    rows: [...assistance]
      .sort((x, y) => y.deliveredAt.toMillis() - x.deliveredAt.toMillis())
      .map((r) => ({
        deliveredAt: ctx.date(r.deliveredAt.toDate()),
        type: ctx.t(`assistance.types.${r.type}`),
        description: r.description ?? null,
        confirmation: ctx.t(`assistance.${r.confirmationStatus}`),
        recordedBy: r.recordedByName ?? null,
      })),
  };
  const historySection: ExportSection = {
    title: ctx.t('export.section.history'),
    columns: columns(ctx, ['at', 'event', 'actor']),
    rows: history.map((e) => ({
      at: ctx.dateTime(toDate(e.createdAt) ?? toDate(e.clientAt)),
      event: ctx.t(`history.types.${e.type}`),
      actor: e.actorName,
    })),
  };
  return {
    title: b.fullName,
    subtitle: ctx.t('export.presetProfile'),
    generatedAt: ctx.dateTime(ctx.now),
    sections: [profile, phones, includeLocation ? pins : null, assistanceSection, historySection]
      .filter((s): s is ExportSection => !!s)
      .filter((s, i) => i === 0 || s.rows.length > 0),
  };
}

export const SESSION_COLUMNS = [
  'order',
  'fullName',
  'householdCount',
  'area',
  'primaryPhone',
  'pickupLocation',
  'sessionStatus',
  'processedAt',
  'note',
] as const;

export function buildSessionDoc(session: Session, items: SessionItem[], ctx: ExportContext): ExportDoc {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const summary: ExportSection = {
    title: ctx.t('export.section.summary'),
    columns: [
      { key: 'field', label: ctx.t('export.columns.field') },
      { key: 'value', label: ctx.t('export.columns.value') },
    ],
    rows: [
      { field: ctx.t('export.columns.sessionName'), value: session.name },
      { field: ctx.t('export.columns.city'), value: session.cityName },
      { field: ctx.t('export.columns.areas'), value: session.areaNames.join('، ') },
      { field: ctx.t('export.columns.operator'), value: session.operatorName ?? null },
      { field: ctx.t('export.columns.sessionState'), value: ctx.t(`sessions.status.${session.status}`) },
      { field: ctx.t('export.columns.startedAt'), value: ctx.dateTime(toDate(session.startedAt)) || null },
      { field: ctx.t('export.columns.endedAt'), value: ctx.dateTime(toDate(session.endedAt)) || null },
      { field: ctx.t('export.columns.total'), value: sorted.length },
      { field: ctx.t('export.columns.checked'), value: sorted.filter((i) => i.status === 'checked').length },
      { field: ctx.t('export.columns.ignored'), value: sorted.filter((i) => i.status === 'ignored').length },
      { field: ctx.t('export.columns.pending'), value: sorted.filter((i) => i.status === 'pending').length },
    ],
  };
  const list: ExportSection = {
    title: ctx.t('export.section.items'),
    columns: columns(ctx, SESSION_COLUMNS),
    rows: sorted.map((item, index) => ({
      order: index + 1,
      fullName: item.fullName,
      householdCount: item.householdCount,
      area: item.areaName,
      primaryPhone: item.primaryPhone ? ctx.phone(item.primaryPhone) : null,
      pickupLocation: item.pickupLocation ?? null,
      sessionStatus: ctx.t(`sessions.itemStatus.${item.status}`),
      processedAt: ctx.dateTime(toDate(item.processedAt)) || null,
      note: item.note ?? null,
    })),
  };
  return {
    title: session.name,
    subtitle: ctx.t('export.checkDisclaimer'),
    generatedAt: ctx.dateTime(ctx.now),
    sections: [summary, list],
  };
}

// ---------- renderers ----------

const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralizes spreadsheet formula injection for text cells. */
export function safeText(value: string): string {
  return FORMULA_START.test(value) && !/^[+-]?\d[\d\s]*$/.test(value) ? `'${value}` : value;
}

function csvCell(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  const text = typeof cell === 'number' ? String(cell) : safeText(cell);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 CSV with BOM (so Excel opens Arabic correctly) and CRLF line endings. */
export function toCsv(doc: ExportDoc): string {
  const lines: string[] = [];
  const multi = doc.sections.length > 1;
  doc.sections.forEach((section, index) => {
    if (multi) {
      if (index > 0) lines.push('');
      if (section.title) lines.push(csvCell(section.title));
    }
    lines.push(section.columns.map((c) => csvCell(c.label)).join(','));
    for (const row of section.rows) lines.push(section.columns.map((c) => csvCell(row[c.key] ?? null)).join(','));
  });
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Sheet names: max 31 chars, no []:*?/\ and unique within the workbook. */
export function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n += 1) {
    const suffix = ` (${n})`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
}

/** One array-of-arrays per section, ready for SheetJS `aoa_to_sheet`. */
export function toSheets(doc: ExportDoc): { name: string; rows: Cell[][] }[] {
  const used = new Set<string>();
  return doc.sections.map((section) => ({
    name: sheetName(section.title ?? doc.title, used),
    rows: [
      section.columns.map((c) => c.label),
      ...section.rows.map((row) =>
        section.columns.map((c) => {
          const value = row[c.key] ?? null;
          return typeof value === 'string' ? safeText(value) : value;
        }),
      ),
    ],
  }));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Printable HTML for expo-print. The Arabic font is embedded as base64 so the
 * PDF renders identically offline on every device.
 */
export function toHtml(doc: ExportDoc, options: { rtl: boolean; fontBase64?: string | null; footer?: string }): string {
  const dir = options.rtl ? 'rtl' : 'ltr';
  const fontFace = options.fontBase64
    ? `@font-face { font-family: 'AppArabic'; src: url(data:font/ttf;base64,${options.fontBase64}) format('truetype'); }`
    : '';
  const cell = (value: Cell) => escapeHtml(value === null || value === undefined ? '' : String(value));
  const sections = doc.sections
    .map((section) => {
      const head = section.columns.map((c) => `<th>${cell(c.label)}</th>`).join('');
      const body = section.rows
        .map((row) => `<tr>${section.columns.map((c) => `<td>${cell(row[c.key] ?? null)}</td>`).join('')}</tr>`)
        .join('');
      const title = section.title ? `<h2>${cell(section.title)}</h2>` : '';
      return `${title}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html lang="${options.rtl ? 'ar' : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${fontFace}
@page { margin: 16mm 10mm; }
body { font-family: ${options.fontBase64 ? "'AppArabic', " : ''}-apple-system, Roboto, 'Noto Sans Arabic', sans-serif; direction: ${dir}; color: #111827; font-size: 11px; }
h1 { font-size: 18px; margin: 0 0 4px; }
h2 { font-size: 14px; margin: 18px 0 6px; }
.meta { color: #6B7280; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #E5E7EB; padding: 4px 6px; text-align: start; vertical-align: top; word-break: break-word; }
th { background: #F3F4F6; }
footer { margin-top: 16px; color: #6B7280; font-size: 10px; }
</style>
</head>
<body>
<h1>${cell(doc.title)}</h1>
<div class="meta">${doc.subtitle ? `${cell(doc.subtitle)} · ` : ''}${cell(doc.generatedAt)}</div>
${sections}
${options.footer ? `<footer>${cell(options.footer)}</footer>` : ''}
</body>
</html>`;
}

export function exportFileName(base: string, format: ExportFormat, now: Date): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const safe = base.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'export';
  return `${safe}-${stamp}.${format}`;
}

export const EXPORT_MIME: Record<ExportFormat, { mimeType: string; UTI: string }> = {
  xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'org.openxmlformats.spreadsheetml.sheet' },
  pdf: { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
};
