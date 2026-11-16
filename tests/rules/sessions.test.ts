import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { describe, it } from 'vitest';

import { ADMIN, as, MEMBER, MEMBER_PERMS, OUTSIDER, seed, seedWorkspace, useRulesEnv, WID } from './helpers';

const t = useRulesEnv();
const W = `workspaces/${WID}`;
const RUNNER = { ...MEMBER_PERMS, sessions_create: true };

function sessionDoc(uid: string, count: number, overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: WID, name: 'S', cityId: 'c1', cityName: 'C', areaIds: ['a1'], areaNames: ['A'], status: 'active',
    createdBy: uid, operatorId: uid, startedBy: uid, startedAt: serverTimestamp(), beneficiaryCount: count,
    checkedCount: 0, ignoredCount: 0, pendingCount: count, contactActionsCount: 0, createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(), ...overrides,
  };
}

function item(bid: string, order: number) {
  return { beneficiaryId: bid, order, fullName: bid, status: 'pending', processedAt: null, processedBy: null, note: null };
}

function event(uid: string, type: string, sid = 's1') {
  return { workspaceId: WID, sessionId: sid, actorId: uid, actorName: uid, type, createdAt: serverTimestamp() };
}

function createBatch(db: Firestore, uid: string, count = 2, overrides: Record<string, unknown> = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, `${W}/sessions/s1`), sessionDoc(uid, count, overrides));
  for (let i = 0; i < count; i += 1) batch.set(doc(db, `${W}/sessions/s1/items/b${i}`), item(`b${i}`, i));
  batch.set(doc(db, `${W}/sessions/s1/events/e1`), event(uid, 'session_created'));
  batch.update(doc(db, W), { sessionCount: increment(1) });
  return batch.commit();
}

async function seedSession(operator = MEMBER, status = 'active') {
  await seed(t.env, {
    [`${W}/sessions/s1`]: { ...sessionDoc(operator, 2), status, createdAt: Timestamp.now(), startedAt: Timestamp.now(), updatedAt: Timestamp.now() },
    [`${W}/sessions/s1/items/b0`]: item('b0', 0),
    [`${W}/sessions/s1/items/b1`]: { ...item('b1', 1), status: 'ignored', processedAt: Timestamp.now(), processedBy: operator },
  });
}

describe('session creation', () => {
  it('creates session + snapshot items + event + counter in one batch', async () => {
    await seedWorkspace(t.env, RUNNER);
    await assertSucceeds(createBatch(as(t.env, MEMBER), MEMBER));
  });

  it('requires sessions_create, self as operator, zeroed counters, ≤100', async () => {
    await seedWorkspace(t.env);
    await assertFails(createBatch(as(t.env, MEMBER), MEMBER));
    await seedWorkspace(t.env, RUNNER);
    await assertFails(createBatch(as(t.env, MEMBER), MEMBER, 2, { operatorId: ADMIN }));
    await assertFails(createBatch(as(t.env, MEMBER), MEMBER, 2, { checkedCount: 1 }));
    await assertFails(createBatch(as(t.env, MEMBER), MEMBER, 2, { beneficiaryCount: 101 }));
    await assertFails(createBatch(as(t.env, MEMBER), MEMBER, 2, { status: 'ended' }));
  });

  it('items cannot be added after the session exists', async () => {
    await seedWorkspace(t.env, RUNNER);
    await seedSession();
    await assertFails(setDoc(doc(as(t.env, MEMBER), `${W}/sessions/s1/items/b9`), item('b9', 9)));
  });
});

