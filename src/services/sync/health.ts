import { serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { useEffect, useRef } from 'react';

import {
  healthDocId,
  healthSummary,
  HEALTH_INTERVAL_MS,
  shouldWriteHealth,
  type HealthSummary,
} from '@/domain/sync-queue';
import { useAuth } from '@/providers/auth-provider';
import { appVersion, deviceId, devicePlatform } from '@/services/device/info';
import { refs } from '@/services/firebase/refs';

import { isOnlineNow } from './connectivity';
import { useSyncStatus } from './sync-status';
import { useSyncStore } from './sync-store';

/**
 * Keeps `syncHealth/{uid}_{deviceId}` current so the dashboard can see queue sizes and failures
 * across devices. One write per ten minutes, or at once when failures appear or change. Counts
 * only: no job payloads and no error text leave the device.
 */
export function useSyncHealthReporter() {
  const { user, profile } = useAuth();
  const status = useSyncStatus();
  const uid = user?.uid ?? null;
  const active = !!uid && !!profile && profile.status === 'active';
  const waitingWrites = useSyncStore((state) => state.pending);
  const summary = healthSummary(status.jobs, waitingWrites, status.failures.length);
  const hasPending = summary.pending > 0;
  const last = useRef<{ summary: HealthSummary; at: number } | null>(null);
  const latest = useRef(summary);
  useEffect(() => {
    latest.current = summary;
  });

  useEffect(() => {
    last.current = null;
  }, [uid]);

  useEffect(() => {
    if (!active || !uid) return;
    const write = (force: boolean) => {
      const next = latest.current;
      const now = Date.now();
      if (!isOnlineNow()) return;
      if (!force && !shouldWriteHealth(last.current, next, now)) return;
      last.current = { summary: next, at: now };
      const id = deviceId();
      void setDoc(refs.syncHealth(healthDocId(uid, id)), {
        uid,
        deviceId: id,
        platform: devicePlatform(),
        appVersion: appVersion(),
        pending: next.pending,
        failed: next.failed,
        oldestPendingAt: next.oldestPendingAt,
        lastSyncAt: useSyncStore.getState().lastSyncedAt,
        updatedAt: serverTimestamp(),
      }).catch(() => {
        // Health is best effort. Forget the attempt so the next change tries again.
        last.current = null;
      });
    };
    write(false);
    const timer = setInterval(() => write(false), HEALTH_INTERVAL_MS / 2);
    return () => clearInterval(timer);
    // `latest` carries the numbers; these dependencies are the changes worth a write.
  }, [active, uid, hasPending, summary.failed, status.isOnline]);
}

/** Mount once under the account providers. */
export function SyncHealthReporter() {
  useSyncHealthReporter();
  return null;
}
