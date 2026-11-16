import { normalizeArabicText, normalizeDigits } from '@/utils/arabic';

import { MAX_PHONES, normalizePhone } from './phone';
import { nameSearchKey } from './search';

export const IMPORT_FIELDS = [
  'fullName',
  'phones',
  'householdCount',
  'city',
  'area',
  'residentialAddress',
  'pickupLocation',
  'notes',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];
export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ['fullName', 'city', 'area'];

/** Rows written per Firestore batch (2 writes each, plus counters). */
export const IMPORT_BATCH_ROWS = 200;
/** Firestore hard limit is 500 writes per batch; keep headroom. */
export const IMPORT_BATCH_MAX_WRITES = 490;
export const IMPORT_MAX_ROWS = 5000;

/** Column index (in the sheet) for each mapped field. */
export type ColumnMapping = Partial<Record<ImportField, number>>;

const SYNONYMS: Record<ImportField, string[]> = {
  fullName: ['name', 'full name', 'fullname', 'beneficiary', 'الاسم', 'اسم', 'الاسم الكامل', 'الاسم بالكامل', 'اسم المستفيد', 'المستفيد'],
  phones: ['phone', 'phones', 'mobile', 'tel', 'telephone', 'phone number', 'الهاتف', 'هاتف', 'رقم الهاتف', 'ارقام الهاتف', 'الموبايل', 'موبايل', 'الجوال', 'تليفون', 'التليفون'],
  householdCount: ['household', 'household count', 'family size', 'members', 'عدد الافراد', 'الافراد', 'افراد الاسره', 'عدد افراد الاسره', 'حجم الاسره'],
  city: ['city', 'governorate', 'المدينه', 'مدينه', 'المحافظه', 'محافظه'],
  area: ['area', 'district', 'neighborhood', 'المنطقه', 'منطقه', 'الحي', 'حي'],
  residentialAddress: ['address', 'residential address', 'العنوان', 'عنوان', 'عنوان السكن', 'السكن'],
  pickupLocation: ['pickup', 'pickup location', 'مكان الاستلام', 'نقطه الاستلام', 'الاستلام'],
  notes: ['notes', 'note', 'comments', 'ملاحظات', 'ملاحظه'],
};

const headerKey = (value: string) => normalizeArabicText(value).replace(/[_\-.:]+/g, ' ').trim();

/** Best-effort mapping from sheet headers (Arabic or English). Each field maps to at most one column. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<number>();
  const keys = headers.map(headerKey);
  const assign = (match: (key: string, synonym: string) => boolean) => {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field] !== undefined) continue;
      const index = keys.findIndex(
        (key, i) => !taken.has(i) && key !== '' && SYNONYMS[field].some((s) => match(key, headerKey(s))),
      );
      if (index !== -1) {
        mapping[field] = index;
        taken.add(index);
      }
    }
  };
  assign((key, synonym) => key === synonym);
  assign((key, synonym) => synonym.length >= 3 && key.includes(synonym));
  return mapping;
}

export function missingRequired(mapping: ColumnMapping): ImportField[] {
  return REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined);
}

/** Splits a sheet matrix into headers and non-empty data rows (all cells as trimmed strings). */
export function readMatrix(matrix: unknown[][]): { headers: string[]; rows: { line: number; cells: string[] }[] } {
  const asText = (cell: unknown) => (cell === null || cell === undefined ? '' : String(cell).trim());
  const [head = [], ...body] = matrix;
  const rows = body
    .map((cells, i) => ({ line: i + 2, cells: cells.map(asText) }))
    .filter((row) => row.cells.some((cell) => cell !== ''));
  return { headers: head.map(asText), rows };
}

export type ImportRowError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'cityRequired'
  | 'areaRequired'
  | 'placeTooLong'
  | 'householdInvalid'
  | 'phoneInvalid'
  | 'phonesMax'
  | 'textTooLong';

