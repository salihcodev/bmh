import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import {
  chunkForBatches,
  guessMapping,
  missingRequired,
  parseRow,
  planImport,
  readMatrix,
  splitPhones,
  type ColumnMapping,
} from '@/domain/import';

const HEADERS = ['الاسم', 'رقم الهاتف', 'عدد الأفراد', 'المدينة', 'المنطقة', 'العنوان', 'مكان الاستلام', 'ملاحظات'];
const MAPPING: ColumnMapping = {
  fullName: 0,
  phones: 1,
  householdCount: 2,
  city: 3,
  area: 4,
  residentialAddress: 5,
  pickupLocation: 6,
  notes: 7,
};

const row = (cells: string[], line = 2) => parseRow(line, cells, MAPPING);

describe('guessMapping', () => {
  it('maps Arabic headers', () => {
    expect(guessMapping(HEADERS)).toEqual(MAPPING);
  });

  it('maps English headers regardless of case and order', () => {
    expect(guessMapping(['City', 'Full Name', 'Phone', 'Area', 'Household Count'])).toEqual({
      city: 0,
      fullName: 1,
      phones: 2,
      area: 3,
      householdCount: 4,
    });
  });

  it('tolerates hamza and taa marbuta variations', () => {
    expect(guessMapping(['اسم المستفيد', 'المدينة', 'المنطقه', 'عدد افراد الأسرة'])).toMatchObject({
      fullName: 0,
      city: 1,
      area: 2,
      householdCount: 3,
    });
  });

  it('reports missing required fields', () => {
    expect(missingRequired({ fullName: 0 })).toEqual(['city', 'area']);
  });
});

describe('readMatrix', () => {
  it('drops empty rows and keeps sheet line numbers', () => {
    const { headers, rows } = readMatrix([['a', 'b'], ['1', ''], ['', ''], [2, null]]);
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toEqual([
      { line: 2, cells: ['1', ''] },
      { line: 4, cells: ['2', ''] },
    ]);
  });
});

describe('parseRow', () => {
  it('parses a valid row with Arabic digits and several phones', () => {
    const parsed = row(['  أحمد   علي ', '٠١٠١٢٣٤٥٦٧٨، 01112345678', '٥', 'القاهرة', 'شبرا', '', 'المسجد', '']);
    expect(parsed.errors).toEqual([]);
    expect(parsed.fullName).toBe('أحمد علي');
    expect(parsed.householdCount).toBe(5);
    expect(parsed.phones).toEqual(['+201012345678', '+201112345678']);
    expect(parsed.pickupLocation).toBe('المسجد');
    expect(parsed.residentialAddress).toBeNull();
    expect(parsed.provided.residentialAddress).toBe(false);
  });

  it('accepts phone numbers that lost their leading zero in Excel', () => {
    expect(row(['سارة', '1012345678', '', 'القاهرة', 'شبرا']).phones).toEqual(['+201012345678']);
  });

  it('defaults an empty household to 1', () => {
    expect(row(['سارة', '', '', 'القاهرة', 'شبرا']).householdCount).toBe(1);
  });

  it('flags missing and invalid values', () => {
    const parsed = row(['', '123', '0', '', '']);
    expect(parsed.errors).toEqual(['nameRequired', 'cityRequired', 'areaRequired', 'householdInvalid', 'phoneInvalid']);
  });

  it('flags more than 10 phones and de-duplicates repeats', () => {
    const many = Array.from({ length: 11 }, (_, i) => `0101234${String(i).padStart(4, '0')}`).join(',');
    expect(row(['x', many, '', 'c', 'a']).errors).toContain('phonesMax');
    expect(row(['x', '01012345678;01012345678', '', 'c', 'a']).phones).toHaveLength(1);
  });

  it('splits phones on common separators', () => {
    expect(splitPhones('010 1234 5678 | 011-1234-5678\n012؛')).toEqual(['010 1234 5678', '011-1234-5678', '012']);
  });
});

