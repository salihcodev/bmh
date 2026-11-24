import { nameSearchKey } from './search';

export const SUPPLIER_STATUSES = ['active', 'hidden'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export type Bilingual = { ar: string; en: string };

export type SupplierContacts = {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
};

/** `suppliers/{uid}`: public storefront for an approved supplier. */
export type SupplierProfile = {
  id: string;
  name: string;
  nameSearch: string;
  bio: Bilingual;
  logoPublicId: string | null;
  coverPublicId: string | null;
  categoryIds: string[];
  serviceArea: string;
  contacts: SupplierContacts;
  isVerified: boolean;
  status: SupplierStatus;
  itemsCount: number;
  ratingSum: number;
  ratingCount: number;
  bagsDonatedCount: number;
  isDeleted: boolean;
};

export type SupplierProfilePayload = {
  name: string;
  bio: Bilingual;
  logoPublicId?: string | null;
  coverPublicId?: string | null;
  categoryIds: string[];
  serviceArea: string;
  contacts: SupplierContacts;
};

export function emptyBio(): Bilingual {
  return { ar: '', en: '' };
}

export function emptySupplierProfile(name: string) {
  return {
    name,
    nameSearch: nameSearchKey(name),
    bio: emptyBio(),
    logoPublicId: null,
    coverPublicId: null,
    categoryIds: [] as string[],
    serviceArea: '',
    contacts: {} as SupplierContacts,
    isVerified: false,
    status: 'active' as const,
    itemsCount: 0,
    ratingSum: 0,
    ratingCount: 0,
    bagsDonatedCount: 0,
    isDeleted: false,
  };
}

export function supplierRating(profile: Pick<SupplierProfile, 'ratingSum' | 'ratingCount'>): number | null {
  if (profile.ratingCount <= 0) return null;
  return Math.round((profile.ratingSum / profile.ratingCount) * 10) / 10;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBilingual(value: unknown): Bilingual {
  if (!value || typeof value !== 'object') return emptyBio();
  const v = value as Record<string, unknown>;
  return { ar: asString(v.ar), en: asString(v.en) };
}

export function normalizeSupplierProfile(id: string, data: Record<string, unknown>): SupplierProfile {
  const status = SUPPLIER_STATUSES.includes(data.status as SupplierStatus)
    ? (data.status as SupplierStatus)
    : 'active';
  const contacts = (data.contacts && typeof data.contacts === 'object' ? data.contacts : {}) as Record<
    string,
    unknown
  >;
  return {
    id,
    name: asString(data.name),
    nameSearch: asString(data.nameSearch) || nameSearchKey(asString(data.name)),
    bio: asBilingual(data.bio),
    logoPublicId: typeof data.logoPublicId === 'string' ? data.logoPublicId : null,
    coverPublicId: typeof data.coverPublicId === 'string' ? data.coverPublicId : null,
    categoryIds: Array.isArray(data.categoryIds)
      ? data.categoryIds.filter((x): x is string => typeof x === 'string')
      : [],
    serviceArea: asString(data.serviceArea),
    contacts: {
      phone: typeof contacts.phone === 'string' ? contacts.phone : null,
      whatsapp: typeof contacts.whatsapp === 'string' ? contacts.whatsapp : null,
      email: typeof contacts.email === 'string' ? contacts.email : null,
    },
    isVerified: data.isVerified === true,
    status,
    itemsCount: typeof data.itemsCount === 'number' ? data.itemsCount : 0,
    ratingSum: typeof data.ratingSum === 'number' ? data.ratingSum : 0,
    ratingCount: typeof data.ratingCount === 'number' ? data.ratingCount : 0,
    bagsDonatedCount: typeof data.bagsDonatedCount === 'number' ? data.bagsDonatedCount : 0,
    isDeleted: data.isDeleted === true,
  };
}

export function buildSupplierPayload(input: SupplierProfilePayload) {
  const name = input.name.trim().slice(0, 120);
  return {
    name,
    nameSearch: nameSearchKey(name),
    bio: {
      ar: input.bio.ar.trim().slice(0, 2000),
      en: input.bio.en.trim().slice(0, 2000),
    },
    logoPublicId: input.logoPublicId ?? null,
    coverPublicId: input.coverPublicId ?? null,
    categoryIds: input.categoryIds.slice(0, 20),
    serviceArea: input.serviceArea.trim().slice(0, 200),
    contacts: {
      phone: input.contacts.phone?.trim().slice(0, 40) || null,
      whatsapp: input.contacts.whatsapp?.trim().slice(0, 40) || null,
      email: input.contacts.email?.trim().slice(0, 120) || null,
    },
  };
}