describe('session runner', () => {
  const check = (db: Firestore, uid: string, bid: string, status: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, `${W}/sessions/s1/items/${bid}`), {
      status, processedAt: serverTimestamp(), processedBy: uid, processedClientAt: Timestamp.now(),
    });
    batch.update(doc(db, `${W}/sessions/s1`), {
      [status === 'checked' ? 'checkedCount' : 'ignoredCount']: increment(1), lastProcessedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, `${W}/sessions/s1/events`)), event(uid, status));
    return batch.commit();
  };

  it('operator checks pending items; others cannot', async () => {
    await seedWorkspace(t.env);
    await seedSession(MEMBER);
    await assertFails(check(as(t.env, OUTSIDER), OUTSIDER, 'b0', 'checked'));
    await assertSucceeds(check(as(t.env, MEMBER), MEMBER, 'b0', 'checked'));
    await assertFails(check(as(t.env, MEMBER), MEMBER, 'b0', 'ignored'));
  });

  it('a non-operator member without reassign cannot act', async () => {
    await seedWorkspace(t.env);
    await seedSession(ADMIN);
    await assertFails(check(as(t.env, MEMBER), MEMBER, 'b0', 'checked'));
  });

  it('only ignored -> pending reopen; checked is final', async () => {
    await seedWorkspace(t.env);
    await seedSession(MEMBER);
    const db = as(t.env, MEMBER);
    const reopen = (bid: string) =>
      updateDoc(doc(db, `${W}/sessions/s1/items/${bid}`), {
        status: 'pending', processedAt: null, processedBy: null, processedClientAt: null,
      });
    await assertSucceeds(reopen('b1'));
    await assertSucceeds(check(db, MEMBER, 'b0', 'checked'));
    await assertFails(reopen('b0'));
    await assertFails(deleteDoc(doc(db, `${W}/sessions/s1/items/b0`)));
  });

  it('counters cannot exceed beneficiaryCount', async () => {
    await seedWorkspace(t.env);
    await seedSession(MEMBER);
    await assertFails(updateDoc(doc(as(t.env, MEMBER), `${W}/sessions/s1`), { checkedCount: 3 }));
    await assertSucceeds(updateDoc(doc(as(t.env, MEMBER), `${W}/sessions/s1`), { contactActionsCount: increment(1) }));
  });

  it('ends once; ended sessions are immutable and never deleted', async () => {
    await seedWorkspace(t.env);
    await seedSession(MEMBER);
    const db = as(t.env, MEMBER);
    const batch = writeBatch(db);
    batch.update(doc(db, `${W}/sessions/s1`), {
      status: 'ended', endedAt: serverTimestamp(), endedBy: MEMBER, checkedCount: 0, ignoredCount: 1, pendingCount: 1,
      summary: {}, updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, `${W}/sessions/s1/events`)), event(MEMBER, 'session_ended'));
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(db, `${W}/sessions/s1`), { name: 'x' }));
    await assertFails(check(db, MEMBER, 'b0', 'checked'));
    await assertFails(setDoc(doc(db, `${W}/sessions/s1/events/late`), event(MEMBER, 'checked')));
    await assertFails(deleteDoc(doc(as(t.env, ADMIN), `${W}/sessions/s1`)));
  });

  it('snapshot fields are frozen: profile edits never rewrite items', async () => {
    await seedWorkspace(t.env);
    await seedSession(MEMBER);
    const db = as(t.env, MEMBER);
    await assertFails(updateDoc(doc(db, `${W}/sessions/s1/items/b0`), { fullName: 'changed' }));
    await assertFails(updateDoc(doc(db, `${W}/sessions/s1/items/b0`), { householdCount: 9 }));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `${W}/sessions/s1/items/b0`), { fullName: 'changed' }));
    await assertSucceeds(updateDoc(doc(db, `${W}/sessions/s1/items/b0`), { note: 'ok' }));
  });

  it('Check never confirms assistance: lastConfirmedAssistanceAt cannot ride along', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, beneficiaries_edit: true });
    await seedSession(MEMBER);
    await seed(t.env, {
      [`${W}/beneficiaries/b0`]: {
        workspaceId: WID, fullName: 'b0', nameSearch: 'b0', householdCount: 1, cityId: 'c1', cityName: 'C', areaId: 'a1',
        areaName: 'A', phones: [], primaryPhone: null, phoneDigits: [], mapPins: [], lastConfirmedAssistanceAt: null,
        lastConfirmedAssistanceRecordId: null, isArchived: false, createdBy: ADMIN, createdAt: Timestamp.now(),
      },
    });
    const db = as(t.env, MEMBER);
    const batch = writeBatch(db);
    batch.update(doc(db, `${W}/sessions/s1/items/b0`), {
      status: 'checked', processedAt: serverTimestamp(), processedBy: MEMBER, processedClientAt: Timestamp.now(),
    });
    batch.update(doc(db, `${W}/beneficiaries/b0`), { lastConfirmedAssistanceAt: Timestamp.now(), lastConfirmedAssistanceRecordId: 'none' });
    await assertFails(batch.commit());
    await assertSucceeds(check(db, MEMBER, 'b0', 'checked'));
  });

  it('reassign needs sessions_reassign and an active target member', async () => {
    await seedWorkspace(t.env);
    await seedSession(MEMBER);
    await assertFails(updateDoc(doc(as(t.env, MEMBER), `${W}/sessions/s1`), { operatorId: ADMIN }));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `${W}/sessions/s1`), { operatorId: OUTSIDER }));
    await assertSucceeds(updateDoc(doc(as(t.env, ADMIN), `${W}/sessions/s1`), { operatorId: ADMIN, updatedAt: serverTimestamp() }));
  });
});

describe('session visibility', () => {
  it('members without history see only their own sessions (query must filter)', async () => {
    await seedWorkspace(t.env, { beneficiaries_view: true });
    await seedSession(MEMBER);
    const db = as(t.env, MEMBER);
    await assertSucceeds(
      getDocs(query(collection(db, `${W}/sessions`), where('operatorId', '==', MEMBER), orderBy('createdAt', 'desc'))),
    );
    await assertFails(getDocs(query(collection(db, `${W}/sessions`), orderBy('createdAt', 'desc'))));
    await assertSucceeds(getDocs(collection(db, `${W}/sessions/s1/items`)));
    await assertSucceeds(getDocs(query(collection(as(t.env, ADMIN), `${W}/sessions`), orderBy('createdAt', 'desc'))));
    await assertFails(getDocs(collection(as(t.env, OUTSIDER), `${W}/sessions/s1/items`)));
  });
});
