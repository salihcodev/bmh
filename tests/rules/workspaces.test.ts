import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
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
import { describe, it } from 'vitest';

import {
  ADMIN,
  ALL_PERMS,
  as,
  CODE,
  inviteDoc,
  MEMBER,
  MEMBER_PERMS,
  OUTSIDER,
  OWNER,
  seed,
  seedWorkspace,
  useRulesEnv,
  WID,
} from './helpers';

const t = useRulesEnv();

describe('users/{uid}', () => {
  it('owner reads/creates own profile; others cannot', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(
      setDoc(doc(db, 'users/alice'), { displayName: 'Alice', email: 'a@x.com', locale: 'ar', createdAt: serverTimestamp() }),
    );
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertFails(getDoc(doc(as(t.env, 'bob'), 'users/alice')));
  });

  it('blocks unknown fields and email changes; allows lastWorkspaceId', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'users/alice'), { displayName: 'A', role: 'admin' }));
    await assertSucceeds(setDoc(doc(db, 'users/alice'), { displayName: 'A', email: 'a@x.com' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { email: 'other@x.com' }));
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { lastWorkspaceId: WID }));
  });

  it('allows a phone profile and rejects a number that is not E.164', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(
      setDoc(doc(db, 'users/alice'), { displayName: 'Alice', phone: '+201001234567', locale: 'ar', createdAt: serverTimestamp() }),
    );
    await assertFails(setDoc(doc(as(t.env, 'bob'), 'users/bob'), { displayName: 'Bob', phone: '01001234567' }));
  });

  it('denies unauthenticated access and unknown collections', async () => {
    await assertFails(getDoc(doc(t.env.unauthenticatedContext().firestore(), 'users/alice')));
    await assertFails(setDoc(doc(as(t.env, 'alice'), 'anything/x'), { a: 1 }));
  });
});

describe('workspace bootstrap', () => {
  const workspace = (uid: string, extra: Record<string, unknown> = {}) => ({
    name: 'New',
    ownerId: uid,
    beneficiaryCount: 0,
    areaCount: 0,
    cityCount: 0,
    sessionCount: 0,
    createdAt: serverTimestamp(),
    ...extra,
  });
  const owner = (uid: string, role = 'owner') => ({
    userId: uid,
    role,
    permissions: ALL_PERMS,
    status: 'active',
    joinedAt: serverTimestamp(),
    displayName: uid,
    email: `${uid}@x.com`,
  });

  it('creates workspace + owner member in one batch', async () => {
    const db = as(t.env, 'alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'workspaces/w2'), workspace('alice'));
    batch.set(doc(db, 'workspaces/w2/members/alice'), owner('alice'));
    await assertSucceeds(batch.commit());
  });

  it('rejects workspace without owner member, or member without workspace', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'workspaces/w2'), workspace('alice')));
    await assertFails(setDoc(doc(db, 'workspaces/w2/members/alice'), owner('alice')));
  });

  it('rejects someone else as owner and non-zero counters', async () => {
    const db = as(t.env, 'alice');
    const a = writeBatch(db);
    a.set(doc(db, 'workspaces/w2'), workspace('bob'));
    a.set(doc(db, 'workspaces/w2/members/alice'), owner('alice'));
    await assertFails(a.commit());
    const b = writeBatch(db);
    b.set(doc(db, 'workspaces/w2'), workspace('alice', { beneficiaryCount: 5 }));
    b.set(doc(db, 'workspaces/w2/members/alice'), owner('alice'));
    await assertFails(b.commit());
  });

  it('cannot self-create an owner membership in an existing workspace', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, OUTSIDER);
    await assertFails(setDoc(doc(db, `workspaces/${WID}/members/${OUTSIDER}`), owner(OUTSIDER)));
    await assertFails(setDoc(doc(db, `workspaces/${WID}/members/${OUTSIDER}`), owner(OUTSIDER, 'admin')));
  });
});

