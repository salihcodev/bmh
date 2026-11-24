import { doc, serverTimestamp, Timestamp, writeBatch, type WriteBatch } from '@react-native-firebase/firestore';

import { auditIcon, summarizeChange, type AdminAction, type AdminTarget, type AuditSummary } from '@/domain/audit-log';
import type { StaffUserType } from '@/domain/dashboard';
import { homeSections, type HomeSection } from '@/domain/home-config';
import type { BannerPayload } from '@/domain/marketing';
import { nameSearchKey } from '@/domain/search';
import { emptySupplierProfile } from '@/domain/supplier-profile';
import { appVersion, devicePlatform } from '@/services/device/info';
import { db } from '@/services/firebase/client';
import { newId, refs, type Actor } from '@/services/firebase/refs';
import { commitOnline } from '@/services/firebase/write';
import { addMediaCreate, addMediaRemove } from '@/services/media/media-writes';
import type { MediaRecordInput } from '@/services/media/media-record';

// Super admin writes. Each one is committed online, in one batch with its adminAuditLog entry,
// so the log can never miss a change that went through. The rules are the enforcement.

export type { AdminAction, AdminTarget } from '@/domain/audit-log';

/** Fields beyond the action itself that make an entry readable on its own. */
export type AuditExtra = {
  /** Name of the target at the time, so the log reads well after the target is renamed or gone. */
  targetName?: string;
  workspaceId?: string;
  /** What changed, as short strings (see `summarizeChange`). */
  summary?: AuditSummary | null;
};

export function audit(
  batch: WriteBatch,
  actor: Actor,
  action: AdminAction,
  targetType: AdminTarget,
  targetId: string,
  metadata: Record<string, unknown> = {},
  extra: AuditExtra = {},
) {
  const ref = doc(refs.adminAuditLog(), newId(refs.adminAuditLog()));
  batch.set(ref, {
    actorId: actor.uid,
    actorName: actor.name,
    ...(actor.avatarPublicId ? { actorAvatarPublicId: actor.avatarPublicId } : {}),
    action,
    icon: auditIcon(action, targetType),
    targetType,
    targetId,
    ...(extra.targetName ? { targetName: extra.targetName.slice(0, 120) } : {}),
    ...(extra.workspaceId ? { workspaceId: extra.workspaceId } : {}),
    ...(extra.summary ? { summary: extra.summary } : {}),
    metadata,
    platform: devicePlatform(),
    appVersion: appVersion(),
    createdAt: serverTimestamp(),
    clientAt: Timestamp.now(),
  });
}

/** Records an upload that already reached Cloudinary. The media id is the Cloudinary public ID's tail. */
export async function recordUpload(actor: Actor, input: MediaRecordInput): Promise<string> {
  const batch = writeBatch(db);
  addMediaCreate(batch, input);
  audit(batch, actor, 'media_uploaded', 'media', input.id, {
    publicId: input.result.publicId,
    entity: input.entity,
    lang: input.lang ?? null,
  });
  await commitOnline(batch);
  return input.id;
}

/**
 * Soft-deletes a media record. `fileDeleted` is true when delete_by_token already removed the file
 * from Cloudinary; otherwise the file is listed in mediaOrphans for manual cleanup in the console.
 */
export async function removeMedia(actor: Actor, media: { id: string; publicId: string }, fileDeleted: boolean) {
  const batch = writeBatch(db);
  addMediaRemove(batch, media, actor.uid, fileDeleted ? null : 'deleted');
  audit(batch, actor, fileDeleted ? 'media_undone' : 'media_removed', 'media', media.id, { publicId: media.publicId });
  await commitOnline(batch);
}

export async function saveBanner(actor: Actor, id: string | null, input: BannerPayload): Promise<string> {
  const bannerId = id ?? newId(refs.banners());
  const batch = writeBatch(db);
  batch.set(
    refs.banner(bannerId),
    { ...input, updatedAt: serverTimestamp(), ...(id ? {} : { createdAt: serverTimestamp() }) },
    { merge: true },
  );
  audit(batch, actor, id ? 'banner_updated' : 'banner_created', 'banner', bannerId, { isActive: input.isActive });
  await commitOnline(batch);
  return bannerId;
}

