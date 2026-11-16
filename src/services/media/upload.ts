import { env } from '@/config/env';

import { parseUploadResponse, type MediaKind, type UploadResult } from './upload-rules';

export * from './upload-rules';

const API = `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}`;

export class UploadError extends Error {
  constructor(
    readonly reason: 'network' | 'rejected' | 'aborted' | 'invalidResponse',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Unsigned multipart upload with progress. Online only: callers check connectivity first and
 * show the offline state instead of queuing. Returns an abort function alongside the promise.
 */
export function uploadImage(
  file: { uri: string; mimeType: string; name: string },
  options: { kind: MediaKind; lang?: 'ar' | 'en' | null; onProgress?: (fraction: number) => void },
): { promise: Promise<UploadResult>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadResult>((resolve, reject) => {
    const form = new FormData();
    // React Native's FormData takes a { uri, type, name } file descriptor.
    form.append('file', { uri: file.uri, type: file.mimeType, name: file.name } as unknown as Blob);
    form.append('upload_preset', env.cloudinaryUploadPreset ?? '');
    form.append('folder', `${env.cloudinaryFolder}/${options.kind}`);
    form.append('tags', ['be-my-hand', options.kind, options.lang].filter(Boolean).join(','));

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
