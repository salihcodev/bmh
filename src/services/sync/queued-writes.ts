import { doc, increment, serverTimestamp, Timestamp, writeBatch } from '@react-native-firebase/firestore';

import {
  chatMessageOp,
  genericWriteOps,
  resolveMarkers,
  type ChatMessagePayload,
  type GenericWritePayload,
  type QueuedOp,
} from '@/domain/queued-write';
import { auth, db } from '@/services/firebase/client';
import { commitOnline } from '@/services/firebase/write';

import type { OutboxJob } from './outbox';

const resolvers = {
  serverTimestamp: () => serverTimestamp(),
  increment: (by: number) => increment(by),
  time: (ms: number) => Timestamp.fromMillis(ms),
};

async function commitOps(ops: QueuedOp[]): Promise<void> {
  const batch = writeBatch(db);
  for (const op of ops) {
    const ref = doc(db, op.path);
    if (op.kind === 'delete') batch.delete(ref);
    else if (op.kind === 'update') batch.update(ref, resolveMarkers(op.data, resolvers) as Record<string, unknown>);
    else batch.set(ref, resolveMarkers(op.data, resolvers) as Record<string, unknown>, op.merge ? { merge: true } : {});
  }
  // Awaits the server on purpose: the job only counts as done once the server accepted it.
  await commitOnline(batch);
}

function assertOwner(job: OutboxJob) {
  if (job.uid && auth.currentUser?.uid !== job.uid) throw new Error('Signed in as a different account');
}

/** Outbox handler for `generic_write`. */
export async function runGenericWrite(job: OutboxJob): Promise<void> {
  assertOwner(job);
  await commitOps(genericWriteOps(job.payload as GenericWritePayload));
}

/** Outbox handler for `chat_message` (the composer arrives with V9). */
export async function runChatMessage(job: OutboxJob): Promise<void> {
  assertOwner(job);
  await commitOps([chatMessageOp(job.payload as ChatMessagePayload)]);
}
