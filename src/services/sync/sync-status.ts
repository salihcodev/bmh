import { onSnapshotsInSync, waitForPendingWrites } from '@react-native-firebase/firestore';

import { db } from '@/services/firebase/client';

import { onReconnect, useConnectivity } from './connectivity';
import { useOutboxJobs } from './outbox-runtime';
import { useSyncStore } from './sync-store';

export type SyncState = 'offline' | 'syncing' | 'synced' | 'error';

let started = false;

function confirmPreviousRunWrites() {
  // Resolves once every write queued before this call (including from a previous run) is acknowledged.
  void waitForPendingWrites(db)
    .then(() => useSyncStore.getState().setPreviousRunPending(false))
    .catch(() => undefined);
}

export function startSyncStatus(): () => void {
  if (started) return () => undefined;
  started = true;
  confirmPreviousRunWrites();
  const offReconnect = onReconnect(confirmPreviousRunWrites);
  const offInSync = onSnapshotsInSync(db, () => useSyncStore.getState().markSynced());
  return () => {
    started = false;
    offReconnect();
    offInSync();
  };
}

export function useSyncStatus() {
  const isOnline = useConnectivity((state) => state.isOnline);
  const pending = useSyncStore((state) => state.pending);
  const previousRunPending = useSyncStore((state) => state.previousRunPending);
  const failures = useSyncStore((state) => state.failures);
  const jobs = useOutboxJobs();
  const outboxPending = jobs.filter((job) => job.status === 'pending').length;
  const outboxFailed = jobs.filter((job) => job.status === 'failed').length;
  const waiting = pending + outboxPending;

  let state: SyncState;
  if (failures.length > 0 || outboxFailed > 0) state = 'error';
  else if (!isOnline) state = 'offline';
  else if (waiting > 0 || previousRunPending) state = 'syncing';
  else state = 'synced';

  return { state, isOnline, waiting, previousRunPending, failures, jobs };
}
