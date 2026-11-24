import { env } from '@/config/env';

import {
  ENTITY_GROUP,
  uploadContext,
  uploadFolder,
  uploadPresetName,
  uploadTags,
  type MediaEntity,
} from './groups';
import { parseUploadResponse, type UploadResult } from './upload-rules';

export * from './upload-rules';

const API = `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}`;

export class UploadError extends Error {
  constructor(
    readonly reason: 'network' | 'rejected' | 'aborted' | 'invalidResponse' | 'notConfigured',
    message: string,
  ) {
    super(message);
  }
}

/** Preset name for an entity's group; null when uploads are off. */
export function presetFor(entity: MediaEntity): string | null {
  return uploadPresetName(ENTITY_GROUP[entity], env.cloudinaryPresetPrefix);
}

export type UploadOptions = {
  entity: MediaEntity;
  /**
   * Becomes the Cloudinary public ID (inside the group folder). The presets keep Overwrite off, so
   * a retry of the same upload returns the asset that is already there instead of a duplicate.
   */
  mediaId: string;
  entityId?: string | null;
  ownerId: string;
  lang?: 'ar' | 'en' | null;
  onProgress?: (fraction: number) => void;
};

/**
 * Unsigned multipart upload with progress. Callers check connectivity first (queued avatar uploads
 * go through the outbox instead). Returns an abort function alongside the promise.
 */
export function uploadImage(
  file: { uri: string; mimeType: string; name: string },
  options: UploadOptions,
): { promise: Promise<UploadResult>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadResult>((resolve, reject) => {
    const preset = presetFor(options.entity);
    if (!preset) {
      reject(new UploadError('notConfigured', 'Uploads are not configured'));
      return;
    }
    const form = new FormData();
    // React Native's FormData takes a { uri, type, name } file descriptor.
    form.append('file', { uri: file.uri, type: file.mimeType, name: file.name } as unknown as Blob);
    form.append('upload_preset', preset);
    form.append('folder', uploadFolder(env.cloudinaryFolder, ENTITY_GROUP[options.entity]));
    form.append('public_id', options.mediaId);
    form.append('tags', uploadTags(options.entity, options.lang).join(','));
    form.append('context', uploadContext(options.entity, options.entityId, options.ownerId));

    xhr.open('POST', `${API}/image/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new UploadError('network', 'Network error'));
    xhr.onabort = () => reject(new UploadError('aborted', 'Upload cancelled'));
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // handled below
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${xhr.status}`;
        reject(new UploadError('rejected', message));
        return;
      }
      const result = parseUploadResponse(body, env.cloudinaryCloudName);
      if (!result) reject(new UploadError('invalidResponse', 'Unexpected upload response'));
      else {
        options.onProgress?.(1);
        resolve(result);
      }
    };
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

/** Deletes a just-uploaded asset with its delete token (valid about 10 minutes after upload). */
export async function deleteByToken(token: string): Promise<void> {
  const form = new FormData();
  form.append('token', token);
  const response = await fetch(`${API}/delete_by_token`, { method: 'POST', body: form });
  if (!response.ok) throw new UploadError('rejected', `HTTP ${response.status}`);
}
