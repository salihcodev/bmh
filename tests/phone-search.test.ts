import { describe, expect, it } from 'vitest';

import { cleanPhoneInput, formatPhone, looksLikePhone, normalizePhone } from '@/domain/phone';
import { matchesName, nameSearchKey, planSearch } from '@/domain/search';

describe('phone normalization (Egypt default)', () => {
  it('accepts local, international and 00 forms', () => {
    for (const raw of ['01012345678', '+201012345678', '00201012345678', '010 1234 5678', '010-1234-5678']) {
      expect(normalizePhone(raw)).toMatchObject({ ok: true, e164: '+201012345678' });
    }
  });

  it('accepts Arabic-Indic digits and bidi marks', () => {
    expect(normalizePhone('٠١٠١٢٣٤٥٦٧٨')).toMatchObject({ ok: true, e164: '+201012345678' });
    expect(normalizePhone('\u200E01012345678\u200E')).toMatchObject({ ok: true, e164: '+201012345678' });
  });

  it('keeps foreign numbers in international form', () => {
    const result = normalizePhone('+966501234567');
    expect(result).toMatchObject({ ok: true, e164: '+966501234567' });
    expect(formatPhone('+966501234567')).toContain('+966');
  });

  it('rejects garbage and too-short numbers', () => {
    expect(normalizePhone('').ok).toBe(false);
    expect(normalizePhone('12345').ok).toBe(false);
    expect(normalizePhone('0101234').ok).toBe(false);
    expect(normalizePhone('abc').ok).toBe(false);
  });

  it('cleans input and detects phone-like queries', () => {
    expect(cleanPhoneInput(' (010) ١٢٣-٤٥٦٧٨ ')).toBe('01012345678');
    expect(looksLikePhone('0101234')).toBe(true);
    expect(looksLikePhone('أحمد')).toBe(false);
    expect(looksLikePhone('12')).toBe(false);
  });
});

describe('search planning', () => {
  it('routes names to a normalized prefix', () => {
    expect(planSearch('  أحمد ')).toEqual({ kind: 'name', prefix: 'احمد' });
    expect(planSearch('فاطمة')).toEqual({ kind: 'name', prefix: 'فاطمه' });
    expect(planSearch('')).toEqual({ kind: 'all' });
  });

  it('routes phones to exact E.164', () => {
    expect(planSearch('٠١٠١٢٣٤٥٦٧٨')).toEqual({ kind: 'phone', e164: '+201012345678' });
    expect(planSearch('0101234567')).toEqual({ kind: 'invalidPhone' });
  });

  it('name keys ignore hamza, taa marbuta and diacritics', () => {
    expect(nameSearchKey('إسلام')).toBe(nameSearchKey('اسلام'));
    expect(matchesName('مُصْطَفَى محمد', 'مصطفي')).toBe(true);
    expect(matchesName('Ahmed Ali', 'ali')).toBe(true);
    expect(matchesName('Ahmed', 'omar')).toBe(false);
  });
});
