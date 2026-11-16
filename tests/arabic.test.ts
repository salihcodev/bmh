import { describe, expect, it } from 'vitest';

import { ltr, normalizeArabicText, normalizeDigits, parseLocalizedNumber } from '@/utils/arabic';

describe('arabic utils', () => {
  it('normalizes Arabic-Indic and Persian digits', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeDigits('۰۱۲۳')).toBe('0123');
    expect(parseLocalizedNumber('١٢٫٥')).toBe(12.5);
  });

  it('normalizes letters, diacritics and tatweel', () => {
    expect(normalizeArabicText('  أحـــمد  ')).toBe('احمد');
    expect(normalizeArabicText('مُصْطَفَى')).toBe('مصطفي');
    expect(normalizeArabicText('فاطمة')).toBe('فاطمه');
    expect(normalizeArabicText('إسلام آدم')).toBe('اسلام ادم');
  });

  it('wraps values with LRM marks', () => {
    expect(ltr('+20')).toBe('\u200E+20\u200E');
  });
});
