import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { describe, it } from 'vitest';

import {
  ADMIN,
  as,
  MEMBER,
  MEMBER_KEYS,
  MODERATOR,
  OUTSIDER,
  OWNER,
  seed,
  seedStaff,
  seedSuperAdmin,
  seedWorkspace,
  setupRulesEnv,
  SUPER,
  SUPPORT,
  userDoc,
  WID,
} from './helpers';

const t = setupRulesEnv();
const W = `workspaces/${WID}`;

const newRole = (uid: string, permissions: string[], name = 'Field') => ({
  name, permissions, isLocked: false, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid,
});
const softDelete = (uid: string) => ({ isDeleted: true, deletedAt: serverTimestamp(), deletedBy: uid });

describe('workspace roles', () => {
  it('admins create custom roles; members without workspace-roles.create cannot', async () => {
    await seedWorkspace(t.env);
    await assertSucceeds(setDoc(doc(as(t.env, ADMIN), `${W}/roles/field`), newRole(ADMIN, ['beneficiaries.view'])));
    await assertFails(setDoc(doc(as(t.env, MEMBER), `${W}/roles/f2`), newRole(MEMBER, ['beneficiaries.view'])));
    await assertFails(setDoc(doc(as(t.env, ADMIN), `${W}/roles/f3`), { ...newRole(ADMIN, []), isLocked: true }));
    await assertFails(setDoc(doc(as(t.env, ADMIN), `${W}/roles/f4`), { ...newRole(ADMIN, []), name: '' }));
  });

  it('a non-admin role creator never composes keys they lack (anti-escalation)', async () => {
    const creator = [...MEMBER_KEYS, 'workspace-roles.create'];
    await seedWorkspace(t.env, creator);
    const db = as(t.env, MEMBER);
    await assertSucceeds(setDoc(doc(db, `${W}/roles/r1`), newRole(MEMBER, ['beneficiaries.view'])));
    await assertFails(setDoc(doc(db, `${W}/roles/r2`), newRole(MEMBER, ['beneficiaries.view', 'beneficiaries.edit'])));
  });

  it('admin is locked; member is editable but never deleted; custom roles soft-delete', async () => {
    await seedWorkspace(t.env, MEMBER_KEYS, { field: ['beneficiaries.view'] });
    const db = as(t.env, ADMIN);
    await assertFails(updateDoc(doc(db, `${W}/roles/admin`), { name: 'Boss' }));
    await assertFails(updateDoc(doc(db, `${W}/roles/admin`), softDelete(ADMIN)));
    await assertSucceeds(updateDoc(doc(db, `${W}/roles/member`), { permissions: ['beneficiaries.view'], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `${W}/roles/member`), softDelete(ADMIN)));
    await assertFails(updateDoc(doc(db, `${W}/roles/field`), { isLocked: true }));
    await assertSucceeds(updateDoc(doc(db, `${W}/roles/field`), softDelete(ADMIN)));
    await assertFails(updateDoc(doc(db, `${W}/roles/field`), { name: 'Revived' }));
    await assertFails(deleteDoc(doc(db, `${W}/roles/member`)));
  });

  it('a non-admin editor cannot touch a role holding keys they lack', async () => {
    const editor = [...MEMBER_KEYS, 'workspace-roles.edit', 'workspace-roles.delete'];
    await seedWorkspace(t.env, editor, { big: [...editor, 'beneficiaries.edit'], small: ['beneficiaries.view'] });
    const db = as(t.env, MEMBER);
    await assertFails(updateDoc(doc(db, `${W}/roles/big`), { name: 'Big 2' }));
    await assertFails(updateDoc(doc(db, `${W}/roles/big`), softDelete(MEMBER)));
    await assertSucceeds(updateDoc(doc(db, `${W}/roles/small`), { name: 'Small 2' }));
    await assertFails(updateDoc(doc(db, `${W}/roles/small`), { permissions: ['beneficiaries.edit'] }));
    await assertSucceeds(updateDoc(doc(db, `${W}/roles/small`), softDelete(MEMBER)));
  });

  it('a deleted or missing role grants nothing', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`${W}/beneficiaries/b1`]: { workspaceId: WID, fullName: 'P', isArchived: false } });
    await assertSucceeds(getDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b1`)));
    await seed(t.env, { [`${W}/roles/member`]: { name: 'Member', permissions: MEMBER_KEYS, isLocked: false, isDeleted: true } });
    await assertFails(getDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b1`)));
    await seed(t.env, { [`${W}/members/${MEMBER}`]: { userId: MEMBER, roleId: 'ghost', status: 'active', joinedAt: Timestamp.now() } });
    await assertFails(getDoc(doc(as(t.env, MEMBER), `${W}/beneficiaries/b1`)));
    // The workspace itself stays readable: membership, not a key.
    await assertSucceeds(getDoc(doc(as(t.env, MEMBER), W)));
  });

  it('holder lookup: members query by roleId before deleting a role', async () => {
    await seedWorkspace(t.env);
    await assertSucceeds(getDocs(query(collection(as(t.env, ADMIN), `${W}/members`), where('roleId', '==', 'member'))));
  });
});

