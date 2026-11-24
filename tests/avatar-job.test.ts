import { describe, expect, it, vi } from 'vitest';

import {
  failureKind,
  runAvatarUpload,
  submitAvatar,
  type AvatarDeps,
  type AvatarPayload,
  type SubmitDeps,
} from '@/services/media/avatar-job';
import { createOutbox } from '@/services/sync/outbox';
import { createMemoryStore } from '@/services/storage/kv';

const payload: AvatarPayload = {
  mediaId: 'm1',
  uid: 'u1',
  localUri: 'file:///queue/m1.jpg',
  mimeType: 'image/jpeg',
  fileName: 'upload.jpg',
};

const result = {
  publicId: 'be-my-hand/avatars/m1',
  secureUrl: 'https://res.cloudinary.com/rrphuvne/image/upload/v1/be-my-hand/avatars/m1.jpg',
  width: 512,
  height: 512,
  format: 'jpg',
  bytes: 1000,
  version: 1,
  folder: 'be-my-hand/avatars',
  tags: [],
  deleteToken: null,
};

function deps(overrides: Partial<AvatarDeps> = {}): AvatarDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    currentUid: () => 'u1',
    upload: vi.fn(async () => {
      calls.push('upload');
      return result;
    }),
    finalize: vi.fn(async () => {
      calls.push('finalize');
    }),
    removeFile: vi.fn(() => {
      calls.push('remove');
    }),
    ...overrides,
  };
}

describe('runAvatarUpload', () => {
  it('uploads, records, then removes the local copy', async () => {
    const d = deps();
    await runAvatarUpload(payload, d);
    expect(d.calls).toEqual(['upload', 'finalize', 'remove']);
    expect(d.finalize).toHaveBeenCalledWith(payload, result);
    expect(d.removeFile).toHaveBeenCalledWith(payload.localUri);
  });

  it('keeps the local copy when recording fails, so a retry can finish', async () => {
    const d = deps({
      finalize: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    await expect(runAvatarUpload(payload, d)).rejects.toThrow('offline');
    expect(d.removeFile).not.toHaveBeenCalled();
  });

  it('never uploads for another account', async () => {
    const d = deps({ currentUid: () => 'someone-else' });
    await expect(runAvatarUpload(payload, d)).rejects.toThrow();
    expect(d.upload).not.toHaveBeenCalled();
    expect(d.removeFile).not.toHaveBeenCalled();
  });
});

describe('failureKind', () => {
  it('retries network trouble, stops on refusal, and reports cancellation', () => {
    expect(failureKind({ reason: 'network' })).toBe('retry');
    expect(failureKind(new Error('timeout'))).toBe('retry');
    expect(failureKind({ reason: 'rejected' })).toBe('permanent');
    expect(failureKind({ reason: 'notConfigured' })).toBe('permanent');
    expect(failureKind({ reason: 'invalidResponse' })).toBe('permanent');
    expect(failureKind({ reason: 'aborted' })).toBe('aborted');
    expect(failureKind(null)).toBe('retry');
  });
});

describe('submitAvatar', () => {
  function submitDeps(overrides: Partial<SubmitDeps> = {}) {
    const enqueue = vi.fn();
    const removeFile = vi.fn();
    const run = vi.fn(async () => undefined);
    const d: SubmitDeps = { isOnline: async () => true, enqueue, run, removeFile, ...overrides };
    return { d, enqueue, removeFile, run };
  }

  it('uploads right away when online', async () => {
    const { d, enqueue, run } = submitDeps();
    await expect(submitAvatar(payload, d)).resolves.toBe('uploaded');
    expect(run).toHaveBeenCalledOnce();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('queues the prepared file when offline, without touching the network', async () => {
    const { d, enqueue, run } = submitDeps({ isOnline: async () => false });
    await expect(submitAvatar(payload, d)).resolves.toBe('queued');
    expect(enqueue).toHaveBeenCalledWith(payload);
    expect(run).not.toHaveBeenCalled();
  });

  it('queues after a network failure and keeps the file', async () => {
    const { d, enqueue, removeFile } = submitDeps({ run: vi.fn(async () => Promise.reject({ reason: 'network' })) });
    await expect(submitAvatar(payload, d)).resolves.toBe('queued');
    expect(enqueue).toHaveBeenCalledWith(payload);
    expect(removeFile).not.toHaveBeenCalled();
  });

  it('drops the file on cancel and on a permanent refusal', async () => {
    const aborted = submitDeps({ run: vi.fn(async () => Promise.reject({ reason: 'aborted' })) });
    await expect(submitAvatar(payload, aborted.d)).resolves.toBe('cancelled');
    expect(aborted.removeFile).toHaveBeenCalledWith(payload.localUri);

    const refused = submitDeps({ run: vi.fn(async () => Promise.reject({ reason: 'rejected' })) });
    await expect(submitAvatar(payload, refused.d)).rejects.toMatchObject({ reason: 'rejected' });
    expect(refused.removeFile).toHaveBeenCalledWith(payload.localUri);
    expect(refused.enqueue).not.toHaveBeenCalled();
  });
});

describe('media_upload through the outbox', () => {
  function setup(runDeps: AvatarDeps) {
    let clock = 1_000;
    const outbox = createOutbox({
      store: createMemoryStore(),
      now: () => clock,
      handlers: { media_upload: (job) => runAvatarUpload(job.payload as AvatarPayload, runDeps) },
      maxAttempts: 3,
      baseDelayMs: 1_000,
    });
    return { outbox, advance: (ms: number) => (clock += ms) };
  }

  it('is deduplicated by media id and finishes once the network is back', async () => {
    let online = false;
    const d = deps({
      upload: vi.fn(async () => {
        if (!online) throw Object.assign(new Error('Network error'), { reason: 'network' });
        return result;
      }),
    });
    const { outbox, advance } = setup(d);
    outbox.enqueue('media_upload', payload, `media_upload:${payload.mediaId}`, payload.uid);
    outbox.enqueue('media_upload', payload, `media_upload:${payload.mediaId}`, payload.uid);
    expect(outbox.list()).toHaveLength(1);

    await outbox.flush();
    expect(outbox.list()[0]).toMatchObject({ status: 'pending', attempts: 1, lastError: 'Network error' });
    expect(d.removeFile).not.toHaveBeenCalled();

    online = true;
    advance(5_000);
    await outbox.flush();
    expect(outbox.list().map((job) => job.status)).toEqual(['done']);
    expect(outbox.pendingCount()).toBe(0);
    expect(d.removeFile).toHaveBeenCalledWith(payload.localUri);
  });

  it('is dropped with the user on sign-out', () => {
    const { outbox } = setup(deps());
    outbox.enqueue('media_upload', payload, `media_upload:${payload.mediaId}`, payload.uid);
    expect(outbox.removeForUser('u1')).toBe(1);
    expect(outbox.list()).toHaveLength(0);
  });
});
