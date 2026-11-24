import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';

import { as, inviteDoc, memberDoc, seed, setupRulesEnv } from './helpers';

// Two tenants on the same project. Bob (owner of B) must not see or touch anything of A.
const t = setupRulesEnv();

const A = 'wsA';
const B = 'wsB';
const ALICE = 'alice';
const BOB = 'bob';
const CODE_A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const now = () => Timestamp.now();

function workspace(ownerId: string) {
  return { name: ownerId, ownerId, beneficiaryCount: 1, areaCount: 1, cityCount: 1, sessionCount: 1, createdAt: now() };
}

function tenant(wid: string, owner: string) {
  return {
    [`users/${owner}`]: { displayName: owner, email: `${owner}@x.com`, userType: 'member', supplierStatus: 'none', status: 'active', isDeleted: false, schemaVersion: 3, createdAt: now() },
    [`workspaces/${wid}`]: workspace(owner),
    [`workspaces/${wid}/members/${owner}`]: memberDoc(owner, 'admin'),
    [`workspaces/${wid}/cities/c1`]: { name: 'City', nameSearch: 'city', isArchived: false, createdAt: now(), createdBy: owner },
    [`workspaces/${wid}/areas/a1`]: {
      name: 'Area', nameSearch: 'area', cityId: 'c1', cityName: 'City', isActive: true, beneficiaryCount: 1,
      createdAt: now(), createdBy: owner,
    },
    [`workspaces/${wid}/beneficiaries/b1`]: {
      workspaceId: wid, fullName: 'Person', nameSearch: 'person', householdCount: 3, cityId: 'c1', cityName: 'City',
      areaId: 'a1', areaName: 'Area', phones: [], primaryPhone: null, phoneDigits: [], mapPins: [], isArchived: false,
      lastConfirmedAssistanceAt: null, createdBy: owner, createdAt: now(),
    },
    [`workspaces/${wid}/beneficiaries/b1/history/h1`]: {
      workspaceId: wid, beneficiaryId: 'b1', actorId: owner, type: 'created', createdAt: now(),
    },
    [`workspaces/${wid}/beneficiaries/b1/assistanceRecords/r1`]: {
      workspaceId: wid, beneficiaryId: 'b1', recordedBy: owner, confirmationStatus: 'confirmed', deliveredAt: now(), createdAt: now(),
    },
    [`workspaces/${wid}/sessions/s1`]: {
      workspaceId: wid, status: 'active', operatorId: owner, startedBy: owner, createdBy: owner, cityId: 'c1', areaIds: ['a1'],
      beneficiaryCount: 1, checkedCount: 0, ignoredCount: 0, contactActionsCount: 0, createdAt: now(),
    },
    [`workspaces/${wid}/sessions/s1/items/b1`]: { beneficiaryId: 'b1', status: 'pending', processedAt: null, order: 0 },
    [`workspaces/${wid}/sessions/s1/events/e1`]: {
      workspaceId: wid, sessionId: 's1', actorId: owner, type: 'session_started', createdAt: now(),
    },
    [`workspaces/${wid}/auditLog/l1`]: { workspaceId: wid, actorId: owner, type: 'workspace_created', createdAt: now() },
  };
}

const DOC_PATHS = [
  `users/${ALICE}`,
  `workspaces/${A}`,
  `workspaces/${A}/members/${ALICE}`,
  `workspaces/${A}/cities/c1`,
  `workspaces/${A}/areas/a1`,
  `workspaces/${A}/beneficiaries/b1`,
  `workspaces/${A}/beneficiaries/b1/history/h1`,
  `workspaces/${A}/beneficiaries/b1/assistanceRecords/r1`,
  `workspaces/${A}/sessions/s1`,
  `workspaces/${A}/sessions/s1/items/b1`,
  `workspaces/${A}/sessions/s1/events/e1`,
  `workspaces/${A}/auditLog/l1`,
];

