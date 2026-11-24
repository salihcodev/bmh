import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';

import {
  as,
  MODERATOR,
  seed,
  seedStaff,
  seedSuperAdmin,
  setupRulesEnv,
  SUPER,
  userDoc,
} from './helpers';

const t = setupRulesEnv();

const SUPPLIER = 'supplier1';
const BUYER = 'buyer1';

function category(level: 1 | 2, parentId: string | null, overrides: Record<string, unknown> = {}) {
  return {
    parentId,
    level,
    name: { ar: 'فئة', en: 'Cat' },
    iconPublicId: null,
    order: 0,
    isActive: true,
    itemsCount: 0,
    isDeleted: false,
    createdAt: Timestamp.now(),
    createdBy: MODERATOR,
    ...overrides,
  };
}

function supplierProfile(name = 'Supplier') {
  return {
    name,
    nameSearch: name.toLowerCase(),
    bio: { ar: '', en: '' },
    logoPublicId: null,
    coverPublicId: null,
    categoryIds: [],
    serviceArea: '',
    contacts: {},
    isVerified: false,
    status: 'active',
    itemsCount: 0,
    ratingSum: 0,
    ratingCount: 0,
    bagsDonatedCount: 0,
    isDeleted: false,
    createdAt: Timestamp.now(),
    createdBy: MODERATOR,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: SUPPLIER,
    supplierName: 'Supplier',
    categoryId: 'cat1',
    subCategoryId: 'sub1',
    name: { ar: 'منتج', en: 'Item' },
    nameSearch: 'item',
    description: { ar: '', en: '' },
    imagePublicIds: [],
    priceMinor: 1000,
    currency: 'EGP',
    unit: 'kg',
    stock: null,
    isAvailable: true,
    status: 'active',
    bagsCount: 0,
    isDeleted: false,
    createdAt: Timestamp.now(),
    createdBy: SUPPLIER,
    ...overrides,
  };
}

beforeEach(async () => {
  await seedSuperAdmin(t.env);
  await seedStaff(t.env);
  await seed(t.env, {
    [`users/${SUPPLIER}`]: userDoc('Supplier', { userType: 'supplier', supplierStatus: 'approved' }),
    [`users/${BUYER}`]: userDoc('Buyer'),
    'storeCategories/cat1': category(1, null),
    'storeCategories/sub1': category(2, 'cat1'),
    [`suppliers/${SUPPLIER}`]: supplierProfile(),
  });
});

