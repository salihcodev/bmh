import { collectionGroup, limit, orderBy, query, where } from '@react-native-firebase/firestore';
import { onSnapshot } from '@/services/firebase/listeners';
import { useEffect, useState } from 'react';

import type { EventRecord } from '@/domain/types';
import { db } from '@/services/firebase/client';

/** Last 5 beneficiary events across the workspace (collection-group index on history). */
export function useRecentActivity(wid: string, enabled: boolean) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  useEffect(() => {
    if (!wid || !enabled) return;
    return onSnapshot(
      query(collectionGroup(db, 'history'), where('workspaceId', '==', wid), orderBy('createdAt', 'desc'), limit(5)),
      (snapshot) => {
        const list: EventRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ ...(d.data() as EventRecord), id: d.id });
        });
        setEvents(list);
      },
      () => setEvents([]),
    );
  }, [wid, enabled]);
  return enabled ? events : [];
}
