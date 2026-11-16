import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { nameSearchKey } from '@/domain/search';

import {
  ADMIN,
  ALL_PERMS,
  as,
  MEMBER,
  MEMBER_PERMS,
  memberDoc,
  OUTSIDER,
  seed,
  seedWorkspace,
  useRulesEnv,
  WID,
} from './helpers';

const t = useRulesEnv();
const W = `workspaces/${WID}`;

function beneficiary(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: WID,
    fullName: 'Ahmed',
    nameSearch: 'ahmed',
    householdCount: 3,
    cityId: 'c1',
    cityName: 'C',
    areaId: 'a1',
    areaName: 'A',
    residentialAddress: null,
    pickupLocation: null,
    notes: null,
    phones: [{ id: 'p1', number: '+201012345678', raw: '010', isPrimary: true, createdAt: Timestamp.now() }],
    primaryPhone: '+201012345678',
    phoneDigits: ['+201012345678'],
    mapPins: [],
    lastConfirmedAssistanceAt: null,
    lastConfirmedAssistanceRecordId: null,
    isArchived: false,
    archivedAt: null,
    extra: {},
    schemaVersion: 1,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...overrides,
  };
}

async function seedPlaces() {
  await seed(t.env, {
    [`${W}/cities/c1`]: { name: 'C', nameSearch: 'c', isArchived: false, createdAt: Timestamp.now(), createdBy: ADMIN },
    [`${W}/areas/a1`]: {
      name: 'A', nameSearch: 'a', cityId: 'c1', cityName: 'C', isActive: true, beneficiaryCount: 0,
      createdAt: Timestamp.now(), createdBy: ADMIN,
    },
  });
}

async function seedBeneficiary(overrides: Record<string, unknown> = {}) {
  await seed(t.env, {
    [`${W}/beneficiaries/b1`]: { ...beneficiary(ADMIN), createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...overrides },
  });
}

describe('cities and areas', () => {
  it('areas_manage holders create; plain members cannot', async () => {
    await seedWorkspace(t.env);
    const city = { name: 'C2', nameSearch: 'c2', isArchived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as(t.env, ADMIN), `${W}/cities/c2`), { ...city, createdBy: ADMIN }));
    await assertFails(setDoc(doc(as(t.env, MEMBER), `${W}/cities/c3`), { ...city, createdBy: MEMBER }));
    await assertFails(setDoc(doc(as(t.env, ADMIN), `${W}/cities/c4`), { ...city, createdBy: ADMIN, extra: 1 }));
  });

  it('areas start at zero; cannot be deleted; members with create perm can only bump the count', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, beneficiaries_create: true });
    await seedPlaces();
    const area = {
      name: 'B', nameSearch: 'b', cityId: 'c1', cityName: 'C', isActive: true, createdAt: serverTimestamp(),
      createdBy: ADMIN, updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(as(t.env, ADMIN), `${W}/areas/a2`), { ...area, beneficiaryCount: 5 }));
    await assertSucceeds(setDoc(doc(as(t.env, ADMIN), `${W}/areas/a2`), { ...area, beneficiaryCount: 0 }));
    await assertFails(deleteDoc(doc(as(t.env, ADMIN), `${W}/areas/a1`)));
    await assertSucceeds(updateDoc(doc(as(t.env, MEMBER), `${W}/areas/a1`), { beneficiaryCount: increment(1) }));
    await assertFails(updateDoc(doc(as(t.env, MEMBER), `${W}/areas/a1`), { name: 'Hacked' }));
  });
});