describe('planImport', () => {
  const places = {
    cities: [{ id: 'c1', name: 'القاهرة', nameSearch: 'القاهره' }],
    areas: [{ id: 'a1', name: 'شبرا', nameSearch: 'شبرا', cityId: 'c1' }],
  };
  const existing = [
    { id: 'b1', nameSearch: 'منى حسن', areaId: 'a1', phoneDigits: ['+201000000001'] },
    { id: 'b2', nameSearch: 'كريم', areaId: 'a1', phoneDigits: [] },
  ];

  it('classifies new, existing (by phone or name+area), file duplicates and invalid rows', () => {
    const rows = [
      row(['جديد', '01012345678', '2', 'القاهرة', 'شبرا'], 2),
      row(['اسم آخر', '01000000001', '', 'القاهرة', 'شبرا'], 3),
      row(['كريم', '', '', 'القاهره', 'شبرا'], 4),
      row(['تكرار', '01012345678', '', 'القاهرة', 'شبرا'], 5),
      row(['', '', '', '', ''], 6),
      row(['جديد', '', '', 'القاهرة', 'شبرا'], 7),
    ];
    const plan = planImport(rows, existing, places);
    expect(plan.rows.map((r) => r.kind)).toEqual(['new', 'existing', 'existing', 'fileDuplicate', 'invalid', 'fileDuplicate']);
    expect(plan.rows[1]).toMatchObject({ beneficiaryId: 'b1' });
    expect(plan.rows[2]).toMatchObject({ beneficiaryId: 'b2' });
    expect(plan.rows[3]).toMatchObject({ firstLine: 2 });
    expect(plan.counts).toEqual({ total: 6, invalid: 1, fileDuplicates: 2, new: 1, existing: 2 });
    expect(plan.missingCities).toEqual([]);
    expect(plan.missingAreas).toEqual([]);
  });

  it('lists missing cities and areas once each', () => {
    const rows = [
      row(['أ', '', '', 'الجيزة', 'الهرم'], 2),
      row(['ب', '', '', 'الجيزه', 'الهرم'], 3),
      row(['ج', '', '', 'القاهرة', 'مدينة نصر'], 4),
    ];
    const plan = planImport(rows, [], places);
    expect(plan.missingCities).toEqual(['الجيزة']);
    expect(plan.missingAreas).toEqual([
      { cityName: 'الجيزة', areaName: 'الهرم' },
      { cityName: 'القاهرة', areaName: 'مدينة نصر' },
    ]);
    expect(plan.rows.every((r) => r.kind === 'new')).toBe(true);
  });

  it('is idempotent: re-importing the same file matches every row to an existing beneficiary', () => {
    const first = planImport([row(['جديد', '01012345678', '', 'القاهرة', 'شبرا'])], [], places);
    expect(first.counts.new).toBe(1);
    const afterImport = [{ id: 'n1', nameSearch: 'جديد', areaId: 'a1', phoneDigits: ['+201012345678'] }];
    const second = planImport([row(['جديد', '01012345678', '', 'القاهرة', 'شبرا'])], afterImport, places);
    expect(second.counts).toMatchObject({ new: 0, existing: 1 });
  });
});

describe('SheetJS round trip', () => {
  it('reads an Arabic xlsx with numeric phones the same way the app does', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['الاسم', 'الهاتف', 'عدد الأفراد', 'المدينة', 'المنطقة'],
        ['منى', 201012345678, 3, 'القاهرة', 'شبرا'],
        [],
        ['علي', '01112345678', '', 'القاهرة', 'شبرا'],
      ]),
      'بيانات',
    );
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const read = XLSX.read(new Uint8Array(bytes), { type: 'array' });
    const sheet = read.Sheets[read.SheetNames[0]!]!;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false });
    const { headers, rows } = readMatrix(matrix);
    const mapping = guessMapping(headers);
    const parsed = rows.map((r) => parseRow(r.line, r.cells, mapping));
    expect(parsed.map((p) => p.errors)).toEqual([[], []]);
    expect(parsed.map((p) => p.phones[0])).toEqual(['+201012345678', '+201112345678']);
    expect(parsed[0]!.householdCount).toBe(3);
  });

  it('reads UTF-8 CSV with a BOM', () => {
    const csv = '\uFEFFالاسم,المدينة,المنطقة\r\nمنى,القاهرة,شبرا\r\n';
    const read = XLSX.read(csv.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets[read.SheetNames[0]!]!, { header: 1, raw: true, defval: '' });
    const { headers, rows } = readMatrix(matrix);
    expect(guessMapping(headers)).toEqual({ fullName: 0, city: 1, area: 2 });
    expect(rows[0]!.cells).toEqual(['منى', 'القاهرة', 'شبرا']);
  });
});

describe('chunkForBatches', () => {
  it('caps rows per batch', () => {
    const items = Array.from({ length: 450 }, () => ({ areaKeys: ['a'] }));
    expect(chunkForBatches(items).map((b) => b.length)).toEqual([200, 200, 50]);
  });

  it('keeps writes (2 per row + workspace + one per area) under the limit', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ areaKeys: [`area-${i}`] }));
    const batches = chunkForBatches(items);
    for (const batch of batches) {
      const areas = new Set(batch.flatMap((b) => b.areaKeys));
      expect(batch.length * 2 + 1 + areas.size).toBeLessThanOrEqual(490);
    }
    expect(batches.flat()).toHaveLength(200);
  });
});