const COLLECTION_PATHS = [
  `workspaces/${A}/members`,
  `workspaces/${A}/invites`,
  `workspaces/${A}/cities`,
  `workspaces/${A}/areas`,
  `workspaces/${A}/beneficiaries`,
  `workspaces/${A}/beneficiaries/b1/history`,
  `workspaces/${A}/beneficiaries/b1/assistanceRecords`,
  `workspaces/${A}/sessions`,
  `workspaces/${A}/sessions/s1/items`,
  `workspaces/${A}/sessions/s1/events`,
  `workspaces/${A}/auditLog`,
];

beforeEach(async () => {
  await seed(t.env, {
    ...tenant(A, ALICE),
    ...tenant(B, BOB),
    [`workspaces/${A}/invites/${CODE_A}`]: inviteDoc({ workspaceId: A, createdBy: ALICE }),
  });
});

describe('cross-tenant isolation (user B vs workspace A)', () => {
  it('owner of A can read every A path (sanity check)', async () => {
    const db = as(t.env, ALICE);
    for (const path of DOC_PATHS) await assertSucceeds(getDoc(doc(db, path)));
  });

  it.each(DOC_PATHS)('B cannot get %s', async (path) => {
    await assertFails(getDoc(doc(as(t.env, BOB), path)));
  });

  it.each(COLLECTION_PATHS)('B cannot list %s', async (path) => {
    await assertFails(getDocs(collection(as(t.env, BOB), path)));
  });

  it.each(DOC_PATHS)('B cannot overwrite %s', async (path) => {
    await assertFails(setDoc(doc(as(t.env, BOB), path), { hacked: true }, { merge: true }));
  });

  it.each(DOC_PATHS)('B cannot delete %s', async (path) => {
    await assertFails(deleteDoc(doc(as(t.env, BOB), path)));
  });

  it('B cannot create documents inside A', async () => {
    const db = as(t.env, BOB);
    await assertFails(
      setDoc(doc(db, `workspaces/${A}/beneficiaries/new`), {
        workspaceId: A, fullName: 'X', nameSearch: 'x', householdCount: 1, cityId: 'c1', areaId: 'a1',
        phones: [], primaryPhone: null, phoneDigits: [], mapPins: [], isArchived: false,
        lastConfirmedAssistanceAt: null, createdBy: BOB, createdAt: now(),
      }),
    );
    await assertFails(setDoc(doc(db, `workspaces/${A}/members/${BOB}`), memberDoc(BOB, 'member')));
    await assertFails(updateDoc(doc(db, `workspaces/${A}`), { beneficiaryCount: 99 }));
  });

  it('B cannot plant a beneficiary in its own workspace claiming workspaceId A', async () => {
    const db = as(t.env, BOB);
    await assertFails(
      setDoc(doc(db, `workspaces/${B}/beneficiaries/fake`), {
        workspaceId: A, fullName: 'X', nameSearch: 'x', householdCount: 1, cityId: 'c1', areaId: 'a1',
        phones: [], primaryPhone: null, phoneDigits: [], mapPins: [], isArchived: false,
        lastConfirmedAssistanceAt: null, createdBy: BOB, createdAt: now(),
      }),
    );
  });

  it('collection-group queries cannot reach A', async () => {
    const db = as(t.env, BOB);
    await assertSucceeds(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', BOB))));
    await assertFails(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', ALICE))));
    await assertFails(getDocs(collectionGroup(db, 'members')));
    await assertFails(getDocs(collectionGroup(db, 'beneficiaries')));
    await assertFails(getDocs(collectionGroup(db, 'sessions')));
    await assertFails(getDocs(query(collectionGroup(db, 'history'), where('workspaceId', '==', A))));
  });

  it('unauthenticated clients see nothing', async () => {
    const db = t.env.unauthenticatedContext().firestore();
    for (const path of DOC_PATHS) await assertFails(getDoc(doc(db, path)));
  });
});
