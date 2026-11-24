// Writes that wait in the outbox. Firestore already queues plain writes by itself, so these exist
// for work that must reach the server in order, or must only run online (chat messages, and writes
// that need a server check). The payload is plain JSON (the outbox lives in MMKV), so values that
// need the SDK (server time, increments) are markers resolved right before the commit.

export type ServerTimeMarker = { $: 'serverTimestamp' };
export type IncrementMarker = { $: 'increment'; by: number };
export type TimeMarker = { $: 'time'; ms: number };
export type QueuedMarker = ServerTimeMarker | IncrementMarker | TimeMarker;

export const serverTime = (): ServerTimeMarker => ({ $: 'serverTimestamp' });
export const incrementBy = (by: number): IncrementMarker => ({ $: 'increment', by });
export const timeAt = (ms: number): TimeMarker => ({ $: 'time', ms });

export type QueuedOp =
  | { kind: 'set'; path: string; data: Record<string, unknown>; merge?: boolean }
  | { kind: 'update'; path: string; data: Record<string, unknown> }
  | { kind: 'delete'; path: string };

/** What the outbox stores for `generic_write`. */
export type GenericWritePayload = {
  /** Short label for the queue screen. */
  label: string;
  ops: QueuedOp[];
  /** False when throwing the job away would lose something the user cannot redo. Default true. */
  discardable?: boolean;
};

/** What the outbox stores for `chat_message`. The message id is `clientId`, so a retry cannot duplicate it. */
export type ChatMessagePayload = {
  workspaceId: string;
  clientId: string;
  /** The message fields, with `createdAt` as a marker. */
  data: Record<string, unknown>;
};

export const MAX_QUEUED_OPS = 400;

function isMarker(value: unknown): value is QueuedMarker {
  return typeof value === 'object' && value !== null && typeof (value as { $?: unknown }).$ === 'string';
}

export type MarkerResolvers = {
  serverTimestamp: () => unknown;
  increment: (by: number) => unknown;
  time: (ms: number) => unknown;
};

/** Replaces markers (at any depth) with the SDK values. Everything else passes through. */
export function resolveMarkers(value: unknown, resolvers: MarkerResolvers): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveMarkers(item, resolvers));
  if (isMarker(value)) {
    if (value.$ === 'serverTimestamp') return resolvers.serverTimestamp();
    if (value.$ === 'increment' && Number.isFinite((value as IncrementMarker).by)) {
      return resolvers.increment((value as IncrementMarker).by);
    }
    if (value.$ === 'time' && Number.isFinite((value as TimeMarker).ms)) return resolvers.time((value as TimeMarker).ms);
    throw new Error(`Unknown queued value marker: ${value.$}`);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveMarkers(item, resolvers)]));
  }
  return value;
}

const SEGMENT = /^[^/]+$/;

/** A document path has an even number of non-empty segments. */
export function isDocPath(path: string): boolean {
  const parts = path.split('/');
  return parts.length >= 2 && parts.length % 2 === 0 && parts.every((part) => SEGMENT.test(part));
}

export type PayloadError = 'empty' | 'tooMany' | 'badPath';

export function validateOps(ops: readonly QueuedOp[]): PayloadError | null {
  if (ops.length === 0) return 'empty';
  if (ops.length > MAX_QUEUED_OPS) return 'tooMany';
  return ops.every((op) => isDocPath(op.path)) ? null : 'badPath';
}

export function chatMessageOp(payload: ChatMessagePayload): QueuedOp {
  return { kind: 'set', path: `workspaces/${payload.workspaceId}/chat/${payload.clientId}`, data: payload.data };
}

/** The outbox idempotency key for a chat message. */
export const chatMessageKey = (payload: Pick<ChatMessagePayload, 'workspaceId' | 'clientId'>) =>
  `chat:${payload.workspaceId}:${payload.clientId}`;

export function genericWriteOps(payload: GenericWritePayload): QueuedOp[] {
  const error = validateOps(payload.ops);
  if (error) throw new Error(`Invalid queued write (${error})`);
  return payload.ops;
}
