import { doc, serverTimestamp, type WriteBatch } from '@react-native-firebase/firestore';

import { refs } from '@/services/firebase/refs';

import { mediaDocFields, orphanDocFields, type MediaRecordInput, type OrphanReason } from './media-record';

// Batch helpers for media/{id} and mediaOrphans/{id}. Callers add them to the batch that also
// writes the entity that points at the file (profile, banner, ...), so the two never disagree.

export function addMediaCreate(batch: WriteBatch, input: MediaRecordInput): void {
  batch.set(refs.mediaDoc(input.id), { ...mediaDocFields(input), createdAt: serverTimestamp() });
}

/**
 * Soft-deletes a media record. `orphan` records why the file is left behind in Cloudinary; pass
 * null when the file itself was deleted (delete_by_token inside its window).
 */
export function addMediaRemove(
  batch: WriteBatch,
  media: { id: string; publicId: string },
  actorUid: string,
  orphan: OrphanReason | null,
): void {
  batch.update(refs.mediaDoc(media.id), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
  if (orphan) {
    batch.set(doc(refs.mediaOrphans()), {
      ...orphanDocFields({ publicId: media.publicId, mediaId: media.id, reason: orphan, createdBy: actorUid }),
      createdAt: serverTimestamp(),
    });
  }
}
