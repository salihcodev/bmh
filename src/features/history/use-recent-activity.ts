import { collectionGroup, limit, orderBy, query, where } from '@react-native-firebase/firestore';
import { onSnapshot } from '@/services/firebase/listeners';
import { useCallback, useEffect, useState } from 'react';

import type { EventRecord } from '@/domain/types';
import { db } from '@/services/firebase/client';

/**
 * Last 5 beneficiary events across the workspace (collection-group index on history).
 * State is keyed on the workspace so a switch never shows the previous workspace's events.
 * `events` is null while loading.
 */
export function useRecentActivity(wid: string, enabled: boolean) {
  const [state, setState] = useState<{ wid: string; events: EventRecord[] | null; error: boolean }>({
    wid: '',
    events: null,
    error: false,
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!wid || !enabled) return;
    return onSnapshot(
      query(collectionGroup(db, 'history'), where('workspaceId', '==', wid), orderBy('createdAt', 'desc'), limit(5)),
      (snapshot) => {
        const list: EventRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ ...(d.data() as EventRecord), id: d.id });
        });
        setState({ wid, events: list, error: false });
      },
      () => setState({ wid, events: null, error: true }),
    );
  }, [wid, enabled, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.wid === wid ? state : { events: null, error: false };
  return { events: enabled ? current.events : [], error: enabled && current.error, retry };
}
