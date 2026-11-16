import { normalizeArabicText } from '@/utils/arabic';

import { looksLikePhone, normalizePhone } from './phone';

/** Stored on beneficiaries, cities and areas for Arabic-insensitive prefix search. */
export function nameSearchKey(name: string): string {
  return normalizeArabicText(name);
}

export type SearchPlan =
  | { kind: 'all' }
  | { kind: 'name'; prefix: string }
  | { kind: 'phone'; e164: string }
  | { kind: 'invalidPhone' };

/**
 * Firestore has no full-text search: names use a prefix range on `nameSearch`,
 * phones an exact `array-contains` on `phoneDigits` (E.164).
 */
export function planSearch(input: string): SearchPlan {
  const value = input.trim();
  if (!value) return { kind: 'all' };
  if (looksLikePhone(value)) {
    const phone = normalizePhone(value);
    return phone.ok ? { kind: 'phone', e164: phone.e164 } : { kind: 'invalidPhone' };
  }
  const prefix = nameSearchKey(value);
  return prefix ? { kind: 'name', prefix } : { kind: 'all' };
}

/** Upper bound for a prefix range query. */
export const PREFIX_END = '\uf8ff';

/** Same normalization applied in memory (e.g. session item search). */
export function matchesName(name: string, query: string): boolean {
  const q = nameSearchKey(query);
  if (!q) return true;
  return nameSearchKey(name).includes(q);
}
