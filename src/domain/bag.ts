import { generateInviteCode, DEFAULT_LINK_HOST } from './invite';
import type { Bilingual } from './store';
import type { CartLine } from './cart';
import { cartTotals } from './cart';

export const BAG_ACCESS_MODES = ['view-only', 'collaborative'] as const;
export type BagAccessMode = (typeof BAG_ACCESS_MODES)[number];

export const BAG_STATUSES = ['active', 'archived'] as const;
export type BagStatus = (typeof BAG_STATUSES)[number];

export const BAG_CHANGE_TYPES = [
  'item-added',
  'item-removed',
  'quantity',
  'note',
  'revert',
  'restore',
  'meta',
] as const;
export type BagChangeType = (typeof BAG_CHANGE_TYPES)[number];

export type BagItem = {
  id: string;
  storeItemId: string;
  supplierId: string;
  supplierName: string;
  name: Bilingual;
  imagePublicId: string | null;
  unitPriceMinor: number;
  quantity: number;
  addedBy: string;
};

export type Bag = {
  id: string;
  name: string;
  note: string;
  coverPublicId: string | null;
  creatorId: string;
  creatorName: string;
  workspaceId: string | null;
  isPublic: boolean;
  accessMode: BagAccessMode;
  linkToken: string;
  status: BagStatus;
  version: number;
  itemsCount: number;
  totalMinor: number;
  currency: 'EGP';
  supplierTotals: Record<string, number>;
  donationsCount: number;
  isDeleted: boolean;
  createdAt: number | null;
  updatedAt: number | null;
};

export type BagChange = {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatarPublicId: string | null;
  type: BagChangeType;
  itemId: string | null;
  itemName: string | null;
  before: unknown;
  after: unknown;
  priceDeltaMinor: number;
  version: number;
  createdAt: number | null;
};

export type BagParticipant = {
  uid: string;
  token: string;
  lastSeenVersion: number;
  joinedAt: number | null;
};

export function generateBagToken(randomBytes: (n: number) => Uint8Array): string {
  return generateInviteCode(randomBytes, 28);
}

export function bagLink(token: string, host = DEFAULT_LINK_HOST): string {
  return `https://${host}/bag/${encodeURIComponent(token)}`;
}

const TOKEN_RE = /^[A-Za-z0-9]+$/;

