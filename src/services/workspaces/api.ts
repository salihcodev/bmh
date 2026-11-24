import {
  deleteField,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getRandomBytes } from 'expo-crypto';

import { env } from '@/config/env';
import {
  generateInviteCode,
  INVITE_TTL_DAYS,
  inviteLink,
  inviteState,
  inviteToken,
  parseInvite,
} from '@/domain/invite';
import type { Invite, Member, WorkspaceRole } from '@/domain/types';
import { db } from '@/services/firebase/client';
import { addEvent, newId, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground, commitOnline } from '@/services/firebase/write';
import {
  sanitizeKeys,
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MEMBER_ROLE,
  WORKSPACE_ROLE_SEEDS,
} from '@/services/permissions/catalog';
import { requireOnline } from '@/services/sync/connectivity';

export type ActorProfile = Actor & { email: string };

function audit(wid: string, actor: Actor, type: string, metadata = {}) {
  const batch = writeBatch(db);
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, type, metadata);
  commitInBackground(batch, type);
}

function rememberWorkspace(uid: string, wid: string) {
  const batch = writeBatch(db);
  batch.update(refs.user(uid), { lastWorkspaceId: wid });
  commitInBackground(batch, 'lastWorkspaceId');
}

/**
 * Online only. The workspace, the creator's admin seat and the two built-in roles are created
 * together; the rules check all four with getAfter.
 */
export async function createWorkspace(
  input: { name: string; description?: string },
  actor: ActorProfile,
  roleNames: { admin: string; member: string },
) {
  await requireOnline();
  const wid = newId(refs.workspaces());
  const batch = writeBatch(db);
  batch.set(refs.workspace(wid), {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    ownerId: actor.uid,
    beneficiaryCount: 0,
    areaCount: 0,
    cityCount: 0,
    sessionCount: 0,
    isDeleted: false,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  for (const seed of WORKSPACE_ROLE_SEEDS) {
    batch.set(refs.role(wid, seed.id), {
      name: seed.id === WORKSPACE_ADMIN_ROLE ? roleNames.admin : roleNames.member,
      permissions: seed.permissions,
      isLocked: seed.isLocked,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
    });
  }
  batch.set(refs.member(wid, actor.uid), {
    userId: actor.uid,
    roleId: WORKSPACE_ADMIN_ROLE,
    status: 'active',
    joinedAt: serverTimestamp(),
    displayName: actor.name,
    email: actor.email,
  });
  await commitOnline(batch);
  // The audit rule needs an existing membership, so it follows the bootstrap batch.
  audit(wid, actor, 'workspace_created', { name: input.name.trim() });
  rememberWorkspace(actor.uid, wid);
  return wid;
}

export type InviteLookup =
  | { ok: true; workspaceId: string; code: string; invite: Invite }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' };

export async function lookupInvite(input: string): Promise<InviteLookup> {
  const parsed = parseInvite(input);
  if (!parsed) return { ok: false, reason: 'invalid' };
  await requireOnline();
  const snapshot = await getDoc(refs.invite(parsed.workspaceId, parsed.code));
  if (!snapshot.exists()) return { ok: false, reason: 'invalid' };
  const invite = { id: snapshot.id, ...(snapshot.data() as Omit<Invite, 'id'>) };
  const state = inviteState(invite);
  if (state !== 'valid') return { ok: false, reason: state };
  return { ok: true, ...parsed, invite };
}

/** Online only. Member doc + invite consumption in one batch so rules can verify both. */
export async function redeemInvite(workspaceId: string, code: string, invite: Invite, actor: ActorProfile) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.set(refs.member(workspaceId, actor.uid), {
    userId: actor.uid,
    roleId: invite.roleId,
    status: 'active',
    joinedAt: serverTimestamp(),
    inviteCode: code,
    displayName: actor.name,
    email: actor.email,
  });
  batch.update(refs.invite(workspaceId, code), { used: true, usedBy: actor.uid, usedAt: serverTimestamp() });
  await commitOnline(batch);
  audit(workspaceId, actor, 'member_joined', { roleId: invite.roleId, inviteCode: code.slice(0, 4) });
  rememberWorkspace(actor.uid, workspaceId);
}

export async function createInvite(
  workspace: { id: string; name: string },
  role: { id: string; name: string },
  actor: Actor,
) {
  await requireOnline();
  const code = generateInviteCode(getRandomBytes);
  const batch = writeBatch(db);
  batch.set(refs.invite(workspace.id, code), {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    roleId: role.id,
    roleName: role.name.slice(0, 40),
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    used: false,
    usedBy: null,
    usedAt: null,
  });
  addEvent(batch, refs.audit(workspace.id), { workspaceId: workspace.id }, actor, 'invite_created', { roleId: role.id });
  await commitOnline(batch);
  return { code, token: inviteToken(workspace.id, code), link: inviteLink(workspace.id, code, env.linkDomain) };
}

export async function revokeInvite(wid: string, code: string, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.delete(refs.invite(wid, code));
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'invite_revoked', {});
  await commitOnline(batch);
}

