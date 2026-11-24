import { nameSearchKey } from './search';

export type Bilingual = { ar: string; en: string };

export const STORE_ITEM_STATUSES = ['draft', 'active', 'hidden'] as const;
export type StoreItemStatus = (typeof STORE_ITEM_STATUSES)[number];

export type StoreCategory = {
  id: string;
  parentId: string | null;
  level: 1 | 2;
  name: Bilingual;
  iconPublicId: string | null;
  order: number;
  isActive: boolean;
  itemsCount: number;
  isDeleted: boolean;
};

export type StoreItem = {
  id: string;
  supplierId: string;
  supplierName: string;
  categoryId: string;
  subCategoryId: string;
  name: Bilingual;
  nameSearch: string;
  description: Bilingual;
  imagePublicIds: string[];
  priceMinor: number;
  currency: 'EGP';
  unit: string;
  stock: number | null;
  isAvailable: boolean;
  status: StoreItemStatus;
  bagsCount: number;
  isDeleted: boolean;
};

export type StoreCategoryPayload = {
  parentId: string | null;
  name: Bilingual;
  iconPublicId?: string | null;
  order: number;
  isActive: boolean;
};

export type StoreItemPayload = {
  supplierId: string;
  supplierName: string;
  categoryId: string;
  subCategoryId: string;
  name: Bilingual;
  description: Bilingual;
  imagePublicIds: string[];
  priceMinor: number;
  unit: string;
  stock?: number | null;
  isAvailable: boolean;
  status: StoreItemStatus;
};

export type StoreConfig = {
  popularItemsCount: number;
  popularSuppliersCount: number;
  topBagsCount: number;
};

export const STORE_CONFIG_DEFAULTS: StoreConfig = {
  popularItemsCount: 8,
  popularSuppliersCount: 8,
  topBagsCount: 5,
};

export function formatPriceMinor(minor: number, currency: string = 'EGP', locale: string = 'en'): string {
  const major = (Math.max(0, minor) / 100).toFixed(2);
  if (locale.startsWith('ar')) return `${major} ج.م`;
  return `${currency} ${major}`;
}

export function majorToMinor(major: number): number {
  return Math.round(Math.max(0, major) * 100);
}

export function minorToMajor(minor: number): number {
  return Math.max(0, minor) / 100;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBilingual(value: unknown): Bilingual {
  if (!value || typeof value !== 'object') return { ar: '', en: '' };
  const v = value as Record<string, unknown>;
  return { ar: asString(v.ar), en: asString(v.en) };
}

export function localizedName(name: Bilingual, locale: string): string {
  return locale.startsWith('ar') ? name.ar || name.en : name.en || name.ar;
}

export function normalizeStoreCategory(id: string, data: Record<string, unknown>): StoreCategory {
  const level = data.level === 2 ? 2 : 1;
  return {
    id,
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    level,
    name: asBilingual(data.name),
    iconPublicId: typeof data.iconPublicId === 'string' ? data.iconPublicId : null,
    order: typeof data.order === 'number' ? data.order : 0,
    isActive: data.isActive !== false,
    itemsCount: typeof data.itemsCount === 'number' ? data.itemsCount : 0,
    isDeleted: data.isDeleted === true,
  };
}

export function normalizeStoreItem(id: string, data: Record<string, unknown>): StoreItem {
  const status = STORE_ITEM_STATUSES.includes(data.status as StoreItemStatus)
    ? (data.status as StoreItemStatus)
    : 'draft';
  return {
    id,
    supplierId: asString(data.supplierId),
    supplierName: asString(data.supplierName),
    categoryId: asString(data.categoryId),
    subCategoryId: asString(data.subCategoryId),
    name: asBilingual(data.name),
    nameSearch: asString(data.nameSearch) || nameSearchKey(asBilingual(data.name).en || asBilingual(data.name).ar),
    description: asBilingual(data.description),
    imagePublicIds: Array.isArray(data.imagePublicIds)
      ? data.imagePublicIds.filter((x): x is string => typeof x === 'string').slice(0, 6)
      : [],
    priceMinor: typeof data.priceMinor === 'number' ? data.priceMinor : 0,
    currency: 'EGP',
    unit: asString(data.unit, 'piece'),
    stock: typeof data.stock === 'number' ? data.stock : null,
    isAvailable: data.isAvailable !== false,
    status,
    bagsCount: typeof data.bagsCount === 'number' ? data.bagsCount : 0,
    isDeleted: data.isDeleted === true,
  };
}

export function buildCategoryWrite(input: StoreCategoryPayload) {
  const level: 1 | 2 = input.parentId ? 2 : 1;
  return {
    parentId: input.parentId,
    level,
    name: {
      ar: input.name.ar.trim().slice(0, 80),
      en: input.name.en.trim().slice(0, 80),
    },
    iconPublicId: input.iconPublicId ?? null,
    order: Math.max(0, Math.min(9999, Math.floor(input.order))),
    isActive: input.isActive,
  };
}

export function buildItemWrite(input: StoreItemPayload) {
  const name = {
    ar: input.name.ar.trim().slice(0, 120),
    en: input.name.en.trim().slice(0, 120),
  };
  return {
    supplierId: input.supplierId,
    supplierName: input.supplierName.trim().slice(0, 120),
    categoryId: input.categoryId,
    subCategoryId: input.subCategoryId,
    name,
    nameSearch: nameSearchKey(name.en || name.ar),
    description: {
      ar: input.description.ar.trim().slice(0, 2000),
      en: input.description.en.trim().slice(0, 2000),
    },
    imagePublicIds: input.imagePublicIds.slice(0, 6),
    priceMinor: Math.max(0, Math.floor(input.priceMinor)),
    currency: 'EGP' as const,
    unit: input.unit.trim().slice(0, 40) || 'piece',
    stock: typeof input.stock === 'number' ? Math.max(0, Math.floor(input.stock)) : null,
    isAvailable: input.isAvailable,
    status: input.status,
  };
}

export function normalizeStoreConfig(data: Record<string, unknown> | null | undefined): StoreConfig {
  if (!data) return { ...STORE_CONFIG_DEFAULTS };
  return {
    popularItemsCount: clampCount(data.popularItemsCount, STORE_CONFIG_DEFAULTS.popularItemsCount, 12),
    popularSuppliersCount: clampCount(data.popularSuppliersCount, STORE_CONFIG_DEFAULTS.popularSuppliersCount, 12),
    topBagsCount: clampCount(data.topBagsCount, STORE_CONFIG_DEFAULTS.topBagsCount, 5),
  };
}

function clampCount(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

/** Client-side filters over the current page (price and rating are not indexed). */
export function filterStoreItems(
  items: StoreItem[],
  opts: {
    minPriceMinor?: number | null;
    maxPriceMinor?: number | null;
    availableOnly?: boolean;
    supplierId?: string | null;
  },
): StoreItem[] {
  return items.filter((item) => {
    if (opts.availableOnly && !item.isAvailable) return false;
    if (opts.supplierId && item.supplierId !== opts.supplierId) return false;
    if (typeof opts.minPriceMinor === 'number' && item.priceMinor < opts.minPriceMinor) return false;
    if (typeof opts.maxPriceMinor === 'number' && item.priceMinor > opts.maxPriceMinor) return false;
    return true;
  });
}
