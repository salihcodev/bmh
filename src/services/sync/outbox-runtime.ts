import { sendPasswordResetEmail } from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

import { auth } from '@/services/firebase/client';
import { appStorage } from '@/services/storage/mmkv';

import { isOnlineNow, onReconnect } from './connectivity';
import { createOutbox, type OutboxJob } from './outbox';

export const OUTBOX_JOBS = {
  passwordReset: 'password_reset',
} as const;

export const outbox = createOutbox({
  store: appStorage,
  handlers: {
    [OUTBOX_JOBS.passwordReset]: async (job) => {
      const { email } = job.payload as { email: string };
      await sendPasswordResetEmail(auth, email);
    },
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
