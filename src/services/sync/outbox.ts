import { readJSON, writeJSON, type KeyValueStore } from '@/services/storage/kv';

/**
 * pending: waiting for its turn or its retry time. syncing: the handler is running right now.
 * failed: out of attempts, waits for a manual retry. done: finished (kept briefly as history).
 */
export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'done';

export type OutboxJob<P = unknown> = {
  id: string;
  /** Owner of the job; null for jobs that run without an account (password reset). */
  uid?: string | null;
  type: string;
  payload: P;
  idempotencyKey: string;
  attempts: number;
  nextRetryAt: number;
  status: OutboxStatus;
  lastError?: string;
  createdAt: number;
  finishedAt?: number;
};

export type OutboxHandler = (job: OutboxJob) => Promise<void>;

export type OutboxOptions = {
  store: KeyValueStore;
  handlers: Record<string, OutboxHandler>;
  /** Cleanup when a job is thrown away by hand (for example the local copy of a queued file). */
  onDiscard?: Record<string, (job: OutboxJob) => void>;
  /** How many finished jobs stay in the list for the queue screen. */
  doneHistory?: number;
  now?: () => number;
  key?: string;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export type Outbox = ReturnType<typeof createOutbox>;

/**
 * Persistent job queue for work that is NOT a plain Firestore write (Firestore
 * already queues those). Jobs are retried with exponential backoff and are
 * deduplicated by idempotency key.
 */
export function createOutbox({
  store,
  handlers,
  onDiscard = {},
  doneHistory = 10,
  now = Date.now,
  key = 'outbox.v1',
  maxAttempts = 8,
  baseDelayMs = 2_000,
  maxDelayMs = 10 * 60_000,
}: OutboxOptions) {
  // A job stored as `syncing` was interrupted by the app closing: run it again.
  let jobs: OutboxJob[] = readJSON<OutboxJob[]>(store, key, []).map((job) =>
    job.status === 'syncing' ? { ...job, status: 'pending' as const } : job,
  );
  let flushing: Promise<{ processed: number; failed: number }> | null = null;
  const listeners = new Set<(jobs: OutboxJob[]) => void>();

  function save() {
    writeJSON(store, key, jobs);
    const snapshot = [...jobs];
    listeners.forEach((listener) => listener(snapshot));
  }

  function backoff(attempts: number): number {
    return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempts - 1));
  }

  const live = (job: OutboxJob) => job.status !== 'done';

  function patch(id: string, change: Partial<OutboxJob>) {
    jobs = jobs.map((job) => (job.id === id ? { ...job, ...change } : job));
  }

  function enqueue<P>(type: string, payload: P, idempotencyKey: string, uid: string | null = null): OutboxJob<P> {
    const existing = jobs.find((job) => job.idempotencyKey === idempotencyKey && live(job));
    if (existing) return existing as OutboxJob<P>;
    const job: OutboxJob<P> = {
      id: `${now()}-${Math.random().toString(36).slice(2, 10)}`,
      uid,
      type,
      payload,
      idempotencyKey,
      attempts: 0,
      nextRetryAt: now(),
      status: 'pending',
      createdAt: now(),
    };
    jobs = [...jobs, job];
    save();
    return job;
  }

  async function runDue(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;
    const due = jobs.filter((job) => job.status === 'pending' && job.nextRetryAt <= now());
    for (const job of due) {
      const handler = handlers[job.type];
      patch(job.id, { status: 'syncing' });
      save();
      try {
        if (!handler) throw new Error(`No handler for ${job.type}`);
        await handler(job);
        const finished = now();
        patch(job.id, { status: 'done', finishedAt: finished, lastError: undefined });
        const done = jobs.filter((item) => item.status === 'done');
        if (done.length > doneHistory) {
          const drop = new Set(
            [...done].sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0)).slice(0, done.length - doneHistory).map((item) => item.id),
          );
          jobs = jobs.filter((item) => !drop.has(item.id));
        }
        processed += 1;
      } catch (error) {
        const attempts = job.attempts + 1;
        const exhausted = attempts >= maxAttempts;
        patch(job.id, {
          attempts,
          status: exhausted ? 'failed' : 'pending',
          nextRetryAt: now() + backoff(attempts),
          lastError: error instanceof Error ? error.message : String(error),
        });
        if (exhausted) failed += 1;
      }
      save();
    }
    return { processed, failed };
  }

  /** Throws a job away (after its cleanup). Returns false while the job is running. */
  function discard(id: string): boolean {
    const job = jobs.find((item) => item.id === id);
    if (!job) return true;
    if (job.status === 'syncing') return false;
    try {
      onDiscard[job.type]?.(job);
    } catch {
      // Cleanup is best effort: the job goes away either way.
    }
    jobs = jobs.filter((item) => item.id !== id);
    save();
    return true;
  }

  function flush() {
    if (!flushing) {
      flushing = runDue().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  }

  return {
    enqueue,
    flush,
    list: () => [...jobs],
    pendingCount: () => jobs.filter((job) => job.status === 'pending' || job.status === 'syncing').length,
    /** Retries one job now, or every failed job when no id is given. */
    retry(id?: string) {
      jobs = jobs.map((job) =>
        (id ? job.id === id : job.status === 'failed') && job.status !== 'syncing' && job.status !== 'done'
          ? { ...job, status: 'pending', nextRetryAt: now(), attempts: 0, lastError: undefined }
          : job,
      );
      save();
    },
    discard,
    dismiss: (id: string) => {
      discard(id);
    },
    clearDone() {
      jobs = jobs.filter(live);
      save();
    },
    /** Drops every job queued on behalf of `uid` (sign-out). Anonymous jobs stay. */
    removeForUser(uid: string) {
      const before = jobs.length;
      jobs = jobs.filter((job) => job.uid !== uid);
      if (jobs.length !== before) save();
      return before - jobs.length;
    },
    subscribe(listener: (jobs: OutboxJob[]) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
