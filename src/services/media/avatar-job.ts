import type { UploadResult } from './upload-rules';

// The avatar upload as plain functions with injected dependencies, so the queue behavior (offline,
// retry, wrong account, cancel) is unit tested without Firebase or the network
// (tests/avatar-job.test.ts). The real dependencies are wired in avatar-upload.ts.

/** What the outbox stores for `media_upload`. A prepared file sits in app storage at `localUri`. */
export type AvatarPayload = {
  /** Becomes the media document id and the Cloudinary public ID, so a retry never duplicates the file. */
  mediaId: string;
  uid: string;
  localUri: string;
  mimeType: 'image/jpeg' | 'image/png';
  fileName: string;
};

export type RunOptions = {
  onProgress?: (fraction: number) => void;
  /** Receives a function that cancels the transfer in flight. */
  onAbort?: (abort: () => void) => void;
};

export type AvatarDeps = {
  currentUid: () => string | null;
  upload: (payload: AvatarPayload, options: RunOptions) => Promise<UploadResult>;
  /** Writes media, profile and orphans in one batch (idempotent for the same media id). */
  finalize: (payload: AvatarPayload, result: UploadResult) => Promise<void>;
  removeFile: (uri: string) => void;
};

/** Upload, record, then drop the local copy. Throws on any failure so the outbox can retry. */
export async function runAvatarUpload(payload: AvatarPayload, deps: AvatarDeps, options: RunOptions = {}): Promise<void> {
  if (deps.currentUid() !== payload.uid) throw new Error('Signed in as a different account');
  const result = await deps.upload(payload, options);
  await deps.finalize(payload, result);
  deps.removeFile(payload.localUri);
}

export type FailureKind = 'retry' | 'permanent' | 'aborted';

/** Network trouble is worth retrying; Cloudinary refusing the file or missing presets is not. */
export function failureKind(error: unknown): FailureKind {
  const reason = (error as { reason?: string } | null)?.reason;
  if (reason === 'aborted') return 'aborted';
  if (reason === 'rejected' || reason === 'notConfigured' || reason === 'invalidResponse') return 'permanent';
  return 'retry';
}

export type SubmitDeps = {
  isOnline: () => Promise<boolean>;
  enqueue: (payload: AvatarPayload) => void;
  run: (payload: AvatarPayload, options: RunOptions) => Promise<void>;
  removeFile: (uri: string) => void;
};

export type SubmitOutcome = 'uploaded' | 'queued' | 'cancelled';

/**
 * Online: upload now with progress. Offline, or a transient failure: hand the prepared file to the
 * outbox, which uploads it when the phone is online again. Permanent failures throw.
 */
export async function submitAvatar(payload: AvatarPayload, deps: SubmitDeps, options: RunOptions = {}): Promise<SubmitOutcome> {
  if (!(await deps.isOnline())) {
    deps.enqueue(payload);
    return 'queued';
  }
  try {
    await deps.run(payload, options);
    return 'uploaded';
  } catch (error) {
    const kind = failureKind(error);
    if (kind === 'aborted') {
      deps.removeFile(payload.localUri);
      return 'cancelled';
    }
    if (kind === 'permanent') {
      deps.removeFile(payload.localUri);
      throw error;
    }
    deps.enqueue(payload);
    return 'queued';
  }
}
