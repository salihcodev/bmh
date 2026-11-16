import { describe, expect, it } from 'vitest';

import { beneficiarySchema, buildPhones, buildProfileFields, type BeneficiaryInput } from '@/domain/beneficiary';
import { diffBeneficiaryEvents } from '@/domain/events';

const clock = { now: () => 'NOW' };

const base: BeneficiaryInput = {
  fullName: ' أحمد علي ',
  householdCount: '٤',
  cityId: 'c1',
  areaId: 'a1',
  residentialAddress: '',
  pickupLocation: 'المسجد',
  notes: '',
  phones: [
    { id: 'p1', raw: '01012345678', label: '', isPrimary: false },
    { id: 'p2', raw: '01112345678', label: 'ابنه', isPrimary: true },
  ],
};

describe('beneficiary schema', () => {
  it('accepts a valid form (Arabic digits in household)', () => {
    expect(beneficiarySchema.safeParse(base).success).toBe(true);
  });

  it('rejects invalid household, missing place, bad and duplicate phones', () => {
    const issues = (input: Partial<BeneficiaryInput>) => {
      const result = beneficiarySchema.safeParse({ ...base, ...input });
      return result.success ? [] : result.error.issues.map((i) => i.message);
    };
    expect(issues({ householdCount: '0' })).toContain('validation.householdRange');
    expect(issues({ householdCount: '101' })).toContain('validation.householdRange');
    expect(issues({ areaId: '' })).toContain('validation.areaRequired');
    expect(issues({ phones: [{ id: 'x', raw: '123', isPrimary: true }] })).toContain('validation.phoneInvalid');
    expect(
      issues({
        phones: [
          { id: 'x', raw: '01012345678', isPrimary: true },
          { id: 'y', raw: '+201012345678', isPrimary: false },
        ],
      }),
    ).toContain('validation.phoneDuplicate');
    expect(
      issues({ phones: Array.from({ length: 11 }, (_, i) => ({ id: `${i}`, raw: '', isPrimary: false })) }),
    ).toContain('validation.phonesMax');
  });
});

describe('profile building', () => {
  it('normalizes name search, household and phones', () => {
    const fields = buildProfileFields(base, { cityName: 'C', areaName: 'A' }, undefined, clock);
    expect(fields.fullName).toBe('أحمد علي');
    expect(fields.nameSearch).toBe('احمد علي');
    expect(fields.householdCount).toBe(4);
    expect(fields.primaryPhone).toBe('+201112345678');
    expect(fields.phoneDigits).toEqual(['+201012345678', '+201112345678']);
    expect(fields.residentialAddress).toBeNull();
    expect(fields.phones[0]?.createdAt).toBe('NOW');
  });

  it('guarantees exactly one primary and drops empty rows', () => {
    const { phones, primaryPhone } = buildPhones(
      [
        { id: 'a', raw: '', isPrimary: true },
        { id: 'b', raw: '01012345678', isPrimary: false },
        { id: 'c', raw: '01112345678', isPrimary: false },
      ],
      undefined,
      clock,
    );
    expect(phones).toHaveLength(2);
    expect(phones.filter((p) => p.isPrimary)).toHaveLength(1);
    expect(primaryPhone).toBe('+201012345678');
  });

  it('keeps createdAt of unchanged phones', () => {
    const existing = [{ id: 'p1', number: '+201012345678', raw: '010', isPrimary: true, createdAt: 'OLD' }];
    const { phones } = buildPhones(
      [{ id: 'p1', raw: '01012345678', isPrimary: true }],
      existing as never,
      clock,
    );
    expect(phones[0]?.createdAt).toBe('OLD');
  });
});

describe('history diff', () => {
  const before = {
    fullName: 'A',
    householdCount: 2,
    notes: '',
    residentialAddress: 'x',
    pickupLocation: 'y',
    areaId: 'a1',
    primaryPhone: '+1',
    phones: [{ id: 'p1', number: '+1' }, { id: 'p2', number: '+2' }],
    mapPins: [{ id: 'm1', lat: 1, lng: 1 }],
  };

  it('detects specific change types', () => {
    const types = diffBeneficiaryEvents(before, {
      ...before,
      householdCount: 3,
      notes: 'new',
      areaId: 'a2',
      primaryPhone: '+2',
      phones: [{ id: 'p2', number: '+2' }, { id: 'p3', number: '+3' }],
      mapPins: [{ id: 'm1', lat: 2, lng: 1 }],
    });
    expect(types).toEqual(
      expect.arrayContaining([
        'beneficiary_updated',
        'notes_updated',
        'area_changed',
        'phone_added',
        'phone_removed',
        'primary_phone_changed',
        'pin_updated',
      ]),
    );
  });

  it('returns nothing when nothing changed', () => {
    expect(diffBeneficiaryEvents(before, { ...before })).toEqual([]);
  });
});