describe('workspace access', () => {
  it('members read, outsiders cannot', async () => {
    await seedWorkspace(t.env);
    await assertSucceeds(getDoc(doc(as(t.env, MEMBER), `workspaces/${WID}`)));
    await assertFails(getDoc(doc(as(t.env, OUTSIDER), `workspaces/${WID}`)));
    await assertFails(getDocs(collection(as(t.env, OUTSIDER), `workspaces/${WID}/members`)));
  });

  it('collection-group membership query only returns own docs', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, MEMBER);
    await assertSucceeds(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', MEMBER))));
    await assertFails(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', OWNER))));
  });

  it('disabled members lose access', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, {
      [`workspaces/${WID}/members/${MEMBER}`]: {
        userId: MEMBER, role: 'member', permissions: MEMBER_PERMS, status: 'disabled',
        joinedAt: Timestamp.now(), displayName: 'm', email: 'm@x.com',
      },
    });
    await assertFails(getDoc(doc(as(t.env, MEMBER), `workspaces/${WID}`)));
  });

  it('counters may move by any member; name only by owner/admin', async () => {
    await seedWorkspace(t.env);
    const member = as(t.env, MEMBER);
    await assertSucceeds(updateDoc(doc(member, `workspaces/${WID}`), { beneficiaryCount: 1 }));
    await assertFails(updateDoc(doc(member, `workspaces/${WID}`), { name: 'Hacked' }));
    await assertSucceeds(updateDoc(doc(as(t.env, ADMIN), `workspaces/${WID}`), { name: 'Renamed' }));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `workspaces/${WID}`), { ownerId: ADMIN }));
  });
});

