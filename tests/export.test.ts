import { describe, expect, it } from 'vitest';

import {
  buildBeneficiariesDoc,
  buildProfileDoc,
  buildSessionDoc,
  exportFileName,
  safeText,
  sheetName,
  toCsv,
  toHtml,
  toSheets,
  type ExportContext,
} from '@/domain/export';
import type { AssistanceRecord, Beneficiary, Session, SessionItem } from '@/domain/types';

const ts = (iso: string) => {
  const date = new Date(iso);
  return { toDate: () => date, toMillis: () => date.getTime() } as never;
};

const ctx: ExportContext = {
  t: (key) => key,
  date: (d) => (d ? d.toISOString().slice(0, 10) : ''),
  dateTime: (d) => (d ? d.toISOString().slice(0, 16) : ''),
  phone: (e164) => `P${e164}`,
  now: new Date('2026-11-16T10:00:00Z'),
};

function beneficiary(overrides: Partial<Beneficiary> = {}): Beneficiary {
  return {
    id: 'b1',
    workspaceId: 'w',
    fullName: 'منى حسن',
    nameSearch: 'مني حسن',
    householdCount: 4,
    cityId: 'c1',
    cityName: 'القاهرة',
    areaId: 'a1',
    areaName: 'شبرا',
    residentialAddress: 'شارع 1',
    pickupLocation: null,
    notes: '=HYPERLINK("x")',
    phones: [
      { id: 'p1', number: '+201000000001', raw: '01000000001', isPrimary: true, createdAt: ts('2026-01-01') },
      { id: 'p2', number: '+201000000002', raw: '01000000002', isPrimary: false, label: 'ابن', createdAt: ts('2026-01-01') },
    ],
    primaryPhone: '+201000000001',
    phoneDigits: ['+201000000001', '+201000000002'],
    mapPins: [
      {
        id: 'm1',
        lat: 30.1,
        lng: 31.2,
        label: 'البيت',
        createdAt: ts('2026-01-01'),
        updatedAt: ts('2026-01-01'),
        createdBy: 'u',
      },
    ],
    lastConfirmedAssistanceAt: ts('2026-10-01T00:00:00Z'),
    isArchived: false,
    schemaVersion: 1,
    createdBy: 'u',
    createdAt: ts('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

describe('buildBeneficiariesDoc', () => {
  it('builds one row per beneficiary, sorted by normalized name', () => {
    const doc = buildBeneficiariesDoc(
      [beneficiary(), beneficiary({ id: 'b0', fullName: 'أحمد', nameSearch: 'احمد', isArchived: true })],
      ctx,
      { cityName: 'القاهرة' },
    );
    const section = doc.sections[0]!;
    expect(doc.subtitle).toBe('القاهرة');
    expect(section.rows.map((r) => r.fullName)).toEqual(['أحمد', 'منى حسن']);
    expect(section.rows[1]).toMatchObject({
      primaryPhone: 'P+201000000001',
      otherPhones: 'P+201000000002',
      householdCount: 4,
      lastConfirmedAssistance: '2026-10-01',
      pins: 1,
      status: 'export.statusActive',
    });
    expect(section.rows[1]!.mapLink).toContain('30.1');
    expect(section.rows[0]!.status).toBe('export.statusArchived');
  });
});

describe('buildProfileDoc', () => {
  it('includes profile, phones, pins, assistance and history; drops empty sections', () => {
    const assistance: AssistanceRecord[] = [
      {
        id: 'r1',
        workspaceId: 'w',
        beneficiaryId: 'b1',
        type: 'food',
        deliveredAt: ts('2026-10-01T00:00:00Z'),
        recordedBy: 'u',
        recordedByName: 'Ali',
        confirmationStatus: 'confirmed',
      },
    ];
    const doc = buildProfileDoc(beneficiary(), [], assistance, ctx);
    expect(doc.title).toBe('منى حسن');
    expect(doc.sections.map((s) => s.title)).toEqual([
      'export.section.profile',
      'export.section.phones',
      'export.section.pins',
      'export.section.assistance',
    ]);
    expect(doc.sections[3]!.rows[0]).toMatchObject({ type: 'assistance.types.food', confirmation: 'assistance.confirmed' });
  });
});

describe('buildSessionDoc', () => {
  it('summarizes counts from items and carries the check disclaimer', () => {
    const session = {
      id: 's1',
      name: 'توزيع',
      cityName: 'القاهرة',
      areaNames: ['شبرا', 'الساحل'],
      status: 'ended',
      operatorName: 'Ali',
      startedAt: ts('2026-11-01T08:00:00Z'),
      endedAt: ts('2026-11-01T12:00:00Z'),
    } as Session;
    const item = (id: string, order: number, status: SessionItem['status']) =>
      ({ id, order, fullName: id, householdCount: 1, areaName: 'شبرا', primaryPhone: null, status, processedAt: null }) as SessionItem;
    const doc = buildSessionDoc(session, [item('b', 2, 'ignored'), item('a', 1, 'checked'), item('c', 3, 'pending')], ctx);
    const summary = Object.fromEntries(doc.sections[0]!.rows.map((r) => [r.field, r.value]));
    expect(summary['export.columns.checked']).toBe(1);
    expect(summary['export.columns.ignored']).toBe(1);
    expect(summary['export.columns.pending']).toBe(1);
    expect(doc.subtitle).toBe('export.checkDisclaimer');
    expect(doc.sections[1]!.rows.map((r) => r.fullName)).toEqual(['a', 'b', 'c']);
  });
});

describe('renderers', () => {
  const doc = buildBeneficiariesDoc([beneficiary()], ctx);

  it('CSV starts with a BOM, uses CRLF and quotes/neutralizes cells', () => {
    const csv = toCsv(doc);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.split('\r\n')[1]).toContain('منى حسن');
  });

  it('safeText keeps plain numbers and phone-like values', () => {
    expect(safeText('+201000000001')).toBe('+201000000001');
    expect(safeText('-5')).toBe('-5');
    expect(safeText('=1+1')).toBe("'=1+1");
    expect(safeText('@cmd')).toBe("'@cmd");
  });

  it('sheets have header rows and valid unique names', () => {
    const sheets = toSheets(buildProfileDoc(beneficiary(), [], [], ctx));
    expect(sheets[0]!.rows[0]).toEqual(['export.columns.field', 'export.columns.value']);
    const used = new Set<string>();
    expect(sheetName('a/b:c', used)).toBe('a b c');
    expect(sheetName('A/B:C', used)).toBe('A B C (2)');
    expect(sheetName('x'.repeat(40), used)).toHaveLength(31);
  });

  it('HTML is RTL, embeds the font and escapes content', () => {
    const html = toHtml(
      { ...doc, title: '<b>x</b>' },
      { rtl: true, fontBase64: 'AAAA', footer: 'f' },
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('data:font/ttf;base64,AAAA');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });

  it('file names keep Arabic letters and add a timestamp', () => {
    expect(exportFileName('قائمة المستفيدين / شبرا', 'xlsx', new Date('2026-11-16T10:05:00Z'))).toBe(
      'قائمة-المستفيدين-شبرا-202611161005.xlsx',
    );
  });
});