describe('sessions soft delete', () => {
  const session = (status: string) => ({
    workspaceId: WID, status, operatorId: MEMBER, startedBy: MEMBER, createdBy: MEMBER, cityId: 'c1', areaIds: ['a1'],
    beneficiaryCount: 1, checkedCount: 0, ignoredCount: 0, contactActionsCount: 0, createdAt: Timestamp.now(),
  });

  it('only ended sessions, only with sessions.delete, only as a soft delete', async () => {
    await seedWorkspace(t.env);
    await seed(t.env, { [`${W}/sessions/ended`]: session('ended'), [`${W}/sessions/live`]: session('active') });
    await assertFails(updateDoc(doc(as(t.env, MEMBER), `${W}/sessions/ended`), softDelete(MEMBER)));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `${W}/sessions/live`), softDelete(ADMIN)));
    await assertFails(updateDoc(doc(as(t.env, ADMIN), `${W}/sessions/ended`), { ...softDelete(ADMIN), checkedCount: 1 }));
    await assertSucceeds(updateDoc(doc(as(t.env, ADMIN), `${W}/sessions/ended`), softDelete(ADMIN)));
    await assertFails(deleteDoc(doc(as(t.env, ADMIN), `${W}/sessions/ended`)));
  });
});

describe('system roles', () => {
  const sysRole = (uid: string, permissions: string[]) => ({
    name: { en: 'Team', ar: 'فريق' }, permissions, isLocked: false, isDeleted: false, createdAt: serverTimestamp(), createdBy: uid,
  });

  it('the owner creates and edits system roles; the owner role is locked', async () => {
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    const db = as(t.env, SUPER);
    await assertSucceeds(setDoc(doc(db, 'systemRoles/team'), sysRole(SUPER, ['users.view'])));
    await assertSucceeds(updateDoc(doc(db, 'systemRoles/support'), { permissions: ['users.view'], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'systemRoles/owner'), { permissions: [] }));
    await assertFails(updateDoc(doc(db, 'systemRoles/owner'), softDelete(SUPER)));
    await assertFails(deleteDoc(doc(db, 'systemRoles/support')));
    await assertSucceeds(getDocs(collection(db, 'systemRoles')));
  });

  it('staff without roles.* cannot manage roles; a roles.create holder cannot exceed their keys', async () => {
    await seedStaff(t.env);
    await assertFails(setDoc(doc(as(t.env, MODERATOR), 'systemRoles/x'), sysRole(MODERATOR, [])));
    await assertFails(getDocs(collection(as(t.env, SUPPORT), 'systemRoles')));
    await seed(t.env, {
      'users/hr': userDoc('Hr', { userType: 'custom', systemRoleId: 'hr' }),
      'systemRoles/hr': {
        name: { en: 'HR', ar: 'موارد' }, permissions: ['roles.create', 'users.view'], isLocked: false, isDeleted: false,
        createdAt: Timestamp.now(),
      },
    });
    const hr = as(t.env, 'hr');
    await assertSucceeds(setDoc(doc(hr, 'systemRoles/viewer'), sysRole('hr', ['users.view'])));
    await assertFails(setDoc(doc(hr, 'systemRoles/boss'), sysRole('hr', ['users.view', 'users.suspend'])));
  });
});

describe('catalog and presets', () => {
  it('the catalog is read-only for everyone', async () => {
    await seedSuperAdmin(t.env);
    await seed(t.env, {
      'users/alice': userDoc('Alice'),
      'permissions/users.view': { group: 'users', scope: 'system' },
      'permissionGroups/users': { scope: 'system' },
    });
    await assertSucceeds(getDoc(doc(as(t.env, 'alice'), 'permissions/users.view')));
    await assertSucceeds(getDocs(collection(as(t.env, 'alice'), 'permissionGroups')));
    await assertFails(setDoc(doc(as(t.env, SUPER), 'permissions/users.view'), { group: 'x' }));
    await assertFails(getDoc(doc(t.env.unauthenticatedContext().firestore(), 'permissions/users.view')));
  });

  it('workspace presets are readable by members; system presets need presets.view', async () => {
    await seedSuperAdmin(t.env);
    await seedWorkspace(t.env);
    await seed(t.env, {
      'permissionPresets/field': { name: { en: 'F', ar: 'ف' }, scope: 'workspace', permissions: [], isDeleted: false },
      'permissionPresets/editor': { name: { en: 'E', ar: 'م' }, scope: 'system', permissions: [], isDeleted: false },
    });
    await assertSucceeds(getDoc(doc(as(t.env, MEMBER), 'permissionPresets/field')));
    await assertSucceeds(getDocs(query(collection(as(t.env, OWNER), 'permissionPresets'), where('scope', '==', 'workspace'))));
    await assertFails(getDoc(doc(as(t.env, MEMBER), 'permissionPresets/editor')));
    await assertSucceeds(getDoc(doc(as(t.env, SUPER), 'permissionPresets/editor')));
    await assertFails(
      setDoc(doc(as(t.env, OUTSIDER), 'permissionPresets/x'), {
        name: { en: 'X', ar: 'س' }, scope: 'workspace', permissions: [], isDeleted: false, createdAt: serverTimestamp(), createdBy: OUTSIDER,
      }),
    );
  });
});
