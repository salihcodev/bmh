import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach } from 'vitest';

export const WID = 'ws1';
export const OWNER = 'owner';
export const ADMIN = 'admin';
export const MEMBER = 'member';
export const OUTSIDER = 'outsider';

const ALL = [
  'beneficiaries_view', 'beneficiaries_create', 'beneficiaries_edit', 'beneficiaries_archive',
  'beneficiaries_export', 'beneficiaries_import', 'areas_manage', 'members_manage', 'sessions_create',
  'sessions_run', 'sessions_reassign', 'sessions_view_history', 'assistance_record', 'history_view',
];
export const ALL_PERMS = Object.fromEntries(ALL.map((k) => [k, true]));
export const MEMBER_PERMS = { beneficiaries_view: true, sessions_view_history: true, history_view: true };

export function useRulesEnv(projectId = 'demo-be-my-hand') {
  const holder: { env: RulesTestEnvironment } = { env: undefined as unknown as RulesTestEnvironment };
  beforeAll(async () => {
    holder.env = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
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

export function memberDoc(uid: string, role: 'owner' | 'admin' | 'member', permissions: Record<string, boolean> = {}) {
  return {
    userId: uid,
    role,
    permissions: role === 'member' ? permissions : ALL_PERMS,
    status: 'active',
    joinedAt: Timestamp.now(),
    displayName: uid,
    email: `${uid}@x.com`,
  };
}

/** Workspace with owner, admin and a default member (optionally extra member perms). */
export async function seedWorkspace(env: RulesTestEnvironment, memberPerms: Record<string, boolean> = MEMBER_PERMS) {
  await seed(env, {
    [`workspaces/${WID}`]: {
      name: 'WS',
      ownerId: OWNER,
      beneficiaryCount: 0,
      areaCount: 0,
      cityCount: 0,
      sessionCount: 0,
      createdAt: Timestamp.now(),
    },
    [`workspaces/${WID}/members/${OWNER}`]: memberDoc(OWNER, 'owner'),
    [`workspaces/${WID}/members/${ADMIN}`]: memberDoc(ADMIN, 'admin'),
    [`workspaces/${WID}/members/${MEMBER}`]: memberDoc(MEMBER, 'member', memberPerms),
  });
}

export const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcd';

export function inviteDoc(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: WID,
    workspaceName: 'WS',
    role: 'member',
    permissions: MEMBER_PERMS,
    createdBy: ADMIN,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000),
    used: false,
    usedBy: null,
    usedAt: null,
    ...overrides,
  };
}