export async function setMemberRole(wid: string, member: Member, roleId: string, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.update(refs.member(wid, member.id), { roleId, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'member_role_changed', {
    memberId: member.id,
    before: member.roleId,
    after: roleId,
  });
  await commitOnline(batch);
}

export async function setMemberStatus(wid: string, member: Member, status: Member['status'], actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.update(refs.member(wid, member.id), { status, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, status === 'active' ? 'member_enabled' : 'member_disabled', {
    memberId: member.id,
  });
  await commitOnline(batch);
}

export async function removeMember(wid: string, member: Member, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'member_removed', {
    memberId: member.id,
    name: member.displayName,
  });
  batch.delete(refs.member(wid, member.id));
  await commitOnline(batch);
}

export async function leaveWorkspace(wid: string, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  // The audit create is evaluated against pre-batch membership, so it can share the batch.
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'member_left', {});
  batch.delete(refs.member(wid, actor.uid));
  await commitOnline(batch);
}

/** Hands the creator's locked admin seat to another admin. Both stay admins. */
export async function transferOwnership(wid: string, target: Member, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.update(refs.workspace(wid), { ownerId: target.id, updatedAt: serverTimestamp() });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'ownership_transferred', {
    from: actor.uid,
    to: target.id,
  });
  await commitOnline(batch);
}

/** Soft delete. Members stop seeing it; records stay for recovery. */
export async function deleteWorkspace(wid: string, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'workspace_deleted', {});
  batch.update(refs.workspace(wid), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  await commitOnline(batch);
}

/** Name/description edits are safe offline. */
export function updateWorkspaceDetails(wid: string, input: { name: string; description?: string }) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.workspace(wid), {
      name: input.name.trim(),
      description: input.description?.trim() ? input.description.trim() : deleteField(),
      updatedAt: serverTimestamp(),
    });
    return batch;
  };
  commitInBackground(build(), 'workspace_details', build);
}

export function setLastWorkspace(uid: string, wid: string) {
  rememberWorkspace(uid, wid);
}

// ---------- workspace roles ----------

export async function saveWorkspaceRole(
  wid: string,
  roleId: string | null,
  input: { name: string; permissions: readonly string[] },
  actor: Actor,
): Promise<string> {
  await requireOnline();
  const id = roleId ?? newId(refs.roles(wid));
  if (id === WORKSPACE_ADMIN_ROLE) throw new Error('The admin role is locked');
  const permissions = sanitizeKeys(input.permissions, 'workspace');
  const batch = writeBatch(db);
  if (roleId) {
    batch.update(refs.role(wid, id), {
      name: input.name.trim().slice(0, 40),
      permissions,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  } else {
    batch.set(refs.role(wid, id), {
      name: input.name.trim().slice(0, 40),
      permissions,
      isLocked: false,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
    });
  }
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, roleId ? 'role_updated' : 'role_created', {
    roleId: id,
    name: input.name.trim(),
    permissions,
  });
  await commitOnline(batch);
  return id;
}

export type RoleDeleteResult = 'deleted' | 'in-use' | 'locked';

/** Soft delete, only when nobody holds the role (a deleted role grants nothing). */
export async function deleteWorkspaceRole(wid: string, role: WorkspaceRole, actor: Actor): Promise<RoleDeleteResult> {
  if (role.isLocked || role.id === WORKSPACE_MEMBER_ROLE) return 'locked';
  await requireOnline();
  const holders = await getDocs(query(refs.members(wid), where('roleId', '==', role.id), limit(1)));
  if (!holders.empty) return 'in-use';
  const batch = writeBatch(db);
  batch.update(refs.role(wid, role.id), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'role_deleted', { roleId: role.id, name: role.name });
  await commitOnline(batch);
  return 'deleted';
}
