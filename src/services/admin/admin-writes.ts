import { doc, serverTimestamp, Timestamp, writeBatch, type WriteBatch } from '@react-native-firebase/firestore';

import type { BannerPayload } from '@/domain/marketing';
import { db } from '@/services/firebase/client';
import { newId, refs, type Actor } from '@/services/firebase/refs';
import { commitOnline } from '@/services/firebase/write';
import type { MediaKind, UploadResult } from '@/services/media/upload-rules';

// Super admin writes. Each one is committed online, in one batch with its adminAuditLog entry,
// so the log can never miss a change that went through. The rules are the enforcement.

export type AdminAction =
  | 'media_uploaded'
  | 'media_undone'
  | 'media_archived'
  | 'media_restored'
  | 'banner_created'
  | 'banner_updated'
  | 'banner_activated'
  | 'banner_deactivated'
  | 'user_suspended'
  | 'user_reactivated';

export type AdminTarget = 'media' | 'banner' | 'user';

function audit(
  batch: WriteBatch,
  actor: Actor,
  action: AdminAction,
  targetType: AdminTarget,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  const ref = doc(refs.adminAuditLog(), newId(refs.adminAuditLog()));
  batch.set(ref, {
    actorId: actor.uid,
    actorName: actor.name,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: serverTimestamp(),
    clientAt: Timestamp.now(),
  });
}

export async function recordUpload(
  actor: Actor,
  result: UploadResult,
  kind: MediaKind,
  lang: 'ar' | 'en' | null,
  label: string,
): Promise<string> {
  const id = newId(refs.mediaAssets());
  const batch = writeBatch(db);
  batch.set(refs.mediaAsset(id), {
    publicId: result.publicId,
    secureUrl: result.secureUrl,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    version: result.version,
    folder: result.folder,
    tags: result.tags,
    kind,
    lang,
    label: label.slice(0, 120),
    isArchived: false,
    uploadedBy: actor.uid,
    createdAt: serverTimestamp(),
    clientAt: Timestamp.now(),
  });
  audit(batch, actor, 'media_uploaded', 'media', id, { publicId: result.publicId, kind, lang });
  await commitOnline(batch);
  return id;
}

/** After a successful delete_by_token the record is archived (records are never deleted). */
export async function setMediaArchived(actor: Actor, id: string, archived: boolean, action?: AdminAction) {
  const batch = writeBatch(db);
  batch.update(refs.mediaAsset(id), { isArchived: archived, updatedAt: serverTimestamp() });
  audit(batch, actor, action ?? (archived ? 'media_archived' : 'media_restored'), 'media', id);
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
  audit(batch, actor, isActive ? 'banner_activated' : 'banner_deactivated', 'banner', id);
  await commitOnline(batch);
}

export async function setUserStatus(actor: Actor, uid: string, status: 'active' | 'suspended') {
  const batch = writeBatch(db);
  batch.update(refs.user(uid), { status, updatedAt: serverTimestamp() });
  audit(batch, actor, status === 'suspended' ? 'user_suspended' : 'user_reactivated', 'user', uid);
  await commitOnline(batch);
}
