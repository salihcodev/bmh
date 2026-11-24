import type { OutboxJob } from '@/services/sync/outbox';

// What the queue screen and the dashboard need to know about the outbox, as plain functions.

export const JOB_TYPES = {
  passwordReset: 'password_reset',
  mediaUpload: 'media_upload',
  chatMessage: 'chat_message',
  genericWrite: 'generic_write',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/** Types whose jobs may be thrown away from the queue screen. Chat messages and uploads can be redone. */
const DISCARDABLE: Record<JobType, boolean> = {
  password_reset: true,
  media_upload: true,
  chat_message: true,
  generic_write: true,
};

export function canDiscard(job: Pick<OutboxJob, 'type' | 'payload'>): boolean {
  if (job.type === JOB_TYPES.genericWrite) return (job.payload as { discardable?: boolean } | null)?.discardable !== false;
  return DISCARDABLE[job.type as JobType] ?? true;
}

export type QueueCounts = {
  pending: number;
  syncing: number;
  failed: number;
  done: number;
  /** Time the oldest unfinished job was queued, or null. */
  oldestPendingAt: number | null;
};

export function countJobs(jobs: readonly OutboxJob[]): QueueCounts {
  const counts: QueueCounts = { pending: 0, syncing: 0, failed: 0, done: 0, oldestPendingAt: null };
  for (const job of jobs) {
    counts[job.status] += 1;
    if (job.status === 'pending' || job.status === 'syncing') {
      counts.oldestPendingAt = counts.oldestPendingAt === null ? job.createdAt : Math.min(counts.oldestPendingAt, job.createdAt);
    }
  }
  return counts;
}

export type QueueGroups = { failed: OutboxJob[]; syncing: OutboxJob[]; pending: OutboxJob[]; done: OutboxJob[] };

/** Groups for the queue screen: oldest first within waiting groups, newest first for finished ones. */
export function groupJobs(jobs: readonly OutboxJob[]): QueueGroups {
  const by = (status: OutboxJob['status']) => jobs.filter((job) => job.status === status);
  const oldest = (a: OutboxJob, b: OutboxJob) => a.createdAt - b.createdAt;
  return {
    failed: by('failed').sort(oldest),
    syncing: by('syncing').sort(oldest),
    pending: by('pending').sort(oldest),
    done: by('done').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
  };
}

/** The per-device summary the dashboard reads (`syncHealth/{uid}_{deviceId}`). */
export type HealthSummary = {
  pending: number;
  failed: number;
  oldestPendingAt: number | null;
};

/** `failedWrites` are batches the server rejected in this app run (the sync store's failures). */
export function healthSummary(jobs: readonly OutboxJob[], waitingWrites: number, failedWrites: number): HealthSummary {
  const counts = countJobs(jobs);
  return {
    pending: counts.pending + counts.syncing + Math.max(0, waitingWrites),
    failed: counts.failed + Math.max(0, failedWrites),
    oldestPendingAt: counts.oldestPendingAt,
  };
}

export const HEALTH_INTERVAL_MS = 10 * 60_000;

/**
 * One write per ten minutes, or at once when the picture changes. Pending counts that merely move
 * between two non-zero values wait for the interval, so a busy queue does not write on every job.
 */
export function shouldWriteHealth(
  last: { summary: HealthSummary; at: number } | null,
  next: HealthSummary,
  now: number,
  interval = HEALTH_INTERVAL_MS,
): boolean {
  if (!last) return true;
  if (now - last.at >= interval) return true;
  if (last.summary.failed !== next.failed) return true;
  return (last.summary.pending > 0) !== (next.pending > 0);
}

export const healthDocId = (uid: string, deviceId: string) => `${uid}_${deviceId}`;

export type HealthState = 'failing' | 'backlog' | 'ok' | 'stale';

export const STALE_AFTER_MS = 7 * 24 * 3_600_000;
export const BACKLOG_AFTER_MS = 24 * 3_600_000;

/** How the dashboard labels one device. */
export function healthState(
  device: { failed: number; pending: number; oldestPendingAt: number | null; updatedAt: number | null },
  now: number,
): HealthState {
  if (device.updatedAt !== null && now - device.updatedAt > STALE_AFTER_MS) return 'stale';
  if (device.failed > 0) return 'failing';
  if (device.pending > 0 && device.oldestPendingAt !== null && now - device.oldestPendingAt > BACKLOG_AFTER_MS) return 'backlog';
  return 'ok';
}

export type HealthTotals = { devices: number; pending: number; failed: number; failing: number; backlog: number };

export function healthTotals(
  devices: readonly { failed: number; pending: number; oldestPendingAt: number | null; updatedAt: number | null }[],
  now: number,
): HealthTotals {
  const totals: HealthTotals = { devices: 0, pending: 0, failed: 0, failing: 0, backlog: 0 };
  for (const device of devices) {
    const state = healthState(device, now);
    if (state === 'stale') continue;
    totals.devices += 1;
    totals.pending += device.pending;
    totals.failed += device.failed;
    if (state === 'failing') totals.failing += 1;
    if (state === 'backlog') totals.backlog += 1;
  }
  return totals;
}
