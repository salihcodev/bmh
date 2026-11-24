import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';

import { as, MODERATOR, seed, seedStaff, seedSuperAdmin, setupRulesEnv, SUPER, SUPPORT, userDoc } from './helpers';

const t = setupRulesEnv();

const DEVICE = 'dev123abc';
const ID = `alice_${DEVICE}`;

const health = (overrides: Record<string, unknown> = {}) => ({
  uid: 'alice',
  deviceId: DEVICE,
  platform: 'android',
  appVersion: '1.0.0',
  pending: 3,
  failed: 0,
  oldestPendingAt: Date.now() - 60_000,
  lastSyncAt: Date.now(),
  updatedAt: serverTimestamp(),
  ...overrides,
});

beforeEach(async () => {
  await seedSuperAdmin(t.env);
  await seedStaff(t.env);
  await seed(t.env, { 'users/alice': userDoc('Alice'), 'users/bob': userDoc('Bob') });
});

describe('syncHealth', () => {
  it('a user writes only their own device summary', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(setDoc(doc(db, `syncHealth/${ID}`), health()));
    await assertFails(setDoc(doc(db, `syncHealth/bob_${DEVICE}`), health({ uid: 'bob' })));
    await assertFails(setDoc(doc(db, `syncHealth/${ID}`), health({ uid: 'bob' })));
  });

  it('the document id must be uid_deviceId', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'syncHealth/anything'), health()));
    await assertFails(setDoc(doc(db, `syncHealth/alice_other1234`), health()));
  });

  it('rejects unknown fields, bad counts and a client-chosen update time', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, `syncHealth/${ID}`), health({ payload: 'secret' })));
    await assertFails(setDoc(doc(db, `syncHealth/${ID}`), health({ pending: -1 })));
    await assertFails(setDoc(doc(db, `syncHealth/${ID}`), health({ failed: 'many' })));
    await assertFails(setDoc(doc(db, `syncHealth/${ID}`), health({ platform: 'toaster' })));
    await assertFails(setDoc(doc(db, `syncHealth/${ID}`), health({ updatedAt: Timestamp.now() })));
  });

  it('a suspended user cannot write', async () => {
    await seed(t.env, { 'users/alice': userDoc('Alice', { status: 'suspended' }) });
    await assertFails(setDoc(doc(as(t.env, 'alice'), `syncHealth/${ID}`), health()));
  });

  it('updates are limited to one per 30 seconds', async () => {
    await seed(t.env, { [`syncHealth/${ID}`]: { ...health(), updatedAt: Timestamp.now() } });
    await assertFails(setDoc(doc(as(t.env, 'alice'), `syncHealth/${ID}`), health({ pending: 9 })));
    await seed(t.env, { [`syncHealth/${ID}`]: { ...health(), updatedAt: Timestamp.fromMillis(Date.now() - 120_000) } });
    await assertSucceeds(setDoc(doc(as(t.env, 'alice'), `syncHealth/${ID}`), health({ pending: 9 })));
  });

  it('only sync-queue.view reads (owner and moderator), not the device owner or support', async () => {
    await seed(t.env, { [`syncHealth/${ID}`]: { ...health(), updatedAt: Timestamp.now() } });
    await assertSucceeds(getDoc(doc(as(t.env, SUPER), `syncHealth/${ID}`)));
    await assertSucceeds(getDocs(collection(as(t.env, SUPER), 'syncHealth')));
    await assertFails(getDoc(doc(as(t.env, 'alice'), `syncHealth/${ID}`)));
    await assertSucceeds(getDoc(doc(as(t.env, MODERATOR), `syncHealth/${ID}`)));
    await assertFails(getDoc(doc(as(t.env, SUPPORT), `syncHealth/${ID}`)));
  });

  it('only sync-queue.manage deletes', async () => {
    await seed(t.env, { [`syncHealth/${ID}`]: { ...health(), updatedAt: Timestamp.now() } });
    await assertFails(deleteDoc(doc(as(t.env, 'alice'), `syncHealth/${ID}`)));
    await assertFails(deleteDoc(doc(as(t.env, SUPPORT), `syncHealth/${ID}`)));
    await assertFails(deleteDoc(doc(as(t.env, MODERATOR), `syncHealth/${ID}`)));
    await assertSucceeds(deleteDoc(doc(as(t.env, SUPER), `syncHealth/${ID}`)));
  });
});