describe('beneficiaries', () => {
  it('create needs beneficiaries_create and a valid shape', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, beneficiaries_create: true });
    await seedPlaces();
    await assertSucceeds(setDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b2`), beneficiary(MEMBER)));
    await assertFails(setDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b3`), beneficiary(ADMIN)));
    await assertFails(setDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b4`), beneficiary(MEMBER, { householdCount: 0 })));
    await assertFails(setDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b5`), beneficiary(MEMBER, { isArchived: true })));
    await assertFails(setDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b6`), beneficiary(MEMBER, { hacker: true })));
    await assertFails(
      setDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b7`), beneficiary(MEMBER, { primaryPhone: '+209999' })),
    );
    await assertFails(
      setDoc(
        doc(as(t.env, MEMBER), `${W}/beneficiaries/b8`),
        beneficiary(MEMBER, { lastConfirmedAssistanceAt: Timestamp.now() }),
      ),
    );
  });

  it('enforces max 10 phones and pins', async () => {
    await seedWorkspace(t.env);
    const phones = Array.from({ length: 11 }, (_, i) => ({ id: `${i}`, number: `+2010000000${i}`, isPrimary: i === 0 }));
    await assertFails(
      setDoc(
        doc(as(t.env, ADMIN), `${W}/beneficiaries/b9`),
        beneficiary(ADMIN, { phones, phoneDigits: phones.map((p) => p.number), primaryPhone: phones[0]!.number }),
      ),
    );
    const pins = Array.from({ length: 11 }, (_, i) => ({ id: `${i}`, lat: 1, lng: 1 }));
    await assertFails(setDoc(doc(as(t.env, ADMIN), `${W}/beneficiaries/b10`), beneficiary(ADMIN, { mapPins: pins })));
  });

  it('members read with beneficiaries_view; outsiders cannot', async () => {
    await seedWorkspace(t.env);
    await seedBeneficiary();
    await assertSucceeds(getDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b1`)));
    await assertSucceeds(
      getDocs(query(collection(as(t.env, MEMBER), `${W}/beneficiaries`), where('isArchived', '==', false), orderBy('nameSearch'), limit(20))),
    );
    await assertFails(getDoc(doc(as(t.env, OUTSIDER), `${W}/beneficiaries/b1`)));
    await seedWorkspace(t.env, {});
    await assertFails(getDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b1`)));
  });

  it('workspace data is isolated: a member of one workspace cannot touch another', async () => {
    await seedWorkspace(t.env, ALL_PERMS);
    const OTHER = 'ws2';
    const O = `workspaces/${OTHER}`;
    await seed(t.env, {
      [O]: { name: 'Other', ownerId: OUTSIDER, beneficiaryCount: 1, areaCount: 1, cityCount: 1, sessionCount: 0, createdAt: Timestamp.now() },
      [`${O}/members/${OUTSIDER}`]: memberDoc(OUTSIDER, 'owner', ALL_PERMS),
      [`${O}/areas/a1`]: { name: 'A', nameSearch: 'a', cityId: 'c1', cityName: 'C', isActive: true, beneficiaryCount: 1, createdAt: Timestamp.now(), createdBy: OUTSIDER },
      [`${O}/beneficiaries/x1`]: { ...beneficiary(OUTSIDER), workspaceId: OTHER, createdAt: Timestamp.now() },
    });
    const db = as(t.env, MEMBER);
    await assertFails(getDoc(doc(db, O)));
    await assertFails(getDoc(doc(db, `${O}/beneficiaries/x1`)));
    await assertFails(getDocs(collection(db, `${O}/beneficiaries`)));
    await assertFails(getDocs(collection(db, `${O}/areas`)));
    await assertFails(setDoc(doc(db, `${O}/beneficiaries/x2`), { ...beneficiary(MEMBER), workspaceId: OTHER }));
    await assertFails(updateDoc(doc(db, `${O}/areas/a1`), { beneficiaryCount: increment(1) }));
    // A doc in my workspace that claims another workspaceId is rejected too.
    await assertFails(setDoc(doc(db, `${W}/beneficiaries/x3`), { ...beneficiary(MEMBER), workspaceId: OTHER }));
  });

  it('lists paginate by cursor and Arabic prefix search uses the normalized key', async () => {
    await seedWorkspace(t.env);
    const names = Array.from({ length: 25 }, (_, i) => `أحمد ${String(i).padStart(2, '0')}`).concat(['محمود', 'إيمان']);
    const writes: Record<string, Record<string, unknown>> = {};
    names.forEach((name, i) => {
      writes[`${W}/beneficiaries/n${i}`] = {
        ...beneficiary(ADMIN), fullName: name, nameSearch: nameSearchKey(name), createdAt: Timestamp.now(),
      };
    });
    await seed(t.env, writes);
    const db = as(t.env, MEMBER);
    const base = [where('isArchived', '==', false), orderBy('nameSearch')] as const;
    const page1 = await assertSucceeds(getDocs(query(collection(db, `${W}/beneficiaries`), ...base, limit(20))));
    const page2 = await assertSucceeds(
      getDocs(query(collection(db, `${W}/beneficiaries`), ...base, startAfter(page1.docs[page1.docs.length - 1]), limit(20))),
    );
    expect(page1.size).toBe(20);
    expect(page2.size).toBe(7);
    const ids = new Set([...page1.docs, ...page2.docs].map((d) => d.id));
    expect(ids.size).toBe(27);

    const prefix = nameSearchKey('احمد');
    const found = await getDocs(
      query(collection(db, `${W}/beneficiaries`), where('isArchived', '==', false), where('nameSearch', '>=', prefix),
        where('nameSearch', '<=', `${prefix}\uf8ff`), orderBy('nameSearch')),
    );
    expect(found.size).toBe(25);
    const iman = await getDocs(
      query(collection(db, `${W}/beneficiaries`), where('nameSearch', '>=', nameSearchKey('ايمان')),
        where('nameSearch', '<=', `${nameSearchKey('ايمان')}\uf8ff`), orderBy('nameSearch')),
    );
    expect(iman.docs.map((d) => d.data().fullName)).toEqual(['إيمان']);
  });

  it('edit cannot touch archive state or confirmed assistance; never deleted', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, beneficiaries_edit: true });
    await seedBeneficiary();
    const ref = doc(as(t.env, MEMBER), `${W}/beneficiaries/b1`);
    await assertSucceeds(updateDoc(ref, { notes: 'hello', updatedBy: MEMBER }));
    await assertFails(updateDoc(ref, { isArchived: true }));
    await assertFails(updateDoc(ref, { lastConfirmedAssistanceAt: Timestamp.now(), lastConfirmedAssistanceRecordId: 'r' }));
    await assertFails(updateDoc(ref, { createdBy: MEMBER }));
    await assertFails(deleteDoc(doc(as(t.env, ADMIN), `${W}/beneficiaries/b1`)));
  });

  it('archive needs beneficiaries_archive and only flips archive fields', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, beneficiaries_archive: true });
    await seedBeneficiary();
    const ref = doc(as(t.env, MEMBER), `${W}/beneficiaries/b1`);
    await assertFails(updateDoc(ref, { isArchived: true, archivedAt: serverTimestamp(), notes: 'x' }));
    await assertSucceeds(updateDoc(ref, { isArchived: true, archivedAt: serverTimestamp(), updatedBy: MEMBER }));
  });
});

