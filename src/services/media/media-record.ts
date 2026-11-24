import { ENTITY_GROUP, type MediaEntity } from './groups';
import type { UploadResult } from './upload-rules';

// Shape of media/{id} (docs/firestore-schema.md, rules in firestore.rules). Pure: the writer adds
// the server timestamps. Never stores a delivery URL, only the public ID.

export type MediaRecordInput = {
  id: string;
  result: UploadResult;
  entity: MediaEntity;
  entityId: string;
  ownerId: string;
  workspaceId?: string | null;
  lang?: 'ar' | 'en' | null;
  label?: string;
  /** Name of the Cloudinary preset that took the upload. */
  preset: string;
};

export const MEDIA_LABEL_MAX = 120;

export function mediaDocFields(input: MediaRecordInput): Record<string, unknown> {
  const { result } = input;
  return {
    publicId: result.publicId,
    resourceType: 'image',
    preset: input.preset,
    folder: result.folder || `be-my-hand/${ENTITY_GROUP[input.entity]}`,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    entityType: input.entity,
    entityId: input.entityId,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    lang: input.lang ?? null,
    label: (input.label ?? '').trim().slice(0, MEDIA_LABEL_MAX),
    ownerId: input.ownerId,
    isDeleted: false,
  };
}

export type OrphanReason = 'replaced' | 'deleted' | 'cancelled';

/** A file that no document points at any more. Cleaned by hand in the Cloudinary console. */
export function orphanDocFields(input: { publicId: string; mediaId: string; reason: OrphanReason; createdBy: string }) {
  return { publicId: input.publicId, mediaId: input.mediaId, reason: input.reason, createdBy: input.createdBy };
}
