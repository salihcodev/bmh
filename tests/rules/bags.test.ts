import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';

import { as, seed, seedStaff, seedSuperAdmin, setupRulesEnv, userDoc } from './helpers';

const t = setupRulesEnv();

const CREATOR = 'creator1';
const OTHER = 'other1';
const TOKEN = 'ABCDEFGHJKLMNPQRSTUVWXYZabcd12';
const TOKEN2 = 'ABCDEFGHJKLMNPQRSTUVWXYZabcd99';

function bag(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ramadan bag',
    note: '',
    coverPublicId: null,
    creatorId: CREATOR,
    creatorName: 'Creator',
    workspaceId: null,
    isPublic: false,
    accessMode: 'collaborative',
    linkToken: TOKEN,
    status: 'active',
    version: 1,
    itemsCount: 0,
    totalMinor: 0,
    currency: 'EGP',
    supplierTotals: {},
    donationsCount: 0,
    isDeleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  await seedSuperAdmin(t.env);
  await seedStaff(t.env);
  await seed(t.env, {
    [`users/${CREATOR}`]: userDoc('Creator'),
    [`users/${OTHER}`]: userDoc('Other'),
  });
});

describe('bags access', () => {
  it('creator reads; others need the link; list is never open', async () => {
    await seed(t.env, {
      'bags/b1': bag(),
      [`bagLinks/${TOKEN}`]: { bagId: 'b1', isActive: true, createdAt: Timestamp.now() },
    });
    await assertSucceeds(getDoc(doc(as(t.env, CREATOR), 'bags/b1')));
    await assertFails(getDoc(doc(as(t.env, OTHER), 'bags/b1')));
    await assertFails(getDocs(collection(as(t.env, OTHER), 'bags')));
    await assertSucceeds(getDoc(doc(as(t.env, OTHER), `bagLinks/${TOKEN}`)));
    await assertFails(getDocs(collection(as(t.env, OTHER), 'bagLinks')));
  });

  it('public Top 5 query is allowed', async () => {
    await seed(t.env, {
      'bags/p1': bag({ isPublic: true, donationsCount: 3 }),
      'bags/p2': bag({ isPublic: true, donationsCount: 1, linkToken: TOKEN2 }),
    });
    await assertSucceeds(
      getDocs(
        query(
          collection(as(t.env, OTHER), 'bags'),
          where('isPublic', '==', true),
          where('isDeleted', '==', false),
          orderBy('donationsCount', 'desc'),
          limit(5),
        ),
      ),
    );
  });

  it('link redemption joins as a participant; regenerating cuts the old token', async () => {
    await seed(t.env, {
      'bags/b1': bag(),
      [`bagLinks/${TOKEN}`]: { bagId: 'b1', isActive: true, createdAt: Timestamp.now() },
    });
    await assertSucceeds(
      setDoc(doc(as(t.env, OTHER), 'bags/b1/participants/other1'), {
        token: TOKEN,
        lastSeenVersion: 0,
        joinedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(as(t.env, OTHER), 'bags/b1')));

    await seed(t.env, {
      'bags/b1': bag({ linkToken: TOKEN2 }),
      [`bagLinks/${TOKEN}`]: { bagId: 'b1', isActive: false, createdAt: Timestamp.now() },
      [`bagLinks/${TOKEN2}`]: { bagId: 'b1', isActive: true, createdAt: Timestamp.now() },
      'bags/b1/participants/other1': { token: TOKEN, lastSeenVersion: 0, joinedAt: Timestamp.now() },
    });
    await assertFails(getDoc(doc(as(t.env, OTHER), 'bags/b1')));
  });
});

describe('bags edits', () => {
  it('collaborative participant can edit with a version bump and change log', async () => {
    await seed(t.env, {
      'bags/b1': bag({ accessMode: 'collaborative', itemsCount: 1, totalMinor: 500 }),
      [`bagLinks/${TOKEN}`]: { bagId: 'b1', isActive: true, createdAt: Timestamp.now() },
      'bags/b1/participants/other1': { token: TOKEN, lastSeenVersion: 0, joinedAt: Timestamp.now() },
      'bags/b1/items/i1': {
        storeItemId: 's1',
        supplierId: 'sup1',
        supplierName: 'S',
        name: { ar: 'أ', en: 'A' },
        imagePublicId: null,
        unitPriceMinor: 500,
        quantity: 1,
        addedBy: CREATOR,
        updatedAt: Timestamp.now(),
      },
    });

    const db = as(t.env, OTHER);
    const batch = writeBatch(db);
    batch.update(doc(db, 'bags/b1'), {
      version: 2,
      itemsCount: 1,
      totalMinor: 1000,
      supplierTotals: { sup1: 1000 },
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'bags/b1/items/i1'), {
      quantity: 2,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'bags/b1/changes/c1'), {
      actorId: OTHER,
      actorName: 'Other',
      actorAvatarPublicId: null,
      type: 'quantity',
      itemId: 'i1',
      itemName: 'A',
      before: 1,
      after: 2,
      priceDeltaMinor: 500,
      version: 2,
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('view-only participant cannot edit items', async () => {
    await seed(t.env, {
      'bags/b1': bag({ accessMode: 'view-only', itemsCount: 1, totalMinor: 500 }),
      [`bagLinks/${TOKEN}`]: { bagId: 'b1', isActive: true, createdAt: Timestamp.now() },
      'bags/b1/participants/other1': { token: TOKEN, lastSeenVersion: 0, joinedAt: Timestamp.now() },
      'bags/b1/items/i1': {
        storeItemId: 's1',
        supplierId: 'sup1',
        supplierName: 'S',
        name: { ar: 'أ', en: 'A' },
        unitPriceMinor: 500,
        quantity: 1,
        addedBy: CREATOR,
        updatedAt: Timestamp.now(),
      },
    });
    const db = as(t.env, OTHER);
    const batch = writeBatch(db);
    batch.update(doc(db, 'bags/b1'), { version: 2, updatedAt: serverTimestamp() });
    batch.update(doc(db, 'bags/b1/items/i1'), { quantity: 2, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'bags/b1/changes/c1'), {
      actorId: OTHER,
      actorName: 'Other',
      type: 'quantity',
      itemId: 'i1',
      itemName: 'A',
      before: 1,
      after: 2,
      priceDeltaMinor: 500,
      version: 2,
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('create bag with link and first version in one batch', async () => {
    const db = as(t.env, CREATOR);
    const batch = writeBatch(db);
    batch.set(doc(db, 'bags/new1'), {
      ...bag({ linkToken: TOKEN2 }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, `bagLinks/${TOKEN2}`), {
      bagId: 'new1',
      isActive: true,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'bags/new1/versions/1'), {
      version: 1,
      items: [],
      totalMinor: 0,
      itemsCount: 0,
      supplierTotals: {},
      note: '',
      createdAt: serverTimestamp(),
      createdBy: CREATOR,
    });
    batch.set(doc(db, 'bags/new1/changes/c0'), {
      actorId: CREATOR,
      actorName: 'Creator',
      actorAvatarPublicId: null,
      type: 'meta',
      itemId: null,
      itemName: null,
      before: null,
      after: { created: true },
      priceDeltaMinor: 0,
      version: 1,
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });
});