describe('history', () => {
  it('append-only; actor must be self; collection-group read needs history_view', async () => {
    await seedWorkspace(t.env);
    await seedBeneficiary();
    const event = (uid: string) => ({
      workspaceId: WID, beneficiaryId: 'b1', actorId: uid, actorName: uid, type: 'call_initiated', createdAt: serverTimestamp(),
    });
    const db = as(t.env, MEMBER);
    await assertSucceeds(setDoc(doc(db, `${W}/beneficiaries/b1/history/e1`), event(MEMBER)));
    await assertFails(setDoc(doc(db, `${W}/beneficiaries/b1/history/e2`), event(ADMIN)));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `${W}/beneficiaries/b1/history/e1`), { type: 'x' }));
    await assertFails(deleteDoc(doc(as(t.env, ADMIN), `${W}/beneficiaries/b1/history/e1`)));
    await assertSucceeds(
      getDocs(query(collectionGroup(db, 'history'), where('workspaceId', '==', WID), orderBy('createdAt', 'desc'), limit(5))),
    );
    await assertFails(
      getDocs(query(collectionGroup(as(t.env, OUTSIDER), 'history'), where('workspaceId', '==', WID), limit(5))),
    );
  });
});

describe('assistance records', () => {
  const record = (uid: string, status: string, deliveredAt: Timestamp) => ({
    workspaceId: WID, beneficiaryId: 'b1', type: 'food', deliveredAt, recordedBy: uid,
    confirmationStatus: status, createdAt: serverTimestamp(),
  });

  it('needs assistance_record; only unconfirmed -> confirmed; never deleted', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, assistance_record: true });
    await seedBeneficiary();
    const db = as(t.env, MEMBER);
    const when = Timestamp.fromMillis(Date.now() - 1000);
    await assertSucceeds(setDoc(doc(db, `${W}/beneficiaries/b1/assistanceRecords/r1`), record(MEMBER, 'unconfirmed', when)));
    await assertSucceeds(
      updateDoc(doc(db, `${W}/beneficiaries/b1/assistanceRecords/r1`), {
        confirmationStatus: 'confirmed', confirmedAt: serverTimestamp(), confirmedBy: MEMBER,
      }),
    );
    await assertFails(
      updateDoc(doc(db, `${W}/beneficiaries/b1/assistanceRecords/r1`), { confirmationStatus: 'unconfirmed' }),
    );
    await assertFails(deleteDoc(doc(as(t.env, ADMIN), `${W}/beneficiaries/b1/assistanceRecords/r1`)));
    await assertFails(
      setDoc(doc(as(t.env, OUTSIDER), `${W}/beneficiaries/b1/assistanceRecords/r2`), record(OUTSIDER, 'confirmed', when)),
    );
  });

  it('lastConfirmedAssistanceAt moves only with a matching confirmed record in the same batch', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, assistance_record: true });
    await seedBeneficiary();
    const db = as(t.env, MEMBER);
    const when = Timestamp.fromMillis(Date.now() - 1000);

    await assertFails(
      updateDoc(doc(db, `${W}/beneficiaries/b1`), { lastConfirmedAssistanceAt: when, lastConfirmedAssistanceRecordId: 'r9' }),
    );

    const unconfirmed = writeBatch(db);
    unconfirmed.set(doc(db, `${W}/beneficiaries/b1/assistanceRecords/r3`), record(MEMBER, 'unconfirmed', when));
    unconfirmed.update(doc(db, `${W}/beneficiaries/b1`), { lastConfirmedAssistanceAt: when, lastConfirmedAssistanceRecordId: 'r3' });
    await assertFails(unconfirmed.commit());

    const confirmed = writeBatch(db);
    confirmed.set(doc(db, `${W}/beneficiaries/b1/assistanceRecords/r4`), record(MEMBER, 'confirmed', when));
    confirmed.update(doc(db, `${W}/beneficiaries/b1`), {
      lastConfirmedAssistanceAt: when, lastConfirmedAssistanceRecordId: 'r4', updatedAt: serverTimestamp(), updatedBy: MEMBER,
    });
    await assertSucceeds(confirmed.commit());
  });
});

