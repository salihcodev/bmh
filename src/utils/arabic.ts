const DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Converts Arabic-Indic and Persian digits (and Arabic separators) to Western digits. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
}

export function parseLocalizedNumber(value: string): number {
  return Number(normalizeDigits(value).trim() || 0);
}

/**
 * Normalizes Arabic text for search and comparison: lowercase, no diacritics or
 * tatweel, unified alef / yaa / taa marbuta, Western digits, single spaces.
 */
export function normalizeArabicText(value: string): string {
  return normalizeDigits(value)
    .trim()
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/\u0640/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

/** Left-to-right mark: keeps phone numbers and codes LTR inside RTL text. */
export const LRM = '\u200E';

export function ltr(value: string): string {
  return `${LRM}${value}${LRM}`;
}
