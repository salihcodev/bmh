import { increment, serverTimestamp, writeBatch } from '@react-native-firebase/firestore';

import {
  buildCategoryWrite,
  buildItemWrite,
  type StoreCategoryPayload,
  type StoreConfig,
  type StoreItemPayload,
} from '@/domain/store';
import {
  buildSupplierPayload,
  emptySupplierProfile,
  type SupplierProfilePayload,
} from '@/domain/supplier-profile';
import { buildReviewWrite, type ReviewPayload } from '@/domain/review';
import { db } from '@/services/firebase/client';
import { newId, refs, type Actor } from '@/services/firebase/refs';
import { commitOnline } from '@/services/firebase/write';
import { audit } from '@/services/admin/admin-writes';

const SOFT_DELETE = (actor: Actor) => ({
  isDeleted: true,
  deletedAt: serverTimestamp(),
  deletedBy: actor.uid,
  updatedAt: serverTimestamp(),
  updatedBy: actor.uid,
});

export async function saveStoreCategory(actor: Actor, id: string | null, input: StoreCategoryPayload): Promise<string> {
  const categoryId = id ?? newId(refs.storeCategories());
  const batch = writeBatch(db);
  const payload = buildCategoryWrite(input);
  if (id) {
    batch.update(refs.storeCategory(categoryId), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  } else {
    batch.set(refs.storeCategory(categoryId), {
      ...payload,
      itemsCount: 0,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, id ? 'store_category_updated' : 'store_category_created', 'storeCategory', categoryId, {}, {
    targetName: input.name.en || input.name.ar,
  });
  await commitOnline(batch);
  return categoryId;
}

export async function deleteStoreCategory(actor: Actor, id: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.storeCategory(id), { ...SOFT_DELETE(actor), isActive: false });
  audit(batch, actor, 'store_category_deleted', 'storeCategory', id, {}, { targetName });
  await commitOnline(batch);
}

export async function saveStoreItem(actor: Actor, id: string | null, input: StoreItemPayload): Promise<string> {
  const itemId = id ?? newId(refs.storeItems());
  const batch = writeBatch(db);
  const payload = buildItemWrite(input);
  if (id) {
    batch.update(refs.storeItem(itemId), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  } else {
    batch.set(refs.storeItem(itemId), {
      ...payload,
      bagsCount: 0,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
    batch.update(refs.supplier(input.supplierId), {
      itemsCount: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, id ? 'store_item_updated' : 'store_item_created', 'storeItem', itemId, {}, {
    targetName: input.name.en || input.name.ar,
  });
  await commitOnline(batch);
  return itemId;
}

export async function deleteStoreItem(actor: Actor, id: string, supplierId: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.storeItem(id), { ...SOFT_DELETE(actor), status: 'hidden', isAvailable: false });
  batch.update(refs.supplier(supplierId), {
    itemsCount: increment(-1),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, 'store_item_deleted', 'storeItem', id, {}, { targetName });
  await commitOnline(batch);
}

export async function saveSupplierProfile(
  actor: Actor,
  sid: string,
  input: SupplierProfilePayload,
  opts: { create?: boolean } = {},
) {
  const batch = writeBatch(db);
  const payload = buildSupplierPayload(input);
  if (opts.create) {
    // Self-bootstrap: no admin audit (supplier cannot write adminAuditLog).
    batch.set(refs.supplier(sid), {
      ...emptySupplierProfile(payload.name),
      ...payload,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  } else {
    batch.update(refs.supplier(sid), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
    audit(batch, actor, 'supplier_updated', 'supplier', sid, {}, { targetName: input.name });
  }
  await commitOnline(batch);
}

export async function setSupplierVerified(actor: Actor, sid: string, verified: boolean, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.supplier(sid), {
    isVerified: verified,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, verified ? 'supplier_verified' : 'supplier_unverified', 'supplier', sid, {}, { targetName });
  await commitOnline(batch);
}

export async function deleteSupplierProfile(actor: Actor, sid: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.supplier(sid), { ...SOFT_DELETE(actor), status: 'hidden' });
  audit(batch, actor, 'supplier_deleted', 'supplier', sid, {}, { targetName });
  await commitOnline(batch);
}

export async function saveReview(
  actor: Actor,
  supplierId: string,
  input: ReviewPayload,
  previousRating: number | null,
) {
  const batch = writeBatch(db);
  const payload = buildReviewWrite(input);
  const ref = refs.supplierReview(supplierId, actor.uid);
  if (previousRating == null) {
    batch.set(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(refs.supplier(supplierId), {
      ratingSum: increment(payload.rating),
      ratingCount: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  } else {
    batch.update(ref, { ...payload, updatedAt: serverTimestamp() });
    batch.update(refs.supplier(supplierId), {
      ratingSum: increment(payload.rating - previousRating),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, previousRating == null ? 'review_created' : 'review_updated', 'review', `${supplierId}_${actor.uid}`);
  await commitOnline(batch);
}

export async function deleteReview(actor: Actor, supplierId: string, reviewerUid: string, rating: number) {
  const batch = writeBatch(db);
  batch.delete(refs.supplierReview(supplierId, reviewerUid));
  batch.update(refs.supplier(supplierId), {
    ratingSum: increment(-rating),
    ratingCount: increment(-1),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, 'review_deleted', 'review', `${supplierId}_${reviewerUid}`);
  await commitOnline(batch);
}

export async function setReviewHidden(
  actor: Actor,
  supplierId: string,
  reviewerUid: string,
  rating: number,
  hidden: boolean,
) {
  const batch = writeBatch(db);
  batch.update(refs.supplierReview(supplierId, reviewerUid), {
    isHidden: hidden,
    updatedAt: serverTimestamp(),
  });
  batch.update(refs.supplier(supplierId), {
    ratingSum: increment(hidden ? -rating : rating),
    ratingCount: increment(hidden ? -1 : 1),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, hidden ? 'review_hidden' : 'review_restored', 'review', `${supplierId}_${reviewerUid}`);
  await commitOnline(batch);
}

export async function saveStoreConfig(actor: Actor, config: StoreConfig) {
  const batch = writeBatch(db);
  batch.set(
    refs.appConfig('store'),
    {
      popularItemsCount: config.popularItemsCount,
      popularSuppliersCount: config.popularSuppliersCount,
      topBagsCount: config.topBagsCount,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    },
    { merge: true },
  );
  audit(batch, actor, 'store_config_updated', 'config', 'store');
  await commitOnline(batch);
}
