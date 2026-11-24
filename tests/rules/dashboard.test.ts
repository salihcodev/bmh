import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';

import {
  ADMIN,
  as,
  MODERATOR,
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

const staffProfile = (roleId: string, userType = 'custom') => ({
  displayName: 'New staff',
  email: 'new-staff@x.com',
  userType,
  systemRoleId: roleId,
  supplierStatus: 'none',
  status: 'active',
  isDeleted: false,
  schemaVersion: 3,
  onboarding: { step: 'done', completedAt: serverTimestamp() },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const softDelete = (uid: string) => ({
  isDeleted: true,
  deletedAt: serverTimestamp(),
  deletedBy: uid,
  updatedAt: serverTimestamp(),
  updatedBy: uid,
});

describe('dashboard users, roles and presets', () => {
  it('users.create opens a system account and cannot mint an owner', async () => {
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    const owner = as(t.env, SUPER);
    await assertSucceeds(setDoc(doc(owner, 'users/new-staff'), staffProfile('support', 'support')));
    await assertFails(setDoc(doc(owner, 'users/fake-owner'), { ...staffProfile('owner', 'owner'), systemRoleId: null }));
    await assertFails(setDoc(doc(as(t.env, SUPPORT), 'users/other'), staffProfile('support', 'support')));
    await assertFails(setDoc(doc(owner, 'users/locked'), staffProfile('owner', 'custom')));
  });

  it('users.delete and roles.assign skip the actor and the owner', async () => {
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    await seed(t.env, { 'users/member1': userDoc('Member') });
    const owner = as(t.env, SUPER);
    await assertSucceeds(updateDoc(doc(owner, 'users/member1'), softDelete(SUPER)));
    await assertFails(updateDoc(doc(owner, `users/${SUPER}`), softDelete(SUPER)));
    await assertFails(updateDoc(doc(as(t.env, SUPPORT), 'users/member1'), { status: 'suspended', updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(doc(owner, `users/${SUPPORT}`), {
        userType: 'custom',
        systemRoleId: 'moderator',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(t.env, MODERATOR), `users/${SUPPORT}`), {
        userType: 'member',
        systemRoleId: null,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('system roles and presets follow create, anti-escalation and soft delete', async () => {
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    await seed(t.env, {
      'systemRoles/limited': {
        name: { ar: 'محدود', en: 'Limited' },
        permissions: ['roles.create', 'roles.view', 'users.view'],
        isLocked: false,
        isDeleted: false,
        createdAt: new Date(),
      },
      'users/limited': userDoc('Limited', { userType: 'custom', systemRoleId: 'limited' }),
    });
    const role = (uid: string, permissions: string[]) => ({
      name: { ar: 'دور', en: 'Role' },
      permissions,
      isLocked: false,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: uid,
    });
    await assertSucceeds(setDoc(doc(as(t.env, SUPER), 'systemRoles/desk'), role(SUPER, ['users.view'])));
    await assertFails(setDoc(doc(as(t.env, 'limited'), 'systemRoles/too-big'), role('limited', ['users.view', 'users.delete'])));
    await assertSucceeds(setDoc(doc(as(t.env, 'limited'), 'systemRoles/small'), role('limited', ['users.view'])));
    await assertFails(updateDoc(doc(as(t.env, SUPER), 'systemRoles/owner'), { name: { ar: 'لا', en: 'No' } }));
    await assertSucceeds(updateDoc(doc(as(t.env, SUPER), 'systemRoles/desk'), softDelete(SUPER)));
    const preset = (uid: string) => ({
      name: { ar: 'حزمة', en: 'Pack' },
      scope: 'system',
      permissions: ['users.view'],
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: uid,
    });
    await assertSucceeds(setDoc(doc(as(t.env, SUPER), 'permissionPresets/pack'), preset(SUPER)));
    await assertFails(setDoc(doc(as(t.env, SUPPORT), 'permissionPresets/nope'), preset(SUPPORT)));
  });
});

describe('workspace archive', () => {
  it('archive blocks edits until restored, and a soft-deleted workspace stays closed', async () => {
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    await seedWorkspace(t.env);
    const admin = as(t.env, ADMIN);
    await assertSucceeds(updateDoc(doc(admin, W), { name: 'Open', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, SUPPORT), W), { isArchived: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(t.env, MODERATOR), W), { isArchived: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(admin, W), { name: 'Closed', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(t.env, SUPER), W), { isArchived: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(admin, W), { name: 'Open again', updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(doc(as(t.env, SUPER), W), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: SUPER,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(admin, W), { name: 'Gone', updatedAt: serverTimestamp() }));
  });
});
