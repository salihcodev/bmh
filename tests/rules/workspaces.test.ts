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
  ALL_KEYS,
  as,
  CODE,
  inviteDoc,
  MEMBER,
  MEMBER_KEYS,
  memberDoc,
  OUTSIDER,
  OWNER,
  seed,
  seedWorkspace,
  setupRulesEnv,
  WID,
} from './helpers';

const t = setupRulesEnv();

const V3 = { userType: 'member', supplierStatus: 'none', status: 'active', isDeleted: false, schemaVersion: 3 };

describe('users/{uid}', () => {
  it('owner reads/creates own profile; others cannot', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(
      setDoc(doc(db, 'users/alice'), {
        displayName: 'Alice', email: 'a@x.com', locale: 'ar', createdAt: serverTimestamp(), ...V3,
      }),
    );
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertFails(getDoc(doc(as(t.env, 'bob'), 'users/alice')));
  });

  it('blocks unknown fields and email changes; allows lastWorkspaceId', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'users/alice'), { displayName: 'A', role: 'admin', ...V3 }));
    await assertSucceeds(setDoc(doc(db, 'users/alice'), { displayName: 'A', email: 'a@x.com', ...V3 }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { email: 'other@x.com' }));
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { lastWorkspaceId: WID }));
  });

  it('allows a phone profile and rejects a number that is not E.164', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(
      setDoc(doc(db, 'users/alice'), {
        displayName: 'Alice', phone: '+201001234567', locale: 'ar', createdAt: serverTimestamp(), ...V3,
      }),
    );
    await assertFails(setDoc(doc(as(t.env, 'bob'), 'users/bob'), { displayName: 'Bob', phone: '01001234567', ...V3 }));
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
    isDeleted: false,
    createdAt: serverTimestamp(),
    ...extra,
  });
  const seat = (uid: string, roleId = 'admin') => ({
    userId: uid,
    roleId,
    status: 'active',
    joinedAt: serverTimestamp(),
    displayName: uid,
    email: `${uid}@x.com`,
  });
  const role = (uid: string, name: string, permissions: string[], isLocked: boolean) => ({
    name, permissions, isLocked, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid,
  });

  function bootstrap(uid: string, options: { workspace?: Record<string, unknown>; roles?: boolean; seatRole?: string } = {}) {
    const db = as(t.env, uid);
    const batch = writeBatch(db);
    batch.set(doc(db, 'workspaces/w2'), workspace(uid, options.workspace));
    batch.set(doc(db, `workspaces/w2/members/${uid}`), seat(uid, options.seatRole));
    if (options.roles !== false) {
      batch.set(doc(db, 'workspaces/w2/roles/admin'), role(uid, 'Admin', ALL_KEYS, true));
      batch.set(doc(db, 'workspaces/w2/roles/member'), role(uid, 'Member', MEMBER_KEYS, false));
    }
    return batch.commit();
  }

  it('creates workspace + admin seat + built-in roles in one batch', async () => {
    await assertSucceeds(bootstrap('alice'));
  });

  it('rejects a bootstrap without the roles, or with a non-admin seat', async () => {
    await assertFails(bootstrap('alice', { roles: false }));
    await assertFails(bootstrap('alice', { seatRole: 'member' }));
  });

  it('rejects workspace without the seat, or the seat without the workspace', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'workspaces/w2'), workspace('alice')));
    await assertFails(setDoc(doc(db, 'workspaces/w2/members/alice'), seat('alice')));
  });

  it('rejects someone else as owner and non-zero counters', async () => {
    const db = as(t.env, 'alice');
    const a = writeBatch(db);
    a.set(doc(db, 'workspaces/w2'), workspace('bob'));
    a.set(doc(db, 'workspaces/w2/members/alice'), seat('alice'));
    await assertFails(a.commit());
    await assertFails(bootstrap('alice', { workspace: { beneficiaryCount: 5 } }));
  });

  it('cannot self-create an admin seat or built-in role in an existing workspace', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, OUTSIDER);
    await assertFails(setDoc(doc(db, `workspaces/${WID}/members/${OUTSIDER}`), seat(OUTSIDER)));
    await assertFails(setDoc(doc(db, `workspaces/${WID}/members/${OUTSIDER}`), seat(OUTSIDER, 'member')));
    await assertFails(setDoc(doc(db, `workspaces/${WID}/roles/member`), role(OUTSIDER, 'M', ALL_KEYS, false)));
  });
});

