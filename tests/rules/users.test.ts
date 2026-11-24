import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { describe, it } from 'vitest';

import {
  as,
  MODERATOR,
  seed,
  seedStaff,
  seedSuperAdmin,
  setupRulesEnv,
  SUPER,
  SUPPORT,
  userDoc,
} from './helpers';

const t = setupRulesEnv();

function newProfile(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Alice',
    email: 'alice@x.com',
    locale: 'ar',
    userType: 'member',
    supplierStatus: 'none',
    status: 'active',
    isDeleted: false,
    schemaVersion: 3,
    onboarding: { step: 'intro', completedAt: null },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('users v3: self-service', () => {
  it('creates a v3 member profile', async () => {
    await assertSucceeds(setDoc(doc(as(t.env, 'alice'), 'users/alice'), newProfile()));
  });

  it('cannot self-assign a system type, a role, supplier status, or a bad status', async () => {
    const db = as(t.env, 'alice');
    for (const userType of ['owner', 'support', 'moderator', 'custom', 'supplier']) {
      await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ userType })));
    }
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ systemRoleId: 'support' })));
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ supplierStatus: 'approved' })));
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ status: 'suspended' })));
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ isDeleted: true })));
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ schemaVersion: 2 })));
    const { userType: _omit, ...withoutType } = newProfile();
    await assertFails(setDoc(doc(db, 'users/alice'), withoutType));
  });

  it('cannot change own type, role, status, deletion, createdAt or email', async () => {
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, 'alice');
    await assertFails(updateDoc(doc(db, 'users/alice'), { userType: 'owner' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { systemRoleId: 'support' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'suspended' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { isDeleted: true }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { email: 'other@x.com' }));
    // supplierStatus only moves to pending together with the request doc.
    await assertFails(updateDoc(doc(db, 'users/alice'), { supplierStatus: 'pending' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { supplierStatus: 'approved' }));
  });

  it('updates profile fields and onboarding progress', async () => {
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, 'alice');
    await assertSucceeds(
      updateDoc(doc(db, 'users/alice'), {
        displayName: 'Alice B',
        phone: '+201001234567',
        themePreference: 'dark',
        onboarding: { step: 'workspace', completedAt: null },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { onboarding: { step: 'done', completedAt: serverTimestamp() } }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { onboarding: { step: 'hack', completedAt: null } }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { phone: '0100' }));
  });

  it('suspended and soft-deleted users cannot edit their profile', async () => {
    await seed(t.env, {
      'users/alice': userDoc('Alice', { status: 'suspended' }),
      'users/bob': userDoc('Bob', { isDeleted: true }),
    });
    await assertSucceeds(getDoc(doc(as(t.env, 'alice'), 'users/alice')));
    await assertFails(updateDoc(doc(as(t.env, 'alice'), 'users/alice'), { displayName: 'X' }));
    await assertFails(updateDoc(doc(as(t.env, 'bob'), 'users/bob'), { displayName: 'X' }));
  });

  it('users cannot read or list other profiles, and nobody hard-deletes', async () => {
    await seedSuperAdmin(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice'), 'users/bob': userDoc('Bob') });
    await assertFails(getDoc(doc(as(t.env, 'bob'), 'users/alice')));
    await assertFails(getDocs(collection(as(t.env, 'bob'), 'users')));
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(as(t.env, SUPER), 'users/alice')));
  });
});

