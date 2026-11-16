import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';

import { as, seed, seedSuperAdmin, SUPER, userDoc, setupRulesEnv } from './helpers';

const t = setupRulesEnv();

function newProfile(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Alice',
    email: 'alice@x.com',
    locale: 'ar',
    globalRole: 'user',
    status: 'active',
    schemaVersion: 2,
    onboarding: { step: 'intro', completedAt: null },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('users v2: self-service', () => {
  it('creates a v2 profile with globalRole user and status active', async () => {
    await assertSucceeds(setDoc(doc(as(t.env, 'alice'), 'users/alice'), newProfile()));
  });

  it('cannot self-grant super admin or create a suspended/unknown status', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ globalRole: 'superadmin' })));
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ globalRole: 'moderator' })));
    await assertFails(setDoc(doc(db, 'users/alice'), newProfile({ status: 'suspended' })));
    const { globalRole: _omit, ...withoutRole } = newProfile();
    await assertFails(setDoc(doc(db, 'users/alice'), withoutRole));
  });

  it('cannot change own globalRole, status, createdAt or email', async () => {
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, 'alice');
    await assertFails(updateDoc(doc(db, 'users/alice'), { globalRole: 'superadmin' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'suspended' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { email: 'other@x.com' }));
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

  it('a suspended user cannot edit their profile', async () => {
    await seed(t.env, { 'users/alice': userDoc('Alice', { status: 'suspended' }) });
    await assertSucceeds(getDoc(doc(as(t.env, 'alice'), 'users/alice')));
    await assertFails(updateDoc(doc(as(t.env, 'alice'), 'users/alice'), { displayName: 'X' }));
  });

  it('users cannot read or list other profiles', async () => {
    await seed(t.env, { 'users/alice': userDoc('Alice'), 'users/bob': userDoc('Bob') });
    await assertFails(getDoc(doc(as(t.env, 'bob'), 'users/alice')));
    await assertFails(getDocs(collection(as(t.env, 'bob'), 'users')));
  });
});

describe('users v2: super admin', () => {
  it('reads and lists users', async () => {
    await seedSuperAdmin(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, SUPER);
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertSucceeds(getDocs(collection(db, 'users')));
  });

  it('changes only status (and updatedAt) of other users', async () => {
    await seedSuperAdmin(t.env);
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, SUPER);
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { status: 'suspended', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { status: 'active' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { globalRole: 'superadmin' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { displayName: 'Renamed' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'banned' }));
  });

  it('a suspended super admin has no platform powers', async () => {
    await seedSuperAdmin(t.env, 'suspended');
    await seed(t.env, { 'users/alice': userDoc('Alice') });
    const db = as(t.env, SUPER);
    await assertFails(getDoc(doc(db, 'users/alice')));
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'suspended' }));
  });
});
