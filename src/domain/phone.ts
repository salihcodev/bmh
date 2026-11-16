import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

import { normalizeDigits } from '@/utils/arabic';

export const DEFAULT_COUNTRY: CountryCode = 'EG';
export const MAX_PHONES = 10;

/** Arabic/Persian digits to Western, drop separators, `00` prefix to `+`. */
export function cleanPhoneInput(raw: string): string {
  let value = normalizeDigits(raw).replace(/[\s\-().\u200e\u200f\u202a-\u202e]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  return value;
}

export type PhoneResult = { ok: true; e164: string; national: string } | { ok: false };

export function normalizePhone(raw: string, country: CountryCode = DEFAULT_COUNTRY): PhoneResult {
  const value = cleanPhoneInput(raw);
  if (!/^\+?\d{6,15}$/.test(value)) return { ok: false };
  const parsed = parsePhoneNumberFromString(value, country);
  if (!parsed || !parsed.isValid()) return { ok: false };
  return { ok: true, e164: parsed.number, national: parsed.formatNational() };
}

/** Display form: national format for the default country, international otherwise. */
export function formatPhone(e164: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === country ? parsed.formatNational() : parsed.formatInternational();
}

/** Looks like a phone search (digits only after cleaning, at least 6). */
export function looksLikePhone(query: string): boolean {
  return /^\+?\d{6,}$/.test(cleanPhoneInput(query));
}
