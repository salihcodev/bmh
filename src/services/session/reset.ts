import { signOut } from '@react-native-firebase/auth';
import { clearPersistence, terminate, waitForPendingWrites } from '@react-native-firebase/firestore';
import { reloadAppAsync } from 'expo';

import { auth, db } from '@/services/firebase/client';
import { signOutGoogleSession } from '@/services/firebase/google';
import { unsubscribeAll } from '@/services/firebase/listeners';
import { sweepQueuedFiles } from '@/services/media/prepare';
import { appStorage } from '@/services/storage/mmkv';
import { clearUserKeys, LAST_UID_KEY } from '@/services/storage/user-scope';
import { isOnlineNow } from '@/services/sync/connectivity';
import { outbox } from '@/services/sync/outbox-runtime';
import { useSyncStore } from '@/services/sync/sync-store';

import { showSplashOverlay } from './splash-overlay';

export type PendingWrites = 'none' | 'pending';

/**
 * Resolves 'none' once Firestore has acknowledged every queued write, or 'pending' if
 * that did not happen within `timeoutMs` (typically offline with unsynced changes).
 */
export async function checkPendingWrites(timeoutMs = 2500): Promise<PendingWrites> {
  // Offline with writes started in this run: no need to wait for the timeout.
  if (!isOnlineNow() && useSyncStore.getState().pending > 0) return 'pending';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PendingWrites>((resolve) => {
    timer = setTimeout(() => resolve('pending'), timeoutMs);
  });
  const flushed = waitForPendingWrites(db)
    .then(() => 'none' as const)
    .catch(() => 'pending' as const);
  const result = await Promise.race([flushed, timeout]);
  if (timer) clearTimeout(timer);
  return result;
}

/**
 * Removes every trace of `uid` from the device: listeners, in-memory stores, the
 * user's MMKV keys and outbox jobs, and the whole Firestore cache (which does not
 * evaluate security rules). The JS runtime is then reloaded so no provider keeps
 * a reference to the terminated Firestore instance.
 */
export async function purgeDeviceData(uid: string | null): Promise<void> {
  unsubscribeAll();
  useSyncStore.getState().reset();
  if (uid) {
    outbox.removeForUser(uid);
    sweepQueuedFiles(
      outbox
        .list()
        .map((job) => (job.payload as { localUri?: string } | null)?.localUri)
        .filter((uri): uri is string => typeof uri === 'string'),
    );
    clearUserKeys(appStorage, uid);
  }
  appStorage.remove(LAST_UID_KEY);
  try {
    await terminate(db);
    await clearPersistence(db);
  } catch {
    // clearPersistence fails if another instance is still running; the reload below
    // still drops all in-memory state and the next purge retries the cache.
  }
}

let resetting = false;

/** True while `resetSession` runs, so the auth listener does not start a second purge. */
export function isResetting(): boolean {
  return resetting;
}

/**
 * Full sign-out. Call `checkPendingWrites` first and confirm with the user if needed.
 * The splash covers the app before auth changes, so the login screen appears once, after the reload.
 */
export async function resetSession(): Promise<void> {
  resetting = true;
  await showSplashOverlay();
  const uid = auth.currentUser?.uid ?? null;
  unsubscribeAll();
  await signOutGoogleSession().catch(() => undefined);
  await signOut(auth).catch(() => undefined);
  await purgeDeviceData(uid);
  await reloadAppAsync('sign-out');
}
