import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import {
  SYSTEM_ROLE_SEEDS,
  WORKSPACE_PERMISSIONS,
} from '../../src/services/permissions/catalog';

export const WID = 'ws1';
/** The workspace creator: an admin whose seat is locked (workspace.ownerId). */
export const OWNER = 'owner';
export const ADMIN = 'admin';
export const MEMBER = 'member';
export const OUTSIDER = 'outsider';

export const ALL_KEYS: string[] = [...WORKSPACE_PERMISSIONS];
/** What `roles/member` holds in these tests unless a test passes its own keys. */
export const MEMBER_KEYS = ['beneficiaries.view', 'sessions.view', 'history.view'];

export function setupRulesEnv(projectId = 'demo-be-my-hand') {
  const holder: { env: RulesTestEnvironment } = { env: undefined as unknown as RulesTestEnvironment };
  beforeAll(async () => {
    holder.env = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        // RULES_FILE lets the suite run against another ruleset, e.g. the deployed test-mode fixture.
        rules: readFileSync(resolve(process.cwd(), process.env.RULES_FILE ?? 'firestore.rules'), 'utf8'),
      },
    });
  });
  beforeEach(async () => holder.env.clearFirestore());
  afterAll(async () => holder.env.cleanup());
  return holder;
}

export function as(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

export async function seed(env: RulesTestEnvironment, writes: Record<string, Record<string, unknown>>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(writes)) await setDoc(doc(db, path), data);
  });
}

export function memberDoc(uid: string, roleId: string, status: 'active' | 'disabled' = 'active') {
  return {
    userId: uid,
    roleId,
    status,
    joinedAt: Timestamp.now(),
    displayName: uid,
    email: `${uid}@x.com`,
  };
}

export function roleDoc(name: string, permissions: string[], overrides: Record<string, unknown> = {}) {
  return {
    name,
    permissions,
    isLocked: false,
    isDeleted: false,
    createdAt: Timestamp.now(),
    createdBy: OWNER,
    ...overrides,
  };
}

/** Workspace docs for `wid`: roles/admin (locked), roles/member, plus extra custom roles. */
export function workspaceDocs(
  wid: string,
  ownerId: string,
  memberKeys: string[] = MEMBER_KEYS,
  roles: Record<string, string[]> = {},
) {
  const docs: Record<string, Record<string, unknown>> = {
    [`workspaces/${wid}`]: {
      name: 'WS',
      ownerId,
      beneficiaryCount: 0,
      areaCount: 0,
      cityCount: 0,
      sessionCount: 0,
      isDeleted: false,
      createdAt: Timestamp.now(),
    },
    [`workspaces/${wid}/roles/admin`]: roleDoc('Admin', ALL_KEYS, { isLocked: true }),
    [`workspaces/${wid}/roles/member`]: roleDoc('Member', memberKeys),
  };
  for (const [id, keys] of Object.entries(roles)) docs[`workspaces/${wid}/roles/${id}`] = roleDoc(id, keys);
  return docs;
}

/** Workspace with the creator (admin), a second admin and a member on roles/member. */
export async function seedWorkspace(
  env: RulesTestEnvironment,
  memberKeys: string[] = MEMBER_KEYS,
  roles: Record<string, string[]> = {},
) {
  await seed(env, {
    ...workspaceDocs(WID, OWNER, memberKeys, roles),
    [`workspaces/${WID}/members/${OWNER}`]: memberDoc(OWNER, 'admin'),
    [`workspaces/${WID}/members/${ADMIN}`]: memberDoc(ADMIN, 'admin'),
    [`workspaces/${WID}/members/${MEMBER}`]: memberDoc(MEMBER, 'member'),
  });
}

export function userDoc(displayName: string, overrides: Record<string, unknown> = {}) {
  return {
    displayName,
    email: `${displayName.toLowerCase()}@x.com`,
    locale: 'ar',
    userType: 'member',
    systemRoleId: null,
    supplierStatus: 'none',
    status: 'active',
    isDeleted: false,
    schemaVersion: 3,
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

/** The platform owner (userType owner bypasses role lookups). */
export const SUPER = 'super';
export const SUPPORT = 'support';
export const MODERATOR = 'moderator';

/** Seeded with rules disabled: system accounts are only created by the seed script. */
export async function seedSuperAdmin(env: RulesTestEnvironment, status: 'active' | 'suspended' = 'active') {
  await seed(env, { [`users/${SUPER}`]: userDoc('Super', { userType: 'owner', status }) });
}

/** systemRoles/{support,moderator} from the catalog seeds, plus one account on each. */
export async function seedStaff(env: RulesTestEnvironment) {
  const writes: Record<string, Record<string, unknown>> = {};
  for (const role of SYSTEM_ROLE_SEEDS) {
    writes[`systemRoles/${role.id}`] = {
      name: role.name,
      permissions: role.permissions,
      isLocked: role.isLocked,
      isDeleted: false,
      createdAt: Timestamp.now(),
    };
  }
  writes[`users/${SUPPORT}`] = userDoc('Support', { userType: 'support', systemRoleId: 'support' });
  writes[`users/${MODERATOR}`] = userDoc('Moderator', { userType: 'moderator', systemRoleId: 'moderator' });
  await seed(env, writes);
}

export const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcd';

export function inviteDoc(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: WID,
    workspaceName: 'WS',
    roleId: 'member',
    roleName: 'Member',
    createdBy: ADMIN,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000),
    used: false,
    usedBy: null,
    usedAt: null,
    ...overrides,
  };
}