export type ParsedRow = {
  /** 1-based line in the sheet (header is line 1). */
  line: number;
  fullName: string;
  nameSearch: string;
  householdCount: number;
  cityName: string;
  areaName: string;
  /** Raw phone strings as typed, aligned with `phones`. */
  rawPhones: string[];
  /** E.164, unique. */
  phones: string[];
  residentialAddress: string | null;
  pickupLocation: string | null;
  notes: string | null;
  /** Which optional fields had a value in the sheet (updates only overwrite these). */
  provided: Partial<Record<ImportField, boolean>>;
  errors: ImportRowError[];
};

const PHONE_SEPARATORS = /[,،;؛\n|]+/;

export function splitPhones(value: string): string[] {
  return value
    .split(PHONE_SEPARATORS)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseRow(line: number, cells: string[], mapping: ColumnMapping): ParsedRow {
  const get = (field: ImportField) => {
    const index = mapping[field];
    return index === undefined ? '' : (cells[index] ?? '').trim();
  };
  const errors: ImportRowError[] = [];
  const fullName = get('fullName').replace(/\s+/g, ' ');
  if (!fullName) errors.push('nameRequired');
  else if (fullName.length > 120) errors.push('nameTooLong');

  const cityName = get('city').replace(/\s+/g, ' ');
  const areaName = get('area').replace(/\s+/g, ' ');
  if (!cityName) errors.push('cityRequired');
  if (!areaName) errors.push('areaRequired');
  if (cityName.length > 80 || areaName.length > 80) errors.push('placeTooLong');

  const householdRaw = normalizeDigits(get('householdCount'));
  let householdCount = 1;
  if (householdRaw) {
    householdCount = Number(householdRaw);
    if (!Number.isInteger(householdCount) || householdCount < 1 || householdCount > 100) {
      errors.push('householdInvalid');
    }
  }

  const rawPhones: string[] = [];
  const phones: string[] = [];
  for (const raw of splitPhones(get('phones'))) {
    const result = normalizePhone(raw);
    if (!result.ok) {
      if (!errors.includes('phoneInvalid')) errors.push('phoneInvalid');
      continue;
    }
    if (phones.includes(result.e164)) continue;
    phones.push(result.e164);
    rawPhones.push(raw);
  }
  if (phones.length > MAX_PHONES) errors.push('phonesMax');

  const text = (field: ImportField, max: number) => {
    const value = get(field);
    if (value.length > max && !errors.includes('textTooLong')) errors.push('textTooLong');
    return value || null;
  };
  const residentialAddress = text('residentialAddress', 500);
  const pickupLocation = text('pickupLocation', 500);
  const notes = text('notes', 2000);

  const provided: ParsedRow['provided'] = {};
  for (const field of IMPORT_FIELDS) provided[field] = get(field) !== '';

  return {
    line,
    fullName,
    nameSearch: nameSearchKey(fullName),
    householdCount,
    cityName,
    areaName,
    rawPhones,
    phones,
    residentialAddress,
    pickupLocation,
    notes,
    provided,
    errors,
  };
}

export type ExistingBeneficiary = {
  id: string;
  nameSearch: string;
  areaId: string;
  phoneDigits: string[];
};

export type PlaceIndex = {
  cities: { id: string; name: string; nameSearch: string }[];
  areas: { id: string; name: string; nameSearch: string; cityId: string }[];
};

export type RowPlan =
  | { kind: 'invalid'; row: ParsedRow }
  | { kind: 'fileDuplicate'; row: ParsedRow; firstLine: number }
  | { kind: 'new'; row: ParsedRow; cityId: string | null; areaId: string | null }
  | { kind: 'existing'; row: ParsedRow; beneficiaryId: string; cityId: string | null; areaId: string | null };

export type ImportPlan = {
  rows: RowPlan[];
  missingCities: string[];
  missingAreas: { cityName: string; areaName: string }[];
  counts: { total: number; invalid: number; fileDuplicates: number; new: number; existing: number };
};

const placeKey = (city: string, area: string) => `${nameSearchKey(city)}|${nameSearchKey(area)}`;

/**
 * Classifies each parsed row: invalid, duplicate inside the file, matching an
 * existing beneficiary (same phone, or same name in the same area), or new.
 * Also lists cities/areas that do not exist yet.
 */
export function planImport(parsed: ParsedRow[], existing: ExistingBeneficiary[], places: PlaceIndex): ImportPlan {
  const cityByKey = new Map(places.cities.map((c) => [c.nameSearch || nameSearchKey(c.name), c]));
  const areaByKey = new Map(places.areas.map((a) => [`${a.cityId}|${a.nameSearch || nameSearchKey(a.name)}`, a]));
  const byPhone = new Map<string, string>();
  const byNameArea = new Map<string, string>();
  for (const b of existing) {
    for (const phone of b.phoneDigits) if (!byPhone.has(phone)) byPhone.set(phone, b.id);
    byNameArea.set(`${b.areaId}|${b.nameSearch}`, b.id);
  }

  const seenPhone = new Map<string, number>();
  const seenName = new Map<string, number>();
  const missingCities = new Map<string, string>();
  const missingAreas = new Map<string, { cityName: string; areaName: string }>();
  const rows: RowPlan[] = [];

  for (const row of parsed) {
    if (row.errors.length > 0) {
      rows.push({ kind: 'invalid', row });
      continue;
    }
    const nameKey = `${placeKey(row.cityName, row.areaName)}|${row.nameSearch}`;
    const firstLine = row.phones.map((p) => seenPhone.get(p)).find((l) => l !== undefined) ?? seenName.get(nameKey);
    if (firstLine !== undefined) {
      rows.push({ kind: 'fileDuplicate', row, firstLine });
      continue;
    }
    for (const phone of row.phones) seenPhone.set(phone, row.line);
    seenName.set(nameKey, row.line);

    const city = cityByKey.get(nameSearchKey(row.cityName));
    const area = city ? areaByKey.get(`${city.id}|${nameSearchKey(row.areaName)}`) : undefined;
    const cityKey = nameSearchKey(row.cityName);
    const areaKey = placeKey(row.cityName, row.areaName);
    if (!city && !missingCities.has(cityKey)) missingCities.set(cityKey, row.cityName);
    if (!area && !missingAreas.has(areaKey)) missingAreas.set(areaKey, { cityName: row.cityName, areaName: row.areaName });

    const cityId = city?.id ?? null;
    const areaId = area?.id ?? null;
    const matchId =
      row.phones.map((p) => byPhone.get(p)).find((id) => id !== undefined) ??
      (areaId ? byNameArea.get(`${areaId}|${row.nameSearch}`) : undefined);
    rows.push(matchId ? { kind: 'existing', row, beneficiaryId: matchId, cityId, areaId } : { kind: 'new', row, cityId, areaId });
  }

  const count = (kind: RowPlan['kind']) => rows.filter((r) => r.kind === kind).length;
  return {
    rows,
    missingCities: [...missingCities.values()],
    missingAreas: [...missingAreas.values()],
    counts: {
      total: rows.length,
      invalid: count('invalid'),
      fileDuplicates: count('fileDuplicate'),
      new: count('new'),
      existing: count('existing'),
    },
  };
}

/**
 * Groups row plans into batches that stay under the write limit:
 * each row costs 2 writes (doc + history), plus 1 workspace counter and one
 * counter update per distinct area touched in the batch.
 */
export function chunkForBatches<T extends { areaKeys: string[] }>(
  items: T[],
  maxRows = IMPORT_BATCH_ROWS,
  maxWrites = IMPORT_BATCH_MAX_WRITES,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let areas = new Set<string>();
  for (const item of items) {
    const nextAreas = new Set([...areas, ...item.areaKeys]);
    const writes = (current.length + 1) * 2 + 1 + nextAreas.size;
    if (current.length > 0 && (current.length >= maxRows || writes > maxWrites)) {
      batches.push(current);
      current = [];
      areas = new Set();
    }
    current.push(item);
    for (const key of item.areaKeys) areas.add(key);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