export async function setBannerActive(actor: Actor, id: string, isActive: boolean) {
  const batch = writeBatch(db);
  batch.update(refs.banner(id), { isActive, updatedAt: serverTimestamp() });
  audit(batch, actor, isActive ? 'banner_activated' : 'banner_deactivated', 'banner', id, {}, {
    summary: summarizeChange({ isActive: !isActive }, { isActive }),
  });
  await commitOnline(batch);
}

export async function setUserStatus(actor: Actor, uid: string, status: 'active' | 'suspended', targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.user(uid), { status, updatedAt: serverTimestamp() });
  audit(batch, actor, status === 'suspended' ? 'user_suspended' : 'user_reactivated', 'user', uid, {}, {
    targetName,
    summary: summarizeChange({ status: status === 'suspended' ? 'active' : 'suspended' }, { status }),
  });
  await commitOnline(batch);
}

/** Approve or reject `supplierRequests/{uid}`; the user doc changes in the same batch (the rules require it). */
export async function reviewSupplierRequest(
  actor: Actor,
  uid: string,
  decision: 'approved' | 'rejected',
  reason?: string,
  profile?: { displayName?: string },
) {
  const batch = writeBatch(db);
  batch.update(refs.supplierRequest(uid), {
    status: decision,
    reason: reason?.trim().slice(0, 1000) || null,
    reviewedBy: actor.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(refs.user(uid), {
    supplierStatus: decision,
    ...(decision === 'approved' ? { userType: 'supplier' } : {}),
    updatedAt: serverTimestamp(),
  });
  if (decision === 'approved') {
    const name = (profile?.displayName ?? '').trim() || uid;
    batch.set(refs.supplier(uid), {
      ...emptySupplierProfile(name),
      nameSearch: nameSearchKey(name),
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, decision === 'approved' ? 'supplier_approved' : 'supplier_rejected', 'user', uid, {}, {
    summary: summarizeChange({ supplierStatus: 'pending' }, { supplierStatus: decision }),
  });
  await commitOnline(batch);
}

export async function createSystemUser(
  actor: Actor,
  uid: string,
  input: { displayName: string; email: string; userType: StaffUserType; systemRoleId: string },
) {
  const batch = writeBatch(db);
  batch.set(refs.user(uid), {
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    userType: input.userType,
    systemRoleId: input.systemRoleId,
    supplierStatus: 'none',
    status: 'active',
    isDeleted: false,
    onboarding: { step: 'done', completedAt: serverTimestamp() },
    schemaVersion: 3,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  audit(batch, actor, 'user_created', 'user', uid, { userType: input.userType, systemRoleId: input.systemRoleId }, {
    targetName: input.displayName.trim(),
    summary: summarizeChange(null, { userType: input.userType, systemRoleId: input.systemRoleId }),
  });
  await commitOnline(batch);
}

/** Give a grantable system role, or clear it (`member` + null). Never the owner role. */
export async function assignSystemRole(
  actor: Actor,
  uid: string,
  next: { userType: StaffUserType; systemRoleId: string } | { userType: 'member'; systemRoleId: null },
  context: { name?: string; before?: { userType: string; systemRoleId: string | null } } = {},
) {
  const batch = writeBatch(db);
  batch.update(refs.user(uid), { userType: next.userType, systemRoleId: next.systemRoleId, updatedAt: serverTimestamp() });
  audit(batch, actor, 'role_assigned', 'user', uid, { userType: next.userType, systemRoleId: next.systemRoleId }, {
    targetName: context.name,
    summary: summarizeChange(context.before ?? null, { userType: next.userType, systemRoleId: next.systemRoleId }),
  });
  await commitOnline(batch);
}

export async function deleteUser(actor: Actor, uid: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.user(uid), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, 'user_deleted', 'user', uid, {}, { targetName });
  await commitOnline(batch);
}

type NamedDoc = { name: { ar: string; en: string }; permissions: string[] };

export async function saveSystemRole(actor: Actor, id: string | null, input: NamedDoc): Promise<string> {
  const roleId = id ?? newId(refs.systemRoles());
  const batch = writeBatch(db);
  if (id) {
    batch.update(refs.systemRole(roleId), {
      name: input.name,
      permissions: input.permissions,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  } else {
    batch.set(refs.systemRole(roleId), {
      name: input.name,
      permissions: input.permissions,
      isLocked: false,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, id ? 'role_updated' : 'role_created', 'role', roleId, {}, {
    targetName: input.name.en,
    summary: summarizeChange(null, { name: input.name.en, permissions: `${input.permissions.length} keys` }),
  });
  await commitOnline(batch);
  return roleId;
}

export async function deleteSystemRole(actor: Actor, roleId: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.systemRole(roleId), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, 'role_deleted', 'role', roleId, {}, { targetName });
  await commitOnline(batch);
}

export async function savePreset(
  actor: Actor,
  id: string | null,
  input: NamedDoc & { scope: 'system' | 'workspace' },
): Promise<string> {
  const presetId = id ?? newId(refs.permissionPresets());
  const batch = writeBatch(db);
  if (id) {
    batch.update(refs.permissionPreset(presetId), {
      name: input.name,
      permissions: input.permissions,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  } else {
    batch.set(refs.permissionPreset(presetId), {
      name: input.name,
      scope: input.scope,
      permissions: input.permissions,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, id ? 'preset_updated' : 'preset_created', 'preset', presetId, {}, {
    targetName: input.name.en,
    summary: summarizeChange(null, { name: input.name.en, permissions: `${input.permissions.length} keys` }),
  });
  await commitOnline(batch);
  return presetId;
}

export async function deletePreset(actor: Actor, presetId: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.permissionPreset(presetId), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, 'preset_deleted', 'preset', presetId, {}, { targetName });
  await commitOnline(batch);
}

export async function updateWorkspaceAsStaff(
  actor: Actor,
  wid: string,
  input: { name: string; description: string },
  before?: { name: string; description?: string | null },
) {
  const batch = writeBatch(db);
  batch.update(refs.workspace(wid), {
    name: input.name.trim(),
    description: input.description.trim() || null,
    updatedAt: serverTimestamp(),
  });
  audit(batch, actor, 'workspace_updated', 'workspace', wid, {}, {
    targetName: input.name.trim(),
    workspaceId: wid,
    summary: summarizeChange(
      before ? { name: before.name, description: before.description ?? null } : null,
      { name: input.name.trim(), description: input.description.trim() || null },
    ),
  });
  await commitOnline(batch);
}

export async function setWorkspaceArchived(actor: Actor, wid: string, archived: boolean, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.workspace(wid), { isArchived: archived, updatedAt: serverTimestamp() });
  audit(batch, actor, archived ? 'workspace_archived' : 'workspace_restored', 'workspace', wid, {}, {
    targetName,
    workspaceId: wid,
    summary: summarizeChange({ isArchived: !archived }, { isArchived: archived }),
  });
  await commitOnline(batch);
}

/** Home section order, visibility and counts. Online only, with one audit entry. */
export async function saveHomeConfig(actor: Actor, sections: HomeSection[]) {
  const normalized = homeSections(sections);
  const batch = writeBatch(db);
  batch.set(
    refs.appConfig('home'),
    {
      sections: normalized.map(({ key, visible, order, count }) => ({ key, visible, order, count })),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  audit(batch, actor, 'home_config_updated', 'config', 'home', {
    visible: normalized.filter((section) => section.visible).map((section) => section.key),
  });
  await commitOnline(batch);
}

/** Staff soft-delete. Does not write the workspace audit log (the actor may not be a member). */
export async function deleteWorkspaceAsStaff(actor: Actor, wid: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.update(refs.workspace(wid), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  audit(batch, actor, 'workspace_deleted', 'workspace', wid, {}, { targetName, workspaceId: wid });
  await commitOnline(batch);
}

/** Clears one device's sync summary (a stale device). The entry is written in the same batch. */
export async function deleteSyncHealth(actor: Actor, id: string, targetName?: string) {
  const batch = writeBatch(db);
  batch.delete(refs.syncHealth(id));
  audit(batch, actor, 'sync_health_cleared', 'syncHealth', id, {}, { targetName });
  await commitOnline(batch);
}

/** Exporting the log is itself logged: who took which rows, in which format. */
export async function logAuditExport(actor: Actor, meta: { format: string; rows: number; filtered: boolean }) {
  const batch = writeBatch(db);
  audit(batch, actor, 'log_exported', 'log', 'adminAuditLog', meta);
  await commitOnline(batch);
}