describe('invites', () => {
  it('managers create invites with long codes and bounded expiry', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, ADMIN);
    const fresh = { ...inviteDoc(), createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, `workspaces/${WID}/invites/${CODE}`), fresh));
    await assertFails(setDoc(doc(db, `workspaces/${WID}/invites/short`), fresh));
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/invites/${CODE}x`), {
        ...fresh,
        expiresAt: Timestamp.fromMillis(Date.now() + 40 * 86400000),
      }),
    );
    await assertFails(setDoc(doc(db, `workspaces/${WID}/invites/${CODE}y`), { ...fresh, role: 'owner' }));
  });

  it('members without members_manage cannot create or list invites', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    const db = as(t.env, MEMBER);
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/invites/${CODE}z`), { ...inviteDoc({ createdBy: MEMBER }), createdAt: serverTimestamp() }),
    );
    await assertFails(getDocs(collection(db, `workspaces/${WID}/invites`)));
    await assertSucceeds(getDocs(collection(as(t.env, ADMIN), `workspaces/${WID}/invites`)));
  });

  it('any signed-in user can get an invite by code', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    await assertSucceeds(getDoc(doc(as(t.env, OUTSIDER), `workspaces/${WID}/invites/${CODE}`)));
    await assertFails(getDoc(doc(t.env.unauthenticatedContext().firestore(), `workspaces/${WID}/invites/${CODE}`)));
  });

  const redeem = (uid: string, overrides: Record<string, unknown> = {}) => {
    const db = as(t.env, uid);
    const batch = writeBatch(db);
    batch.set(doc(db, `workspaces/${WID}/members/${uid}`), {
      userId: uid,
      role: 'member',
      permissions: MEMBER_PERMS,
      status: 'active',
      joinedAt: serverTimestamp(),
      inviteCode: CODE,
      displayName: uid,
      email: `${uid}@x.com`,
      ...overrides,
    });
    batch.update(doc(db, `workspaces/${WID}/invites/${CODE}`), { used: true, usedBy: uid, usedAt: serverTimestamp() });
    return batch.commit();
  };

  it('redeems a valid invite with copied role and permissions', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    await assertSucceeds(redeem(OUTSIDER));
    await assertSucceeds(getDoc(doc(as(t.env, OUTSIDER), `workspaces/${WID}`)));
  });

  it('rejects escalation, reuse and expired invites', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    await assertFails(redeem(OUTSIDER, { role: 'admin' }));
    await assertFails(redeem(OUTSIDER, { permissions: { ...MEMBER_PERMS, members_manage: true } }));
    await assertSucceeds(redeem(OUTSIDER));
    await assertFails(redeem('second'));

    await seed(t.env, {
      [`workspaces/${WID}/invites/${CODE}`]: inviteDoc({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) }),
    });
    await assertFails(redeem('third'));
  });

  it('member doc without consuming the invite fails', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    const db = as(t.env, OUTSIDER);
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/members/${OUTSIDER}`), {
        userId: OUTSIDER, role: 'member', permissions: MEMBER_PERMS, status: 'active',
        joinedAt: serverTimestamp(), inviteCode: CODE, displayName: 'o', email: 'o@x.com',
      }),
    );
  });

  it('managers revoke (delete) invites', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    await assertFails(deleteDoc(doc(as(t.env, MEMBER), `workspaces/${WID}/invites/${CODE}`)));
    await assertSucceeds(deleteDoc(doc(as(t.env, ADMIN), `workspaces/${WID}/invites/${CODE}`)));
  });
});

describe('member management', () => {
  const memberRef = (uid: string, target: string) => doc(as(t.env, uid), `workspaces/${WID}/members/${target}`);

  it('nobody edits their own grants', async () => {
    await seedWorkspace(t.env);
    await assertFails(updateDoc(memberRef(MEMBER, MEMBER), { permissions: ALL_PERMS }));
    await assertFails(updateDoc(memberRef(MEMBER, MEMBER), { role: 'admin' }));
    await assertFails(updateDoc(memberRef(ADMIN, ADMIN), { role: 'member' }));
    await assertSucceeds(updateDoc(memberRef(MEMBER, MEMBER), { displayName: 'New name' }));
  });

  it('managers edit other members but never the owner', async () => {
    await seedWorkspace(t.env);
    await assertSucceeds(
      updateDoc(memberRef(ADMIN, MEMBER), { permissions: { ...MEMBER_PERMS, sessions_run: true }, updatedBy: ADMIN }),
    );
    await assertFails(updateDoc(memberRef(ADMIN, MEMBER), { permissions: { bogus: true } }));
    await assertFails(updateDoc(memberRef(ADMIN, MEMBER), { role: 'owner' }));
    await assertFails(updateDoc(memberRef(ADMIN, OWNER), { status: 'disabled' }));
  });

  it('owner doc cannot be deleted; members can leave; managers remove others', async () => {
    await seedWorkspace(t.env);
    await assertFails(deleteDoc(memberRef(OWNER, OWNER)));
    await assertFails(deleteDoc(memberRef(ADMIN, OWNER)));
    await assertFails(deleteDoc(memberRef(MEMBER, ADMIN)));
    await assertSucceeds(deleteDoc(memberRef(MEMBER, MEMBER)));
    await seedWorkspace(t.env);
    await assertSucceeds(deleteDoc(memberRef(ADMIN, MEMBER)));
  });

  it('transfers ownership atomically', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, OWNER);
    const partial = writeBatch(db);
    partial.update(doc(db, `workspaces/${WID}`), { ownerId: ADMIN });
    await assertFails(partial.commit());

    const batch = writeBatch(db);
    batch.update(doc(db, `workspaces/${WID}`), { ownerId: ADMIN, updatedAt: serverTimestamp() });
    batch.update(doc(db, `workspaces/${WID}/members/${ADMIN}`), { role: 'owner', updatedAt: serverTimestamp() });
    batch.update(doc(db, `workspaces/${WID}/members/${OWNER}`), { role: 'admin', updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it('admins cannot transfer ownership', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, ADMIN);
    const batch = writeBatch(db);
    batch.update(doc(db, `workspaces/${WID}`), { ownerId: ADMIN });
    batch.update(doc(db, `workspaces/${WID}/members/${ADMIN}`), { role: 'owner' });
    await assertFails(batch.commit());
  });
});

describe('audit log', () => {
  it('append-only, members write their own events, managers read', async () => {
    await seedWorkspace(t.env);
    const event = (uid: string) => ({ workspaceId: WID, actorId: uid, actorName: uid, type: 'x', createdAt: serverTimestamp() });
    const ref = await assertSucceeds(addDoc(collection(as(t.env, MEMBER), `workspaces/${WID}/auditLog`), event(MEMBER)));
    await assertFails(addDoc(collection(as(t.env, MEMBER), `workspaces/${WID}/auditLog`), event(ADMIN)));
    await assertFails(addDoc(collection(as(t.env, OUTSIDER), `workspaces/${WID}/auditLog`), event(OUTSIDER)));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), ref.path), { type: 'y' }));
    await assertFails(getDocs(collection(as(t.env, MEMBER), `workspaces/${WID}/auditLog`)));
    await assertSucceeds(getDocs(collection(as(t.env, ADMIN), `workspaces/${WID}/auditLog`)));
  });
});
