import { readJSON, writeJSON, type KeyValueStore } from '@/services/storage/kv';

export type OutboxStatus = 'pending' | 'failed';

export type OutboxJob<P = unknown> = {
  id: string;
  type: string;
  payload: P;
  idempotencyKey: string;
  attempts: number;
  nextRetryAt: number;
  status: OutboxStatus;
  lastError?: string;
  createdAt: number;
};

export type OutboxHandler = (job: OutboxJob) => Promise<void>;

export type OutboxOptions = {
  store: KeyValueStore;
  handlers: Record<string, OutboxHandler>;
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
  now = Date.now,
  key = 'outbox.v1',
  maxAttempts = 8,
  baseDelayMs = 2_000,
  maxDelayMs = 10 * 60_000,
}: OutboxOptions) {
  let jobs: OutboxJob[] = readJSON<OutboxJob[]>(store, key, []);
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

  function enqueue<P>(type: string, payload: P, idempotencyKey: string): OutboxJob<P> {
    const existing = jobs.find((job) => job.idempotencyKey === idempotencyKey);
    if (existing) return existing as OutboxJob<P>;
    const job: OutboxJob<P> = {
      id: `${now()}-${Math.random().toString(36).slice(2, 10)}`,
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
      try {
        if (!handler) throw new Error(`No handler for ${job.type}`);
        await handler(job);
        jobs = jobs.filter((item) => item.id !== job.id);
        processed += 1;
      } catch (error) {
        const attempts = job.attempts + 1;
        const exhausted = attempts >= maxAttempts;
        jobs = jobs.map((item) =>
          item.id === job.id
            ? {
                ...item,
                attempts,
                status: exhausted ? 'failed' : 'pending',
                nextRetryAt: now() + backoff(attempts),
                lastError: error instanceof Error ? error.message : String(error),
              }
            : item,
        );
        if (exhausted) failed += 1;
      }
      save();
    }
    return { processed, failed };
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
    pendingCount: () => jobs.filter((job) => job.status === 'pending').length,
    retry(id: string) {
      jobs = jobs.map((job) => (job.id === id ? { ...job, status: 'pending', nextRetryAt: now(), attempts: 0 } : job));
      save();
    },
    dismiss(id: string) {
      jobs = jobs.filter((job) => job.id !== id);
      save();
    },
    subscribe(listener: (jobs: OutboxJob[]) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
