import { z } from 'zod';

import { normalizeDigits } from '@/utils/arabic';

import { MAX_PHONES, normalizePhone } from './phone';
import { nameSearchKey } from './search';
import type { MapPin, Phone } from './types';

export const SCHEMA_VERSION = 1;

const optionalText = (max: number) => z.string().trim().max(max, 'validation.tooLong').optional();

export const phoneInputSchema = z.object({
  id: z.string(),
  raw: z.string(),
  label: z.string().trim().max(40, 'validation.tooLong').optional(),
  isPrimary: z.boolean(),
});

export const beneficiarySchema = z
  .object({
    fullName: z.string().trim().min(1, 'validation.required').max(120, 'validation.tooLong'),
    householdCount: z.string().refine((value) => {
      const n = Number(normalizeDigits(value).trim());
      return Number.isInteger(n) && n >= 1 && n <= 100;
    }, 'validation.householdRange'),
    cityId: z.string().min(1, 'validation.cityRequired'),
    areaId: z.string().min(1, 'validation.areaRequired'),
    residentialAddress: optionalText(500),
    pickupLocation: optionalText(500),
    notes: optionalText(2000),
    phones: z.array(phoneInputSchema).max(MAX_PHONES, 'validation.phonesMax'),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.phones.forEach((phone, index) => {
      if (!phone.raw.trim()) return;
      const result = normalizePhone(phone.raw);
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', path: ['phones', index, 'raw'], message: 'validation.phoneInvalid' });
        return;
      }
      if (seen.has(result.e164)) {
        ctx.addIssue({ code: 'custom', path: ['phones', index, 'raw'], message: 'validation.phoneDuplicate' });
      }
      seen.add(result.e164);
    });
  });

export type BeneficiaryInput = z.infer<typeof beneficiarySchema>;
export type PhoneInput = z.infer<typeof phoneInputSchema>;

type Clock<T> = { now: () => T };

/**
 * Turns form phones into stored phones. Keeps ids and createdAt of unchanged
 * entries, drops empty rows, and guarantees exactly one primary when any exist.
 */
export function buildPhones<T>(inputs: PhoneInput[], existing: Phone[] | undefined, clock: Clock<T>) {
  const previous = new Map((existing ?? []).map((p) => [p.id, p]));
  const phones: (Omit<Phone, 'createdAt'> & { createdAt: T | Phone['createdAt'] })[] = [];
  for (const input of inputs) {
    if (!input.raw.trim()) continue;
    const result = normalizePhone(input.raw);
    if (!result.ok) continue;
    const old = previous.get(input.id);
    phones.push({
      id: input.id,
      number: result.e164,
      raw: input.raw.trim(),
      label: input.label?.trim() || null,
      isPrimary: input.isPrimary,
      createdAt: old && old.number === result.e164 ? old.createdAt : clock.now(),
    });
  }
  const primaryIndex = phones.findIndex((p) => p.isPrimary);
  phones.forEach((p, i) => {
    p.isPrimary = i === (primaryIndex === -1 ? 0 : primaryIndex);
  });
  const primaryPhone = phones.find((p) => p.isPrimary)?.number ?? null;
  return { phones, primaryPhone, phoneDigits: phones.map((p) => p.number) };
}

export function parseHousehold(value: string): number {
  return Number(normalizeDigits(value).trim());
}

/** Profile fields shared by create, edit and import. */
export function buildProfileFields<T>(
  input: BeneficiaryInput,
  place: { cityName: string; areaName: string },
  existingPhones: Phone[] | undefined,
  clock: Clock<T>,
) {
  return {
    fullName: input.fullName.trim(),
    nameSearch: nameSearchKey(input.fullName),
    householdCount: parseHousehold(input.householdCount),
    cityId: input.cityId,
    cityName: place.cityName,
    areaId: input.areaId,
    areaName: place.areaName,
    residentialAddress: input.residentialAddress?.trim() || null,
    pickupLocation: input.pickupLocation?.trim() || null,
    notes: input.notes?.trim() || null,
    ...buildPhones(input.phones, existingPhones, clock),
  };
}

export function toFormValues(b: {
  fullName: string;
  householdCount: number;
  cityId: string;
  areaId: string;
  residentialAddress?: string | null;
  pickupLocation?: string | null;
  notes?: string | null;
  phones: Phone[];
}): BeneficiaryInput {
  return {
    fullName: b.fullName,
    householdCount: String(b.householdCount),
    cityId: b.cityId,
    areaId: b.areaId,
    residentialAddress: b.residentialAddress ?? '',
    pickupLocation: b.pickupLocation ?? '',
    notes: b.notes ?? '',
    phones: b.phones.map((p) => ({ id: p.id, raw: p.raw || p.number, label: p.label ?? '', isPrimary: p.isPrimary })),
  };
}

export const MAX_PINS = 10;
export type { MapPin };