describe('users v3: staff', () => {
  it('the owner reads, lists, suspends and soft-deletes users', async () => {
    await seedSuperAdmin(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, SUPER);
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { status: 'suspended', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { status: 'active' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { displayName: 'Renamed' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'banned' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { isDeleted: true }));
    await assertSucceeds(
      updateDoc(doc(db, 'users/alice'), { isDeleted: true, deletedAt: serverTimestamp(), deletedBy: SUPER }),
    );
  });

  it('nobody acts on the owner or on themself', async () => {
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    await seed(t.env, { 'users/other': userDoc('Other', { userType: 'owner' }) });
    await assertFails(updateDoc(doc(as(t.env, SUPER), 'users/other'), { status: 'suspended' }));
    await assertFails(updateDoc(doc(as(t.env, SUPER), `users/${SUPER}`), { status: 'suspended' }));
    await assertFails(updateDoc(doc(as(t.env, MODERATOR), `users/${SUPER}`), { status: 'suspended' }));
    await assertFails(updateDoc(doc(as(t.env, MODERATOR), `users/${MODERATOR}`), { status: 'suspended' }));
  });

  it('support reads users but cannot suspend; moderator can', async () => {
    await seedStaff(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    await assertSucceeds(getDoc(doc(as(t.env, SUPPORT), 'users/alice')));
    await assertFails(updateDoc(doc(as(t.env, SUPPORT), 'users/alice'), { status: 'suspended' }));
    await assertSucceeds(updateDoc(doc(as(t.env, MODERATOR), 'users/alice'), { status: 'suspended' }));
  });

  it('a suspended owner, or staff on a deleted role, has no platform powers', async () => {
    await seedSuperAdmin(t.env, 'suspended');
    await seedStaff(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    await assertFails(getDoc(doc(as(t.env, SUPER), 'users/alice')));
    await assertFails(updateDoc(doc(as(t.env, SUPER), 'users/alice'), { status: 'suspended' }));
    await seed(t.env, {
      'systemRoles/moderator': { name: { en: 'M', ar: 'م' }, permissions: ['users.view'], isLocked: false, isDeleted: true },
    });
    await assertFails(getDoc(doc(as(t.env, MODERATOR), 'users/alice')));
  });

  it('roles.assign only gives system roles the assigner fully holds', async () => {
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    await seed(t.env, {
      'users/alice': userDoc('Alice'),
      'users/lead': userDoc('Lead', { userType: 'custom', systemRoleId: 'lead' }),
      'systemRoles/lead': {
        name: { en: 'Lead', ar: 'قائد' },
        permissions: ['users.view', 'roles.assign', 'support-methods.view'],
        isLocked: false,
        isDeleted: false,
        createdAt: Timestamp.now(),
      },
      'systemRoles/tiny': {
        name: { en: 'Tiny', ar: 'صغير' },
        permissions: ['users.view'],
        isLocked: false,
        isDeleted: false,
        createdAt: Timestamp.now(),
      },
    });
    const owner = as(t.env, SUPER);
    const lead = as(t.env, 'lead');
    // The lead holds every key of `tiny`, but not of `support`; the locked owner role is never given.
    await assertSucceeds(updateDoc(doc(lead, 'users/alice'), { userType: 'custom', systemRoleId: 'tiny' }));
    await assertFails(updateDoc(doc(lead, 'users/alice'), { userType: 'support', systemRoleId: 'support' }));
    await assertFails(updateDoc(doc(owner, 'users/alice'), { userType: 'owner', systemRoleId: 'owner' }));
    await assertSucceeds(updateDoc(doc(owner, 'users/alice'), { userType: 'support', systemRoleId: 'support' }));
    // Taking a role away needs the same reach over the current one.
    await assertFails(updateDoc(doc(lead, 'users/alice'), { userType: 'member', systemRoleId: null }));
    await assertSucceeds(updateDoc(doc(owner, 'users/alice'), { userType: 'member', systemRoleId: null }));
  });

  it('staff read their own system role; members read none', async () => {
    await seedStaff(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    await assertSucceeds(getDoc(doc(as(t.env, SUPPORT), 'systemRoles/support')));
    await assertFails(getDoc(doc(as(t.env, SUPPORT), 'systemRoles/moderator')));
    await assertFails(getDoc(doc(as(t.env, 'alice'), 'systemRoles/support')));
  });
});

describe('supplier requests (USER-03)', () => {
  function ask(db: Firestore, uid: string, againAfterRejection = false) {
    const batch = writeBatch(db);
    if (againAfterRejection) {
      batch.update(doc(db, `supplierRequests/${uid}`), { status: 'pending', message: 'again', updatedAt: serverTimestamp() });
    } else {
      batch.set(doc(db, `supplierRequests/${uid}`), {
        userId: uid, displayName: uid, email: `${uid}@x.com`, message: 'hi', status: 'pending',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    batch.update(doc(db, `users/${uid}`), { supplierStatus: 'pending', updatedAt: serverTimestamp() });
    return batch.commit();
  }

  function review(db: Firestore, reviewer: string, uid: string, decision: 'approved' | 'rejected') {
    const batch = writeBatch(db);
    batch.update(doc(db, `supplierRequests/${uid}`), {
      status: decision, reason: null, reviewedBy: reviewer, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, `users/${uid}`), {
      supplierStatus: decision, ...(decision === 'approved' ? { userType: 'supplier' } : {}), updatedAt: serverTimestamp(),
    });
    if (decision === 'approved') {
      batch.set(doc(db, `suppliers/${uid}`), {
        name: uid,
        nameSearch: uid.toLowerCase(),
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
        createdAt: serverTimestamp(),
        createdBy: reviewer,
      });
    }
    return batch.commit();
  }

  it('a member asks with the request and the user doc in one batch', async () => {
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, 'alice');
    await assertFails(
      setDoc(doc(db, 'supplierRequests/alice'), {
        userId: 'alice', displayName: 'a', email: 'a@x.com', message: '', status: 'pending', createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(ask(db, 'alice'));
    await assertSucceeds(getDoc(doc(db, 'supplierRequests/alice')));
    await assertFails(getDoc(doc(as(t.env, 'bob'), 'supplierRequests/alice')));
  });

  it('staff cannot ask; a member cannot approve themself', async () => {
    await seedStaff(t.env);
    await assertFails(ask(as(t.env, SUPPORT), SUPPORT));
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    await assertSucceeds(ask(as(t.env, 'alice'), 'alice'));
    await assertFails(review(as(t.env, 'alice'), 'alice', 'alice', 'approved'));
  });

  it('suppliers.approve approves (user becomes supplier) or rejects; support cannot', async () => {
    await seedStaff(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice'), 'users/bob': userDoc('Bob') });
    await assertSucceeds(ask(as(t.env, 'alice'), 'alice'));
    await assertSucceeds(ask(as(t.env, 'bob'), 'bob'));
    await assertFails(review(as(t.env, SUPPORT), SUPPORT, 'alice', 'approved'));
    await assertSucceeds(getDocs(collection(as(t.env, MODERATOR), 'supplierRequests')));
    await assertSucceeds(review(as(t.env, MODERATOR), MODERATOR, 'alice', 'approved'));
    await assertSucceeds(review(as(t.env, MODERATOR), MODERATOR, 'bob', 'rejected'));
    // Rejected users may ask again; approved ones are done.
    await assertSucceeds(ask(as(t.env, 'bob'), 'bob', true));
    await assertFails(ask(as(t.env, 'alice'), 'alice', true));
  });

  it('a review must update both docs and match', async () => {
    await seedStaff(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    await assertSucceeds(ask(as(t.env, 'alice'), 'alice'));
    const db = as(t.env, MODERATOR);
    await assertFails(updateDoc(doc(db, 'users/alice'), { supplierStatus: 'approved', userType: 'supplier' }));
    await assertFails(
      updateDoc(doc(db, 'supplierRequests/alice'), {
        status: 'approved', reviewedBy: MODERATOR, reviewedAt: serverTimestamp(),
      }),
    );
  });
});