/** Accepts an https `/bag/<token>` link, `bemyhand://bag/<token>`, or a bare token. */
export function parseBagToken(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const match = value.match(/(?:^|\/)bag\/([A-Za-z0-9]{28,64})(?:[/?#]|$)/i);
  if (match?.[1] && TOKEN_RE.test(match[1])) return match[1];
  return TOKEN_RE.test(value) && value.length >= 28 && value.length <= 64 ? value : null;
}

export function supplierTotalsFromLines(
  lines: { supplierId: string; unitPriceMinor: number; quantity: number }[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of lines) {
    totals[line.supplierId] = (totals[line.supplierId] ?? 0) + line.unitPriceMinor * line.quantity;
  }
  return totals;
}

export function bagTotalsFromItems(items: BagItem[]) {
  const totals = cartTotals(
    items.map((i) => ({
      storeItemId: i.storeItemId,
      supplierId: i.supplierId,
      supplierName: i.supplierName,
      name: i.name,
      imagePublicId: i.imagePublicId,
      unitPriceMinor: i.unitPriceMinor,
      quantity: i.quantity,
    })),
  );
  return {
    itemsCount: items.length,
    totalMinor: totals.grandTotalMinor,
    supplierTotals: supplierTotalsFromLines(items),
  };
}

export function cartLinesToBagItems(lines: CartLine[], addedBy: string): Omit<BagItem, 'id'>[] {
  return lines.map((l) => ({
    storeItemId: l.storeItemId,
    supplierId: l.supplierId,
    supplierName: l.supplierName,
    name: l.name,
    imagePublicId: l.imagePublicId,
    unitPriceMinor: l.unitPriceMinor,
    quantity: l.quantity,
    addedBy,
  }));
}

export function groupItemsBySupplier(items: BagItem[]): { supplierId: string; supplierName: string; items: BagItem[]; totalMinor: number }[] {
  const map = new Map<string, { supplierId: string; supplierName: string; items: BagItem[]; totalMinor: number }>();
  for (const item of items) {
    const group = map.get(item.supplierId);
    const line = item.unitPriceMinor * item.quantity;
    if (group) {
      group.items.push(item);
      group.totalMinor += line;
    } else {
      map.set(item.supplierId, {
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        items: [item],
        totalMinor: line,
      });
    }
  }
  return [...map.values()];
}

export type ItemDiff = {
  type: 'item-added' | 'item-removed' | 'quantity';
  itemId: string;
  itemName: string;
  before: number | null;
  after: number | null;
  priceDeltaMinor: number;
};

/** Diff current items against an original snapshot (by item id). */
export function diffBagItems(original: BagItem[], current: BagItem[]): ItemDiff[] {
  const before = new Map(original.map((i) => [i.id, i]));
  const after = new Map(current.map((i) => [i.id, i]));
  const diffs: ItemDiff[] = [];
  for (const [id, item] of after) {
    const prev = before.get(id);
    if (!prev) {
      diffs.push({
        type: 'item-added',
        itemId: id,
        itemName: item.name.en || item.name.ar,
        before: null,
        after: item.quantity,
        priceDeltaMinor: item.unitPriceMinor * item.quantity,
      });
    } else if (prev.quantity !== item.quantity) {
      diffs.push({
        type: 'quantity',
        itemId: id,
        itemName: item.name.en || item.name.ar,
        before: prev.quantity,
        after: item.quantity,
        priceDeltaMinor: item.unitPriceMinor * (item.quantity - prev.quantity),
      });
    }
  }
  for (const [id, item] of before) {
    if (!after.has(id)) {
      diffs.push({
        type: 'item-removed',
        itemId: id,
        itemName: item.name.en || item.name.ar,
        before: item.quantity,
        after: null,
        priceDeltaMinor: -(item.unitPriceMinor * item.quantity),
      });
    }
  }
  return diffs;
}

export function unseenChangeCount(changes: BagChange[], lastSeenVersion: number): number {
  return changes.filter((c) => c.version > lastSeenVersion).length;
}

function toMillis(value: unknown): number | null {
  const v = value as { toMillis?: () => number } | null;
  return typeof v?.toMillis === 'function' ? v.toMillis() : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBilingual(value: unknown): Bilingual {
  if (!value || typeof value !== 'object') return { ar: '', en: '' };
  const v = value as Record<string, unknown>;
  return { ar: asString(v.ar), en: asString(v.en) };
}

export function normalizeBag(id: string, data: Record<string, unknown>): Bag {
  const accessMode = BAG_ACCESS_MODES.includes(data.accessMode as BagAccessMode)
    ? (data.accessMode as BagAccessMode)
    : 'collaborative';
  const status = BAG_STATUSES.includes(data.status as BagStatus) ? (data.status as BagStatus) : 'active';
  const supplierTotals =
    data.supplierTotals && typeof data.supplierTotals === 'object'
      ? Object.fromEntries(
          Object.entries(data.supplierTotals as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number',
          ),
        )
      : {};
  return {
    id,
    name: asString(data.name),
    note: asString(data.note),
    coverPublicId: typeof data.coverPublicId === 'string' ? data.coverPublicId : null,
    creatorId: asString(data.creatorId),
    creatorName: asString(data.creatorName),
    workspaceId: typeof data.workspaceId === 'string' ? data.workspaceId : null,
    isPublic: data.isPublic === true,
    accessMode,
    linkToken: asString(data.linkToken),
    status,
    version: typeof data.version === 'number' ? data.version : 1,
    itemsCount: typeof data.itemsCount === 'number' ? data.itemsCount : 0,
    totalMinor: typeof data.totalMinor === 'number' ? data.totalMinor : 0,
    currency: 'EGP',
    supplierTotals,
    donationsCount: typeof data.donationsCount === 'number' ? data.donationsCount : 0,
    isDeleted: data.isDeleted === true,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export function normalizeBagItem(id: string, data: Record<string, unknown>): BagItem {
  return {
    id,
    storeItemId: asString(data.storeItemId),
    supplierId: asString(data.supplierId),
    supplierName: asString(data.supplierName),
    name: asBilingual(data.name),
    imagePublicId: typeof data.imagePublicId === 'string' ? data.imagePublicId : null,
    unitPriceMinor: typeof data.unitPriceMinor === 'number' ? data.unitPriceMinor : 0,
    quantity: typeof data.quantity === 'number' ? data.quantity : 1,
    addedBy: asString(data.addedBy),
  };
}

export function normalizeBagChange(id: string, data: Record<string, unknown>): BagChange {
  const type = BAG_CHANGE_TYPES.includes(data.type as BagChangeType)
    ? (data.type as BagChangeType)
    : 'meta';
  return {
    id,
    actorId: asString(data.actorId),
    actorName: asString(data.actorName),
    actorAvatarPublicId: typeof data.actorAvatarPublicId === 'string' ? data.actorAvatarPublicId : null,
    type,
    itemId: typeof data.itemId === 'string' ? data.itemId : null,
    itemName: typeof data.itemName === 'string' ? data.itemName : null,
    before: data.before ?? null,
    after: data.after ?? null,
    priceDeltaMinor: typeof data.priceDeltaMinor === 'number' ? data.priceDeltaMinor : 0,
    version: typeof data.version === 'number' ? data.version : 0,
    createdAt: toMillis(data.createdAt),
  };
}

export function normalizeParticipant(uid: string, data: Record<string, unknown>): BagParticipant {
  return {
    uid,
    token: asString(data.token),
    lastSeenVersion: typeof data.lastSeenVersion === 'number' ? data.lastSeenVersion : 0,
    joinedAt: toMillis(data.joinedAt),
  };
}
