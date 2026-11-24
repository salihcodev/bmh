import * as Crypto from 'expo-crypto';
import { increment, serverTimestamp, writeBatch } from '@react-native-firebase/firestore';

import {
  bagTotalsFromItems,
  cartLinesToBagItems,
  generateBagToken,
  type BagAccessMode,
  type BagChangeType,
  type BagItem,
} from '@/domain/bag';
import type { CartLine } from '@/domain/cart';
import { db } from '@/services/firebase/client';
import { newId, refs, type Actor } from '@/services/firebase/refs';
import { commitOnline } from '@/services/firebase/write';
import { audit } from '@/services/admin/admin-writes';

function randomBytes(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

function changeDoc(
  batch: ReturnType<typeof writeBatch>,
  bagId: string,
  actor: Actor,
  input: {
    type: BagChangeType;
    version: number;
    itemId?: string | null;
    itemName?: string | null;
    before?: unknown;
    after?: unknown;
    priceDeltaMinor?: number;
  },
) {
  const id = newId(refs.bagChanges(bagId));
  batch.set(refs.bagChange(bagId, id), {
    actorId: actor.uid,
    actorName: actor.name,
    actorAvatarPublicId: actor.avatarPublicId ?? null,
    type: input.type,
    itemId: input.itemId ?? null,
    itemName: input.itemName ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    priceDeltaMinor: input.priceDeltaMinor ?? 0,
    version: input.version,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function createBagFromCart(
  actor: Actor,
  input: {
    name: string;
    note?: string;
    lines: CartLine[];
    isPublic?: boolean;
    accessMode?: BagAccessMode;
    workspaceId?: string | null;
  },
): Promise<{ bagId: string; token: string }> {
  if (input.lines.length === 0) throw new Error('Cart is empty');
  if (input.lines.length > 100) throw new Error('A bag can hold at most 100 items');

  const bagId = newId(refs.bags());
  const token = generateBagToken(randomBytes);
  const items = cartLinesToBagItems(input.lines, actor.uid);
  const totals = bagTotalsFromItems(items.map((item, i) => ({ ...item, id: `tmp-${i}` })));
  const batch = writeBatch(db);

  batch.set(refs.bag(bagId), {
    name: input.name.trim().slice(0, 120),
    note: (input.note ?? '').trim().slice(0, 2000),
    coverPublicId: null,
    creatorId: actor.uid,
    creatorName: actor.name,
    workspaceId: input.workspaceId ?? null,
    isPublic: input.isPublic === true,
    accessMode: input.accessMode ?? 'collaborative',
    linkToken: token,
    status: 'active',
    version: 1,
    itemsCount: totals.itemsCount,
    totalMinor: totals.totalMinor,
    currency: 'EGP',
    supplierTotals: totals.supplierTotals,
    donationsCount: 0,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(refs.bagLink(token), {
    bagId,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  batch.set(refs.bagVersion(bagId, 1), {
    version: 1,
    items,
    totalMinor: totals.totalMinor,
    itemsCount: totals.itemsCount,
    supplierTotals: totals.supplierTotals,
    note: (input.note ?? '').trim().slice(0, 2000),
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
  });

  for (const item of items) {
    const itemId = newId(refs.bagItems(bagId));
    batch.set(refs.bagItem(bagId, itemId), {
      ...item,
      updatedAt: serverTimestamp(),
    });
    batch.update(refs.storeItem(item.storeItemId), {
      bagsCount: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }

  changeDoc(batch, bagId, actor, {
    type: 'meta',
    version: 1,
    after: { created: true },
  });
  audit(batch, actor, 'bag_created', 'bag', bagId, {}, { targetName: input.name });
  await commitOnline(batch);
  return { bagId, token };
}

export async function joinBagByToken(actor: Actor, bagId: string, token: string) {
  const batch = writeBatch(db);
  batch.set(refs.bagParticipant(bagId, actor.uid), {
    token,
    lastSeenVersion: 0,
    joinedAt: serverTimestamp(),
  });
  await commitOnline(batch);
}

export async function markBagSeen(actor: Actor, bagId: string, version: number) {
  const batch = writeBatch(db);
  batch.update(refs.bagParticipant(bagId, actor.uid), { lastSeenVersion: version });
  await commitOnline(batch);
}

export async function updateBagMeta(
  actor: Actor,
  bagId: string,
  patch: {
    name?: string;
    note?: string;
    isPublic?: boolean;
    accessMode?: BagAccessMode;
    workspaceId?: string | null;
  },
  currentVersion: number,
) {
  const nextVersion = currentVersion + 1;
  const batch = writeBatch(db);
  const fields: Record<string, unknown> = {
    version: nextVersion,
    updatedAt: serverTimestamp(),
  };
  if (patch.name != null) fields.name = patch.name.trim().slice(0, 120);
  if (patch.note != null) fields.note = patch.note.trim().slice(0, 2000);
  if (patch.isPublic != null) fields.isPublic = patch.isPublic;
  if (patch.accessMode != null) fields.accessMode = patch.accessMode;
  if (patch.workspaceId !== undefined) fields.workspaceId = patch.workspaceId;
  batch.update(refs.bag(bagId), fields);
  changeDoc(batch, bagId, actor, {
    type: patch.note != null && Object.keys(patch).length === 1 ? 'note' : 'meta',
    version: nextVersion,
    before: null,
    after: patch,
  });
  audit(batch, actor, 'bag_updated', 'bag', bagId);
  await commitOnline(batch);
}

export async function setBagItemQuantity(
  actor: Actor,
  bagId: string,
  item: BagItem,
  quantity: number,
  current: { version: number; items: BagItem[] },
) {
  const nextQty = Math.max(0, Math.min(999, Math.floor(quantity)));
  const nextVersion = current.version + 1;
  const nextItems =
    nextQty <= 0
      ? current.items.filter((i) => i.id !== item.id)
      : current.items.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i));
  const totals = bagTotalsFromItems(nextItems);
  const batch = writeBatch(db);
  batch.update(refs.bag(bagId), {
    version: nextVersion,
    itemsCount: totals.itemsCount,
    totalMinor: totals.totalMinor,
    supplierTotals: totals.supplierTotals,
    updatedAt: serverTimestamp(),
  });
  if (nextQty <= 0) {
    batch.delete(refs.bagItem(bagId, item.id));
    changeDoc(batch, bagId, actor, {
      type: 'item-removed',
      version: nextVersion,
      itemId: item.id,
      itemName: item.name.en || item.name.ar,
      before: item.quantity,
      after: null,
      priceDeltaMinor: -(item.unitPriceMinor * item.quantity),
    });
  } else {
    batch.update(refs.bagItem(bagId, item.id), {
      quantity: nextQty,
      updatedAt: serverTimestamp(),
    });
    changeDoc(batch, bagId, actor, {
      type: 'quantity',
      version: nextVersion,
      itemId: item.id,
      itemName: item.name.en || item.name.ar,
      before: item.quantity,
      after: nextQty,
      priceDeltaMinor: item.unitPriceMinor * (nextQty - item.quantity),
    });
  }
  await commitOnline(batch);
}

export async function addBagItem(
  actor: Actor,
  bagId: string,
  line: Omit<BagItem, 'id' | 'addedBy'>,
  current: { version: number; items: BagItem[] },
) {
  if (current.items.length >= 100) throw new Error('A bag can hold at most 100 items');
  const nextVersion = current.version + 1;
  const itemId = newId(refs.bagItems(bagId));
  const item: BagItem = { ...line, id: itemId, addedBy: actor.uid };
  const nextItems = [...current.items, item];
  const totals = bagTotalsFromItems(nextItems);
  const batch = writeBatch(db);
  batch.set(refs.bagItem(bagId, itemId), {
    storeItemId: item.storeItemId,
    supplierId: item.supplierId,
    supplierName: item.supplierName,
    name: item.name,
    imagePublicId: item.imagePublicId,
    unitPriceMinor: item.unitPriceMinor,
    quantity: item.quantity,
    addedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  batch.update(refs.bag(bagId), {
    version: nextVersion,
    itemsCount: totals.itemsCount,
    totalMinor: totals.totalMinor,
    supplierTotals: totals.supplierTotals,
    updatedAt: serverTimestamp(),
  });
  batch.update(refs.storeItem(item.storeItemId), {
    bagsCount: increment(1),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  changeDoc(batch, bagId, actor, {
    type: 'item-added',
    version: nextVersion,
    itemId,
    itemName: item.name.en || item.name.ar,
    before: null,
    after: item.quantity,
    priceDeltaMinor: item.unitPriceMinor * item.quantity,
  });
  await commitOnline(batch);
}

export async function regenerateBagLink(actor: Actor, bagId: string, oldToken: string) {
  const token = generateBagToken(randomBytes);
  const batch = writeBatch(db);
  batch.update(refs.bagLink(oldToken), { isActive: false });
  batch.set(refs.bagLink(token), {
    bagId,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  batch.update(refs.bag(bagId), {
    linkToken: token,
    updatedAt: serverTimestamp(),
  });
  audit(batch, actor, 'bag_link_regenerated', 'bag', bagId);
  await commitOnline(batch);
  return token;
}

export async function softDeleteBag(actor: Actor, bagId: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.bag(bagId), {
    isDeleted: true,
    status: 'archived',
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  audit(batch, actor, 'bag_deleted', 'bag', bagId, {}, { targetName });
  await commitOnline(batch);
}

export async function restoreBagVersion(
  actor: Actor,
  bagId: string,
  snapshot: {
    version: number;
    items: Omit<BagItem, 'id'>[];
    totalMinor: number;
    itemsCount: number;
    supplierTotals: Record<string, number>;
    note: string;
  },
  currentItems: BagItem[],
  currentVersion: number,
) {
  const nextVersion = currentVersion + 1;
  const batch = writeBatch(db);
  for (const item of currentItems) {
    batch.delete(refs.bagItem(bagId, item.id));
  }
  const restored: BagItem[] = [];
  for (const item of snapshot.items) {
    const itemId = newId(refs.bagItems(bagId));
    restored.push({ ...item, id: itemId });
    batch.set(refs.bagItem(bagId, itemId), {
      ...item,
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(refs.bag(bagId), {
    version: nextVersion,
    note: snapshot.note,
    itemsCount: snapshot.itemsCount,
    totalMinor: snapshot.totalMinor,
    supplierTotals: snapshot.supplierTotals,
    updatedAt: serverTimestamp(),
  });
  batch.set(refs.bagVersion(bagId, nextVersion), {
    version: nextVersion,
    items: snapshot.items,
    totalMinor: snapshot.totalMinor,
    itemsCount: snapshot.itemsCount,
    supplierTotals: snapshot.supplierTotals,
    note: snapshot.note,
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
  });
  changeDoc(batch, bagId, actor, {
    type: 'restore',
    version: nextVersion,
    before: currentVersion,
    after: snapshot.version,
  });
  await commitOnline(batch);
  return restored;
}

/** Attach a bag to a beneficiary via an assistance record and bump donation counters. */
export async function assignBagToBeneficiary(
  actor: Actor,
  input: {
    wid: string;
    beneficiaryId: string;
    bagId: string;
    bagName: string;
    supplierIds: string[];
    sessionId?: string | null;
    description?: string;
  },
) {
  const batch = writeBatch(db);
  const assistanceId = newId(refs.assistance(input.wid, input.beneficiaryId));
  batch.set(refs.assistanceRecord(input.wid, input.beneficiaryId, assistanceId), {
    workspaceId: input.wid,
    beneficiaryId: input.beneficiaryId,
    type: 'bag',
    description: input.description?.trim().slice(0, 500) || input.bagName,
    sessionId: input.sessionId ?? null,
    bagId: input.bagId,
    deliveredAt: serverTimestamp(),
    recordedBy: actor.uid,
    recordedByName: actor.name,
    notes: null,
    confirmationStatus: 'unconfirmed',
    confirmedAt: null,
    confirmedBy: null,
    createdAt: serverTimestamp(),
  });
  batch.update(refs.bag(input.bagId), {
    donationsCount: increment(1),
    workspaceId: input.wid,
    updatedAt: serverTimestamp(),
  });
  for (const sid of [...new Set(input.supplierIds)]) {
    batch.update(refs.supplier(sid), {
      bagsDonatedCount: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  await commitOnline(batch);
  return assistanceId;
}
