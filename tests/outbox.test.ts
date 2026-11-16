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
    expect(outbox.list()).toHaveLength(0);
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
});