describe('workspace access', () => {
  it('members read, outsiders cannot', async () => {
    await seedWorkspace(t.env);
    await assertSucceeds(getDoc(doc(as(t.env, MEMBER), `workspaces/${WID}`)));
    await assertSucceeds(getDocs(collection(as(t.env, MEMBER), `workspaces/${WID}/roles`)));
    await assertFails(getDoc(doc(as(t.env, OUTSIDER), `workspaces/${WID}`)));
    await assertFails(getDocs(collection(as(t.env, OUTSIDER), `workspaces/${WID}/members`)));
    await assertFails(getDocs(collection(as(t.env, OUTSIDER), `workspaces/${WID}/roles`)));
  });

  it('collection-group membership query only returns own docs', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, MEMBER);
    await assertSucceeds(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', MEMBER))));
    await assertFails(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', OWNER))));
  });

  it('disabled members lose access', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/members/${MEMBER}`]: memberDoc(MEMBER, 'member', 'disabled') });
    await assertFails(getDoc(doc(as(t.env, MEMBER), `workspaces/${WID}`)));
  });

  it('counters may move by any member; details need workspace.edit', async () => {
    await seedWorkspace(t.env);
    const member = as(t.env, MEMBER);
    await assertSucceeds(updateDoc(doc(member, `workspaces/${WID}`), { beneficiaryCount: 1 }));
    await assertFails(updateDoc(doc(member, `workspaces/${WID}`), { name: 'Hacked' }));
    await assertSucceeds(updateDoc(doc(as(t.env, ADMIN), `workspaces/${WID}`), { name: 'Renamed' }));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `workspaces/${WID}`), { ownerId: ADMIN }));
    await seedWorkspace(t.env, [...MEMBER_KEYS, 'workspace.edit']);
    await assertSucceeds(updateDoc(doc(member, `workspaces/${WID}`), { name: 'By member' }));
  });

  it('workspace.delete soft-deletes; nobody hard-deletes', async () => {
    await seedWorkspace(t.env);
    await assertFails(
      updateDoc(doc(as(t.env, MEMBER), `workspaces/${WID}`), { isDeleted: true, deletedAt: serverTimestamp(), deletedBy: MEMBER }),
    );
    await assertFails(deleteDoc(doc(as(t.env, OWNER), `workspaces/${WID}`)));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `workspaces/${WID}`), { isDeleted: true }));
    await assertSucceeds(
      updateDoc(doc(as(t.env, ADMIN), `workspaces/${WID}`), { isDeleted: true, deletedAt: serverTimestamp(), deletedBy: ADMIN }),
    );
  });
});

describe('invites', () => {
  it('inviters create invites with long codes, bounded expiry and a live role', async () => {
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
    await assertFails(setDoc(doc(db, `workspaces/${WID}/invites/${CODE}y`), { ...fresh, roleId: 'ghost' }));
    await assertFails(setDoc(doc(db, `workspaces/${WID}/invites/${CODE}w`), { ...fresh, role: 'owner' }));
  });

  it('members without members.invite cannot create or list invites', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    const db = as(t.env, MEMBER);
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/invites/${CODE}z`), { ...inviteDoc({ createdBy: MEMBER }), createdAt: serverTimestamp() }),
    );
    await assertFails(getDocs(collection(db, `workspaces/${WID}/invites`)));
    await assertSucceeds(getDocs(collection(as(t.env, ADMIN), `workspaces/${WID}/invites`)));
  });

  it('a non-admin inviter only invites to roles within their own keys', async () => {
    const inviter = [...MEMBER_KEYS, 'members.invite'];
    await seedWorkspace(t.env, inviter, { field: ['beneficiaries.view'], lead: [...inviter, 'beneficiaries.edit'] });
    const db = as(t.env, MEMBER);
    const invite = (roleId: string, code: string) =>
      setDoc(doc(db, `workspaces/${WID}/invites/${code}`), {
        ...inviteDoc({ roleId, roleName: roleId, createdBy: MEMBER }),
        createdAt: serverTimestamp(),
      });
    await assertSucceeds(invite('field', `${CODE}1`));
    await assertSucceeds(invite('member', `${CODE}2`));
    await assertFails(invite('lead', `${CODE}3`));
    await assertFails(invite('admin', `${CODE}4`));
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
      roleId: 'member',
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

  it('redeems a valid invite with the copied role', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    await assertSucceeds(redeem(OUTSIDER));
    await assertSucceeds(getDoc(doc(as(t.env, OUTSIDER), `workspaces/${WID}`)));
  });

  it('rejects escalation, reuse, expired invites and deleted roles', async () => {
    await seedWorkspace(t.env, MEMBER_KEYS, { field: ['beneficiaries.view'] });
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    await assertFails(redeem(OUTSIDER, { roleId: 'admin' }));
    await assertFails(redeem(OUTSIDER, { permissions: ALL_KEYS }));
    await assertSucceeds(redeem(OUTSIDER));
    await assertFails(redeem('second'));

    await seed(t.env, {
      [`workspaces/${WID}/invites/${CODE}`]: inviteDoc({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) }),
    });
    await assertFails(redeem('third'));

    await seed(t.env, {
      [`workspaces/${WID}/invites/${CODE}`]: inviteDoc({ roleId: 'field', roleName: 'field' }),
      [`workspaces/${WID}/roles/field`]: { name: 'field', permissions: [], isLocked: false, isDeleted: true },
    });
    await assertFails(redeem('fourth', { roleId: 'field' }));
  });

  it('member doc without consuming the invite fails', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    const db = as(t.env, OUTSIDER);
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/members/${OUTSIDER}`), {
        userId: OUTSIDER, roleId: 'member', status: 'active',
        joinedAt: serverTimestamp(), inviteCode: CODE, displayName: 'o', email: 'o@x.com',
      }),
    );
  });

  it('inviters revoke (delete) invites', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`workspaces/${WID}/invites/${CODE}`]: inviteDoc() });
    await assertFails(deleteDoc(doc(as(t.env, MEMBER), `workspaces/${WID}/invites/${CODE}`)));
    await assertSucceeds(deleteDoc(doc(as(t.env, ADMIN), `workspaces/${WID}/invites/${CODE}`)));
  });
});

describe('member management', () => {
  const memberRef = (uid: string, target: string) => doc(as(t.env, uid), `workspaces/${WID}/members/${target}`);

  it('nobody changes their own role or status', async () => {
    await seedWorkspace(t.env);
    await assertFails(updateDoc(memberRef(MEMBER, MEMBER), { roleId: 'admin' }));
    await assertFails(updateDoc(memberRef(ADMIN, ADMIN), { roleId: 'member' }));
    await assertFails(updateDoc(memberRef(ADMIN, ADMIN), { status: 'disabled' }));
    await assertFails(updateDoc(memberRef(MEMBER, MEMBER), { permissions: ALL_KEYS }));
    await assertSucceeds(updateDoc(memberRef(MEMBER, MEMBER), { displayName: 'New name' }));
  });

  it('admins change roles and status of others, never the creator seat', async () => {
    await seedWorkspace(t.env, MEMBER_KEYS, { field: ['beneficiaries.view'] });
    await assertSucceeds(updateDoc(memberRef(ADMIN, MEMBER), { roleId: 'field', updatedBy: ADMIN }));
    await assertFails(updateDoc(memberRef(ADMIN, MEMBER), { roleId: 'ghost' }));
    await assertSucceeds(updateDoc(memberRef(ADMIN, MEMBER), { status: 'disabled' }));
    await assertFails(updateDoc(memberRef(ADMIN, OWNER), { status: 'disabled' }));
    await assertFails(updateDoc(memberRef(ADMIN, OWNER), { roleId: 'member' }));
    // The creator may demote another admin.
    await assertSucceeds(updateDoc(memberRef(OWNER, ADMIN), { roleId: 'member' }));
  });

  it('a non-admin manager only acts on members they outrank, and only grants roles they hold', async () => {
    const manager = [...MEMBER_KEYS, 'members.edit-role', 'members.disable', 'members.remove'];
    await seedWorkspace(t.env, manager, { field: ['beneficiaries.view'], lead: [...manager, 'beneficiaries.edit'] });
    await seed(t.env, {
      [`workspaces/${WID}/members/f1`]: memberDoc('f1', 'field'),
      [`workspaces/${WID}/members/l1`]: memberDoc('l1', 'lead'),
    });
    await assertSucceeds(updateDoc(memberRef(MEMBER, 'f1'), { roleId: 'member' }));
    await assertFails(updateDoc(memberRef(MEMBER, 'f1'), { roleId: 'lead' }));
    await assertFails(updateDoc(memberRef(MEMBER, 'f1'), { roleId: 'admin' }));
    await assertFails(updateDoc(memberRef(MEMBER, 'l1'), { roleId: 'field' }));
    await assertFails(updateDoc(memberRef(MEMBER, 'l1'), { status: 'disabled' }));
    await assertFails(updateDoc(memberRef(MEMBER, ADMIN), { status: 'disabled' }));
    await assertFails(deleteDoc(memberRef(MEMBER, 'l1')));
    await assertSucceeds(deleteDoc(memberRef(MEMBER, 'f1')));
  });

  it('the creator seat cannot be removed; members can leave; admins remove others', async () => {
    await seedWorkspace(t.env);
    await assertFails(deleteDoc(memberRef(OWNER, OWNER)));
    await assertFails(deleteDoc(memberRef(ADMIN, OWNER)));
    await assertFails(deleteDoc(memberRef(MEMBER, ADMIN)));
    await assertSucceeds(deleteDoc(memberRef(MEMBER, MEMBER)));
    await seedWorkspace(t.env);
    await assertSucceeds(deleteDoc(memberRef(ADMIN, MEMBER)));
  });

  it('the creator transfers the seat to an active admin by changing ownerId only', async () => {
    await seedWorkspace(t.env);
    const db = as(t.env, OWNER);
    await assertFails(updateDoc(doc(db, `workspaces/${WID}`), { ownerId: MEMBER }));
    await assertFails(updateDoc(doc(db, `workspaces/${WID}`), { ownerId: OUTSIDER }));
    await assertSucceeds(updateDoc(doc(db, `workspaces/${WID}`), { ownerId: ADMIN, updatedAt: serverTimestamp() }));
    // The new creator seat is locked; the previous creator is now a regular admin.
    await assertFails(updateDoc(memberRef(OWNER, ADMIN), { roleId: 'member' }));
    await assertSucceeds(updateDoc(memberRef(ADMIN, OWNER), { roleId: 'member' }));
  });

  it('other admins cannot transfer ownership', async () => {
    await seedWorkspace(t.env);
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `workspaces/${WID}`), { ownerId: ADMIN }));
  });
});

describe('audit log', () => {
  it('append-only, members write their own events, audit.view reads', async () => {
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
