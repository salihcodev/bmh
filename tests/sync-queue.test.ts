import { describe, expect, it } from 'vitest';

import {
  BACKLOG_AFTER_MS,
  canDiscard,
  countJobs,
  groupJobs,
  healthDocId,
  healthState,
  healthSummary,
  healthTotals,
  HEALTH_INTERVAL_MS,
  shouldWriteHealth,
  STALE_AFTER_MS,
} from '@/domain/sync-queue';
import type { OutboxJob } from '@/services/sync/outbox';

let n = 0;
function job(status: OutboxJob['status'], createdAt: number, extra: Partial<OutboxJob> = {}): OutboxJob {
  n += 1;
  return { id: `j${n}`, type: 'password_reset', payload: {}, idempotencyKey: `k${n}`, attempts: 0, nextRetryAt: 0, status, createdAt, ...extra };
}

describe('queue counts and groups', () => {
  it('counts every status and finds the oldest unfinished job', () => {
    const jobs = [job('pending', 300), job('syncing', 200), job('failed', 100), job('done', 50)];
    expect(countJobs(jobs)).toEqual({ pending: 1, syncing: 1, failed: 1, done: 1, oldestPendingAt: 200 });
    expect(countJobs([]).oldestPendingAt).toBeNull();
  });

  it('groups waiting jobs oldest first and finished jobs newest first', () => {
    const a = job('pending', 20);
    const b = job('pending', 10);
    const x = job('done', 1, { finishedAt: 100 });
    const y = job('done', 2, { finishedAt: 200 });
    const groups = groupJobs([a, b, x, y]);
    expect(groups.pending.map((item) => item.id)).toEqual([b.id, a.id]);
    expect(groups.done.map((item) => item.id)).toEqual([y.id, x.id]);
  });

  it('lets a job be discarded unless its payload says it cannot', () => {
    expect(canDiscard({ type: 'media_upload', payload: {} })).toBe(true);
    expect(canDiscard({ type: 'generic_write', payload: {} })).toBe(true);
    expect(canDiscard({ type: 'generic_write', payload: { discardable: false } })).toBe(false);
  });
});

describe('device health summary', () => {
  it('adds writes still waiting for the server and failed batches to the outbox counts', () => {
    const jobs = [job('pending', 5), job('failed', 6), job('done', 7)];
    expect(healthSummary(jobs, 2, 1)).toEqual({ pending: 3, failed: 2, oldestPendingAt: 5 });
    expect(healthSummary([], -4, 0)).toEqual({ pending: 0, failed: 0, oldestPendingAt: null });
  });

  it('writes the first time, then at most once per interval', () => {
    const quiet = { pending: 0, failed: 0, oldestPendingAt: null };
    expect(shouldWriteHealth(null, quiet, 0)).toBe(true);
    const last = { summary: quiet, at: 1_000 };
    expect(shouldWriteHealth(last, quiet, 1_000 + 60_000)).toBe(false);
    expect(shouldWriteHealth(last, quiet, 1_000 + HEALTH_INTERVAL_MS)).toBe(true);
  });

  it('writes at once when failures change or the queue starts or empties', () => {
    const at = 1_000;
    const idle = { summary: { pending: 0, failed: 0, oldestPendingAt: null }, at };
    expect(shouldWriteHealth(idle, { pending: 0, failed: 1, oldestPendingAt: null }, at + 1)).toBe(true);
    expect(shouldWriteHealth(idle, { pending: 2, failed: 0, oldestPendingAt: 5 }, at + 1)).toBe(true);
    const busy = { summary: { pending: 2, failed: 0, oldestPendingAt: 5 }, at };
    expect(shouldWriteHealth(busy, { pending: 7, failed: 0, oldestPendingAt: 5 }, at + 1)).toBe(false);
    expect(shouldWriteHealth(busy, { pending: 0, failed: 0, oldestPendingAt: null }, at + 1)).toBe(true);
  });

  it('names the document uid_deviceId, which the rules require', () => {
    expect(healthDocId('u1', 'd1')).toBe('u1_d1');
  });
});

describe('dashboard device state', () => {
  const now = 10 * STALE_AFTER_MS;
  const device = (extra: Partial<{ failed: number; pending: number; oldestPendingAt: number | null; updatedAt: number | null }>) => ({
    failed: 0,
    pending: 0,
    oldestPendingAt: null,
    updatedAt: now - 1_000,
    ...extra,
  });

  it('flags failures, old backlogs and quiet devices', () => {
    expect(healthState(device({}), now)).toBe('ok');
    expect(healthState(device({ failed: 1 }), now)).toBe('failing');
    expect(healthState(device({ pending: 3, oldestPendingAt: now - BACKLOG_AFTER_MS - 1 }), now)).toBe('backlog');
    expect(healthState(device({ pending: 3, oldestPendingAt: now - 1_000 }), now)).toBe('ok');
    expect(healthState(device({ failed: 5, updatedAt: now - STALE_AFTER_MS - 1 }), now)).toBe('stale');
  });

  it('totals skip quiet devices, so an old failure does not count forever', () => {
    const totals = healthTotals(
      [device({ failed: 2, pending: 1 }), device({ pending: 4, oldestPendingAt: now - BACKLOG_AFTER_MS - 1 }), device({ failed: 9, updatedAt: 0 })],
      now,
    );
    expect(totals).toEqual({ devices: 2, pending: 5, failed: 2, failing: 1, backlog: 1 });
  });
});
