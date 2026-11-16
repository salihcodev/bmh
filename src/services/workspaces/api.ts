import {
  deleteField,
  getDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getRandomBytes } from 'expo-crypto';

import {
  generateInviteCode,
  INVITE_TTL_DAYS,
  inviteLink,
  inviteState,
  inviteToken,
  parseInvite,
} from '@/domain/invite';
import type { Invite, Member } from '@/domain/types';
import { db } from '@/services/firebase/client';
import { addEvent, newId, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground, commitOnline } from '@/services/firebase/write';
import { defaultPermissionsFor, sanitizePermissions, type PermissionMap, type Role } from '@/services/permissions/matrix';
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

/** Online only: the workspace and owner member doc are created together and validated by rules. */
export async function createWorkspace(input: { name: string; description?: string }, actor: ActorProfile) {
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(refs.member(wid, actor.uid), {
    userId: actor.uid,
    role: 'owner',
    permissions: defaultPermissionsFor('owner'),
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
    role: invite.role,
    permissions: invite.permissions,
    status: 'active',
    joinedAt: serverTimestamp(),
    inviteCode: code,
    displayName: actor.name,
    email: actor.email,
  });
  batch.update(refs.invite(workspaceId, code), { used: true, usedBy: actor.uid, usedAt: serverTimestamp() });
  await commitOnline(batch);
  audit(workspaceId, actor, 'member_joined', { role: invite.role, inviteCode: code.slice(0, 4) });
  rememberWorkspace(actor.uid, workspaceId);
}

export async function createInvite(
  workspace: { id: string; name: string },
  role: Exclude<Role, 'owner'>,
  permissions: PermissionMap,
  actor: Actor,
) {
  await requireOnline();
  const code = generateInviteCode(getRandomBytes);
  const batch = writeBatch(db);
  const grants = role === 'admin' ? defaultPermissionsFor('admin') : sanitizePermissions(permissions);
  batch.set(refs.invite(workspace.id, code), {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role,
    permissions: grants,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    used: false,
    usedBy: null,
    usedAt: null,
  });
  addEvent(batch, refs.audit(workspace.id), { workspaceId: workspace.id }, actor, 'invite_created', { role });
  await commitOnline(batch);
  return { code, token: inviteToken(workspace.id, code), link: inviteLink(workspace.id, code) };
}

export async function revokeInvite(wid: string, code: string, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.delete(refs.invite(wid, code));
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'invite_revoked', {});
  await commitOnline(batch);
}

export async function updateMember(
  wid: string,
  member: Member,
  next: { role: Exclude<Role, 'owner'>; permissions: PermissionMap; status: Member['status'] },
  actor: Actor,
) {
  await requireOnline();
  const batch = writeBatch(db);
  const permissions = next.role === 'admin' ? defaultPermissionsFor('admin') : sanitizePermissions(next.permissions);
  batch.update(refs.member(wid, member.id), {
    role: next.role,
    permissions,
    status: next.status,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'member_updated', {
    memberId: member.id,
    before: { role: member.role, status: member.status, permissions: member.permissions },
    after: { role: next.role, status: next.status, permissions },
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

export async function transferOwnership(wid: string, target: Member, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.update(refs.workspace(wid), { ownerId: target.id, updatedAt: serverTimestamp() });
  batch.update(refs.member(wid, target.id), { role: 'owner', updatedAt: serverTimestamp(), updatedBy: actor.uid });
  batch.update(refs.member(wid, actor.uid), { role: 'admin', updatedAt: serverTimestamp(), updatedBy: actor.uid });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'ownership_transferred', {
    from: actor.uid,
    to: target.id,
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
