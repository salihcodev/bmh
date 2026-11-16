import type { WriteBatch } from '@react-native-firebase/firestore';

import { errorMessage } from '@/lib/action-feedback';
import { useSyncStore } from '@/services/sync/sync-store';

let counter = 0;

/**
 * Commits a batch without blocking the UI. Offline, commit() only resolves when the
 * server acknowledges, so callers must never await it in offline-capable flows.
 * The local cache (and every snapshot listener) reflects the batch immediately.
 *
 * `rebuild` recreates the batch for a manual retry from the sync sheet.
 */
export function commitInBackground(batch: WriteBatch, label: string, rebuild?: () => WriteBatch): void {
  const store = useSyncStore.getState();
  store.begin();
  batch
    .commit()
    .then(() => {
      useSyncStore.getState().end();
      useSyncStore.getState().markSynced();
    })
    .catch((error: unknown) => {
      counter += 1;
      const code = (error as { code?: string } | null)?.code;
      useSyncStore.getState().fail({
        id: `${Date.now()}-${counter}`,
        label,
        code,
        message: errorMessage(error),
        at: Date.now(),
        retry: rebuild ? () => commitInBackground(rebuild(), label, rebuild) : undefined,
      });
    });
}

/** For online-only flows (workspace creation, session start, invites): await the server. */
export async function commitOnline(batch: WriteBatch): Promise<void> {
  await batch.commit();
}