describe('import and export', () => {
  const event = (uid: string, type: string, extra: Record<string, unknown> = {}) => ({
    actorId: uid, actorName: 'x', type, createdAt: serverTimestamp(), clientAt: Timestamp.now(), metadata: {}, ...extra,
  });

  it('an import-only member writes the import batch (doc, history, area + workspace counters)', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, beneficiaries_import: true });
    await seedPlaces();
    const db = as(t.env, MEMBER);
    const batch = writeBatch(db);
    batch.set(doc(db, `${W}/beneficiaries/i1`), beneficiary(MEMBER));
    batch.set(doc(db, `${W}/beneficiaries/i1/history/e1`), event(MEMBER, 'imported', { workspaceId: WID, beneficiaryId: 'i1' }));
    batch.update(doc(db, `${W}/areas/a1`), { beneficiaryCount: increment(1) });
    batch.update(doc(db, W), { beneficiaryCount: increment(1), updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it('an import-only member may update profiles but not archive or create places', async () => {
    await seedWorkspace(t.env, { ...MEMBER_PERMS, beneficiaries_import: true });
    await seedPlaces();
    await seedBeneficiary();
    const db = as(t.env, MEMBER);
    await assertSucceeds(
      updateDoc(doc(db, `${W}/beneficiaries/b1`), { householdCount: 6, updatedAt: serverTimestamp(), updatedBy: MEMBER }),
    );
    await assertFails(updateDoc(doc(db, `${W}/beneficiaries/b1`), { isArchived: true }));
    await assertFails(
      setDoc(doc(db, `${W}/cities/c9`), {
        name: 'New', nameSearch: 'new', isArchived: false, createdAt: serverTimestamp(), createdBy: MEMBER, updatedAt: serverTimestamp(),
      }),
    );
  });

  it('without create or import permission the import batch is rejected', async () => {
    await seedWorkspace(t.env);
    await seedPlaces();
    const db = as(t.env, MEMBER);
    await assertFails(setDoc(doc(db, `${W}/beneficiaries/i2`), beneficiary(MEMBER)));
  });

  it('members log import/export audit events as themselves only; outsiders cannot', async () => {
    await seedWorkspace(t.env);
    await assertSucceeds(
      setDoc(doc(as(t.env, MEMBER), `${W}/auditLog/x1`), event(MEMBER, 'export_created', { workspaceId: WID })),
    );
    await assertFails(
      setDoc(doc(as(t.env, MEMBER), `${W}/auditLog/x2`), event(ADMIN, 'import_completed', { workspaceId: WID })),
    );
    await assertFails(
      setDoc(doc(as(t.env, OUTSIDER), `${W}/auditLog/x3`), event(OUTSIDER, 'export_created', { workspaceId: WID })),
    );
    await assertFails(getDocs(collection(as(t.env, MEMBER), `${W}/auditLog`)));
  });
});
