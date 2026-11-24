import { sendPasswordResetEmail } from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

import { JOB_TYPES } from '@/domain/sync-queue';
import { auth } from '@/services/firebase/client';
import { runQueuedAvatar } from '@/services/media/avatar-upload';
import type { AvatarPayload } from '@/services/media/avatar-job';
import { removeQueuedFile } from '@/services/media/prepare';
import { appStorage } from '@/services/storage/mmkv';

import { isOnlineNow, onReconnect } from './connectivity';
import { createOutbox, type OutboxJob } from './outbox';
import { runChatMessage, runGenericWrite } from './queued-writes';

export const OUTBOX_JOBS = JOB_TYPES;

export const outbox = createOutbox({
  store: appStorage,
  handlers: {
    [OUTBOX_JOBS.passwordReset]: async (job) => {
      const { email } = job.payload as { email: string };
      await sendPasswordResetEmail(auth, email);
    },
    [OUTBOX_JOBS.mediaUpload]: (job) => runQueuedAvatar(job.payload as AvatarPayload),
    [OUTBOX_JOBS.chatMessage]: runChatMessage,
    [OUTBOX_JOBS.genericWrite]: runGenericWrite,
  },
  onDiscard: {
    // A thrown-away upload leaves its prepared copy in app storage: remove it.
    [OUTBOX_JOBS.mediaUpload]: (job) => removeQueuedFile((job.payload as AvatarPayload).localUri),
  },
});

function flushIfOnline() {
  if (isOnlineNow()) void outbox.flush();
}

let started = false;

/** Flush on launch, on foreground, on reconnect, and on a slow timer for backoff retries. */
export function startOutbox(): () => void {
  if (started) return () => undefined;
  started = true;
  flushIfOnline();
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') flushIfOnline();
  });
  const offReconnect = onReconnect(flushIfOnline);
  const timer = setInterval(flushIfOnline, 30_000);
  return () => {
    started = false;
    appState.remove();
    offReconnect();
    clearInterval(timer);
  };
}

let cache: OutboxJob[] = outbox.list();
outbox.subscribe((jobs) => {
  cache = jobs;
});

export function useOutboxJobs(): OutboxJob[] {
  return useSyncExternalStore(outbox.subscribe, () => cache);
}
