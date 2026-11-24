import { getDocsFromServer, query, serverTimestamp, where, writeBatch } from '@react-native-firebase/firestore';

import { db, auth } from '@/services/firebase/client';
import { newId, refs } from '@/services/firebase/refs';
import { commitOnline } from '@/services/firebase/write';
import { checkOnline } from '@/services/sync/connectivity';

import {
  runAvatarUpload,
  submitAvatar,
  type AvatarDeps,
  type AvatarPayload,
  type RunOptions,
  type SubmitOutcome,
} from './avatar-job';
import { addMediaCreate, addMediaRemove } from './media-writes';
import { persistForQueue, prepareImage, removeQueuedFile } from './prepare';
import { presetFor, uploadImage } from './upload';
import { checkUpload, preparedFits, type PickedImage, type UploadResult } from './upload-rules';

/** At most this many earlier avatars are retired per batch (rules count document reads per request). */
const MAX_REPLACED = 3;
const COMMIT_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for the server')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * One batch: the media record, the profile pointing at it, and every earlier avatar soft-deleted and
 * listed as an orphan. Safe to run twice for the same media id (the record is only created once).
 */
async function finalizeAvatar(payload: AvatarPayload, result: UploadResult): Promise<void> {
  const { uid, mediaId } = payload;
  const earlier = await getDocsFromServer(
    query(
      refs.media(),
      where('ownerId', '==', uid),
      where('entityType', '==', 'avatar'),
      where('isDeleted', '==', false),
    ),
  );
  const batch = writeBatch(db);
  let recorded = false;
  let replaced = 0;
  earlier.forEach((snap) => {
    if (snap.id === mediaId) {
      recorded = true;
    } else if (replaced < MAX_REPLACED) {
      replaced += 1;
      addMediaRemove(batch, { id: snap.id, publicId: String(snap.data().publicId ?? '') }, uid, 'replaced');
    }
  });
  if (!recorded) {
    addMediaCreate(batch, {
      id: mediaId,
      result,
      entity: 'avatar',
      entityId: uid,
      ownerId: uid,
      preset: presetFor('avatar') ?? '',
    });
  }
  batch.update(refs.user(uid), { avatarPublicId: result.publicId, updatedAt: serverTimestamp() });
  await withTimeout(commitOnline(batch), COMMIT_TIMEOUT_MS);
}

export const avatarDeps: AvatarDeps = {
  currentUid: () => auth.currentUser?.uid ?? null,
  upload: (payload, options) => {
    const job = uploadImage(
      { uri: payload.localUri, mimeType: payload.mimeType, name: payload.fileName },
      { entity: 'avatar', mediaId: payload.mediaId, entityId: payload.uid, ownerId: payload.uid, onProgress: options.onProgress },
    );
    options.onAbort?.(job.abort);
    return job.promise;
  },
  finalize: finalizeAvatar,
  removeFile: removeQueuedFile,
};

/** Outbox handler for `media_upload`. */
export function runQueuedAvatar(payload: AvatarPayload): Promise<void> {
  return runAvatarUpload(payload, avatarDeps);
}

export class AvatarCheckError extends Error {
  constructor(readonly code: 'type' | 'size' | 'notConfigured') {
    super(code);
  }
}

/**
 * Validates, resizes and compresses a picked image, parks the result in app storage, and uploads it
 * (now, or through the outbox when offline). `enqueue` is the outbox's, passed in so this module
 * does not import the outbox runtime (which imports this module for its handler).
 */
export async function startAvatarUpload(
  image: PickedImage,
  context: { uid: string; enqueue: (payload: AvatarPayload) => void },
  options: RunOptions = {},
): Promise<SubmitOutcome> {
  // The original's size does not matter: the re-encoded file is what is uploaded and size-checked.
  const check = checkUpload({ ...image, fileSize: null }, 'avatar', presetFor('avatar'));
  if (!check.ok) throw new AvatarCheckError(check.error);
  const prepared = await prepareImage(image, 'avatar', check.mimeType);
  if (!preparedFits(prepared.bytes)) {
    removeQueuedFile(prepared.uri);
    throw new AvatarCheckError('size');
  }
  const mediaId = newId(refs.media());
  const localUri = await persistForQueue(prepared.uri, mediaId, prepared.mimeType);
  const payload: AvatarPayload = {
    mediaId,
    uid: context.uid,
    localUri,
    mimeType: prepared.mimeType,
    fileName: prepared.fileName,
  };
  return submitAvatar(
    payload,
    { isOnline: checkOnline, enqueue: context.enqueue, run: (p, o) => runAvatarUpload(p, avatarDeps, o), removeFile: removeQueuedFile },
    options,
  );
}