describe('store categories', () => {
  it('signed-in users read active categories; staff create and soft-delete', async () => {
    await assertSucceeds(getDoc(doc(as(t.env, BUYER), 'storeCategories/cat1')));
    await assertSucceeds(
      setDoc(doc(as(t.env, MODERATOR), 'storeCategories/cat2'), {
        ...category(1, null),
        createdAt: serverTimestamp(),
        createdBy: MODERATOR,
      }),
    );
    await assertFails(
      setDoc(doc(as(t.env, BUYER), 'storeCategories/cat3'), {
        ...category(1, null),
        createdAt: serverTimestamp(),
        createdBy: BUYER,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(t.env, MODERATOR), 'storeCategories/cat1'), {
        isDeleted: true,
        isActive: false,
        deletedAt: serverTimestamp(),
        deletedBy: MODERATOR,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('rejects a level-2 category whose parent is missing or not level 1', async () => {
    await assertFails(
      setDoc(doc(as(t.env, MODERATOR), 'storeCategories/bad'), {
        ...category(2, 'missing'),
        createdAt: serverTimestamp(),
        createdBy: MODERATOR,
      }),
    );
  });
});

describe('store items', () => {
  it('supplier owns items; sub-category must match parent category', async () => {
    await assertSucceeds(
      setDoc(doc(as(t.env, SUPPLIER), 'storeItems/i1'), {
        ...item(),
        createdAt: serverTimestamp(),
        createdBy: SUPPLIER,
      }),
    );
    await assertFails(
      setDoc(doc(as(t.env, SUPPLIER), 'storeItems/i2'), {
        ...item({ categoryId: 'cat1', subCategoryId: 'cat1' }),
        createdAt: serverTimestamp(),
        createdBy: SUPPLIER,
      }),
    );
    await assertFails(
      setDoc(doc(as(t.env, BUYER), 'storeItems/i3'), {
        ...item({ supplierId: BUYER }),
        createdAt: serverTimestamp(),
        createdBy: BUYER,
      }),
    );
  });

  it('active items are readable; drafts need store-items.view or the owner', async () => {
    await seed(t.env, {
      'storeItems/pub': item({ status: 'active' }),
      'storeItems/draft': item({ status: 'draft' }),
    });
    await assertSucceeds(getDoc(doc(as(t.env, BUYER), 'storeItems/pub')));
    await assertFails(getDoc(doc(as(t.env, BUYER), 'storeItems/draft')));
    await assertSucceeds(getDoc(doc(as(t.env, SUPPLIER), 'storeItems/draft')));
    await assertSucceeds(getDoc(doc(as(t.env, MODERATOR), 'storeItems/draft')));
  });
});

describe('reviews', () => {
  it('one review per user, no self-review, counters move with the rating', async () => {
    const db = as(t.env, BUYER);
    const batch = writeBatch(db);
    batch.set(doc(db, `suppliers/${SUPPLIER}/reviews/${BUYER}`), {
      rating: 5,
      text: 'great',
      reviewerName: 'Buyer',
      reviewerAvatarPublicId: null,
      isHidden: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, `suppliers/${SUPPLIER}`), {
      ratingSum: 5,
      ratingCount: 1,
      updatedAt: serverTimestamp(),
      updatedBy: BUYER,
    });
    await assertSucceeds(batch.commit());

    const supplierDb = as(t.env, SUPPLIER);
    const self = writeBatch(supplierDb);
    self.set(doc(supplierDb, `suppliers/${SUPPLIER}/reviews/${SUPPLIER}`), {
      rating: 5,
      text: 'me',
      reviewerName: 'Supplier',
      isHidden: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    self.update(doc(supplierDb, `suppliers/${SUPPLIER}`), {
      ratingSum: 10,
      ratingCount: 2,
      updatedAt: serverTimestamp(),
      updatedBy: SUPPLIER,
    });
    await assertFails(self.commit());
  });

  it('rejects a review that does not bump rating counters', async () => {
    const db = as(t.env, BUYER);
    await assertFails(
      setDoc(doc(db, `suppliers/${SUPPLIER}/reviews/${BUYER}`), {
        rating: 4,
        text: '',
        reviewerName: 'Buyer',
        isHidden: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('supplier approval creates profile', () => {
  it('approve batch must create suppliers/{uid}', async () => {
    await seed(t.env, {
      'users/alice': userDoc('Alice', { supplierStatus: 'pending' }),
      'supplierRequests/alice': {
        userId: 'alice',
        displayName: 'Alice',
        email: 'alice@x.com',
        message: 'hi',
        status: 'pending',
        createdAt: Timestamp.now(),
      },
    });
    const db = as(t.env, MODERATOR);
    const bad = writeBatch(db);
    bad.update(doc(db, 'supplierRequests/alice'), {
      status: 'approved',
      reason: null,
      reviewedBy: MODERATOR,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    bad.update(doc(db, 'users/alice'), {
      supplierStatus: 'approved',
      userType: 'supplier',
      updatedAt: serverTimestamp(),
    });
    await assertFails(bad.commit());

    const ok = writeBatch(db);
    ok.update(doc(db, 'supplierRequests/alice'), {
      status: 'approved',
      reason: null,
      reviewedBy: MODERATOR,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    ok.update(doc(db, 'users/alice'), {
      supplierStatus: 'approved',
      userType: 'supplier',
      updatedAt: serverTimestamp(),
    });
    ok.set(doc(db, 'suppliers/alice'), {
      ...supplierProfile('Alice'),
      createdAt: serverTimestamp(),
      createdBy: MODERATOR,
    });
    await assertSucceeds(ok.commit());
  });
});

describe('supplier self-bootstrap', () => {
  const orphan = 'supplier-orphan';

  it('approved supplier may create their own missing profile', async () => {
    await seed(t.env, {
      [`users/${orphan}`]: userDoc('Orphan', {
        userType: 'supplier',
        supplierStatus: 'approved',
      }),
    });
    await assertSucceeds(
      setDoc(doc(as(t.env, orphan), `suppliers/${orphan}`), {
        ...supplierProfile('Orphan'),
        createdAt: serverTimestamp(),
        createdBy: orphan,
      }),
    );
  });

  it('supplier cannot create another supplier profile', async () => {
    await seed(t.env, {
      [`users/${orphan}`]: userDoc('Orphan', {
        userType: 'supplier',
        supplierStatus: 'approved',
      }),
      'users/other': userDoc('Other', { userType: 'supplier', supplierStatus: 'approved' }),
    });
    await assertFails(
      setDoc(doc(as(t.env, orphan), 'suppliers/other'), {
        ...supplierProfile('Other'),
        createdAt: serverTimestamp(),
        createdBy: orphan,
      }),
    );
  });
});

describe('supplier profile edits', () => {
  it('owner edits own profile; only suppliers.verify flips the badge', async () => {
    await assertSucceeds(
      updateDoc(doc(as(t.env, SUPPLIER), `suppliers/${SUPPLIER}`), {
        name: 'New name',
        nameSearch: 'new name',
        updatedAt: serverTimestamp(),
        updatedBy: SUPPLIER,
      }),
    );
    await assertFails(
      updateDoc(doc(as(t.env, SUPPLIER), `suppliers/${SUPPLIER}`), {
        isVerified: true,
        updatedAt: serverTimestamp(),
        updatedBy: SUPPLIER,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(t.env, SUPER), `suppliers/${SUPPLIER}`), {
        isVerified: true,
        updatedAt: serverTimestamp(),
        updatedBy: SUPER,
      }),
    );
  });
});
