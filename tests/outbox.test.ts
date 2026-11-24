import { describe, expect, it, vi } from 'vitest';

import { createOutbox } from '@/services/sync/outbox';
import { createMemoryStore } from '@/services/storage/kv';

function setup(handler: (payload: unknown) => Promise<void>, start = 1_000) {
  let clock = start;
  const store = createMemoryStore();
  const outbox = createOutbox({
    store,
    now: () => clock,
    handlers: { send: (job) => handler(job.payload) },
    maxAttempts: 3,
    baseDelayMs: 1_000,
    maxDelayMs: 4_000,
  });
  return { outbox, store, advance: (ms: number) => (clock += ms) };
}

describe('outbox', () => {
  it('deduplicates by idempotency key', () => {
    const { outbox } = setup(async () => undefined);
    const a = outbox.enqueue('send', { n: 1 }, 'k1');
    const b = outbox.enqueue('send', { n: 2 }, 'k1');
    expect(b.id).toBe(a.id);
    expect(outbox.list()).toHaveLength(1);
  });

  it('removes a job after a successful flush', async () => {
    const handler = vi.fn(async () => undefined);
    const { outbox } = setup(handler);
    outbox.enqueue('send', { n: 1 }, 'k1');
    const result = await outbox.flush();
    expect(result.processed).toBe(1);
    expect(handler).toHaveBeenCalledOnce();
    // Finished jobs stay as short history, but never run again and never count as waiting.
    expect(outbox.list()).toHaveLength(1);
    expect(outbox.list()[0]).toMatchObject({ status: 'done' });
    expect(outbox.pendingCount()).toBe(0);
    await outbox.flush();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('retries with exponential backoff and fails after max attempts', async () => {
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    const { outbox, advance } = setup(handler);
    outbox.enqueue('send', {}, 'k1');

    await outbox.flush();
    expect(outbox.list()[0]).toMatchObject({ attempts: 1, status: 'pending', lastError: 'boom' });

    // Not due yet: backoff is 1s after the first failure.
    await outbox.flush();
    expect(handler).toHaveBeenCalledTimes(1);

    advance(1_000);
    await outbox.flush();
    expect(outbox.list()[0]).toMatchObject({ attempts: 2, status: 'pending' });

    advance(2_000);
    await outbox.flush();
    expect(outbox.list()[0]).toMatchObject({ attempts: 3, status: 'failed' });

    advance(60_000);
    await outbox.flush();
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('persists jobs across instances (app restart)', () => {
    const store = createMemoryStore();
    const first = createOutbox({ store, handlers: {} });
    first.enqueue('send', { email: 'a@x.com' }, 'reset:a@x.com');
    const second = createOutbox({ store, handlers: {} });
    expect(second.list()).toHaveLength(1);
    expect(second.list()[0]?.payload).toEqual({ email: 'a@x.com' });
  });

  it('retry() resets a failed job; dismiss() removes it', async () => {
    const { outbox } = setup(async () => {
      throw new Error('x');
    });
    const job = outbox.enqueue('send', {}, 'k1');
    for (let i = 0; i < 3; i += 1) {
      await outbox.flush();
      outbox.retry(job.id);
    }
    expect(outbox.list()[0]?.status).toBe('pending');
    outbox.dismiss(job.id);
    expect(outbox.list()).toHaveLength(0);
  });

  it('runs concurrent flushes only once', async () => {
    let calls = 0;
    const { outbox } = setup(async () => {
      calls += 1;
    });
    outbox.enqueue('send', {}, 'k1');
    await Promise.all([outbox.flush(), outbox.flush()]);
    expect(calls).toBe(1);
  });

  it('marks a job syncing while its handler runs', async () => {
    let seen: string | undefined;
    let release: () => void = () => undefined;
    const { outbox } = setup(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    outbox.enqueue('send', {}, 'k1');
    const flush = outbox.flush();
    seen = outbox.list()[0]?.status;
    expect(seen).toBe('syncing');
    expect(outbox.pendingCount()).toBe(1);
    release();
    await flush;
    expect(outbox.list()[0]?.status).toBe('done');
  });

  it('runs a job again after the app was closed mid-sync', () => {
    const store = createMemoryStore();
    const first = createOutbox({ store, handlers: {} });
    const job = first.enqueue('send', {}, 'k1');
    store.set('outbox.v1', JSON.stringify([{ ...job, status: 'syncing' }]));
    const second = createOutbox({ store, handlers: {} });
    expect(second.list()[0]?.status).toBe('pending');
  });

  it('keeps only the most recent finished jobs', async () => {
    const store = createMemoryStore();
    let clock = 1_000;
    const outbox = createOutbox({ store, now: () => (clock += 1), handlers: { send: async () => undefined }, doneHistory: 2 });
    for (let i = 0; i < 4; i += 1) outbox.enqueue('send', { i }, `k${i}`);
    await outbox.flush();
    const done = outbox.list().filter((job) => job.status === 'done');
    expect(done.map((job) => job.idempotencyKey)).toEqual(['k2', 'k3']);
  });

  it('lets the same key queue again once its job is done', async () => {
    const { outbox } = setup(async () => undefined);
    const first = outbox.enqueue('send', {}, 'k1');
    await outbox.flush();
    const again = outbox.enqueue('send', {}, 'k1');
    expect(again.id).not.toBe(first.id);
    expect(outbox.pendingCount()).toBe(1);
  });

  it('retry() without an id retries every failed job and leaves the rest', async () => {
    const { outbox } = setup(async (payload) => {
      if ((payload as { bad?: boolean }).bad) throw new Error('x');
    });
    outbox.enqueue('send', { bad: true }, 'bad1');
    outbox.enqueue('send', { bad: true }, 'bad2');
    outbox.enqueue('send', {}, 'good');
    for (let i = 0; i < 3; i += 1) {
      await outbox.flush();
      // Move past each backoff: jobs fail for good after three attempts.
      for (const job of outbox.list()) if (job.status === 'pending' && job.attempts > 0) outbox.retry(job.id);
    }
    expect(outbox.list().filter((job) => job.status === 'done')).toHaveLength(1);
    outbox.retry();
    expect(outbox.list().filter((job) => job.status === 'pending' && job.attempts === 0)).toHaveLength(2);
    expect(outbox.list().filter((job) => job.status === 'done')).toHaveLength(1);
  });

  it('discard() runs the type cleanup, removes the job, and refuses a running one', async () => {
    const cleaned: string[] = [];
    let release: () => void = () => undefined;
    const store = createMemoryStore();
    const outbox = createOutbox({
      store,
      handlers: {
        send: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
        idle: async () => undefined,
      },
      onDiscard: { idle: (job) => void cleaned.push(job.idempotencyKey) },
    });
    const idle = outbox.enqueue('idle', {}, 'idle1');
    expect(outbox.discard(idle.id)).toBe(true);
    expect(cleaned).toEqual(['idle1']);
    expect(outbox.list()).toHaveLength(0);

    const running = outbox.enqueue('send', {}, 'run1');
    const flush = outbox.flush();
    expect(outbox.discard(running.id)).toBe(false);
    expect(outbox.list()).toHaveLength(1);
    release();
    await flush;
  });

  it('discard() removes the job even when its cleanup throws', () => {
    const outbox = createOutbox({
      store: createMemoryStore(),
      handlers: {},
      onDiscard: {
        send: () => {
          throw new Error('disk');
        },
      },
    });
    const job = outbox.enqueue('send', {}, 'k1');
    expect(outbox.discard(job.id)).toBe(true);
    expect(outbox.list()).toHaveLength(0);
  });

  it('clearDone() drops finished jobs only', async () => {
    const { outbox } = setup(async () => undefined);
    outbox.enqueue('send', {}, 'k1');
    await outbox.flush();
    outbox.enqueue('send', {}, 'k2');
    outbox.clearDone();
    expect(outbox.list().map((job) => job.status)).toEqual(['pending']);
  });
});
