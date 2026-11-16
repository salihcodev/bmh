import {
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { EventRecord } from '@/domain/types';

type CollectionRef = Parameters<typeof query>[0];
type Cursor = QueryDocumentSnapshot | null;

export const PAGE_SIZE = 20;

/** Newest-first event pages (history, session events, audit log). 20 reads per page. */
export function usePagedEvents(collectionRef: CollectionRef | null) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cursor = useRef<Cursor>(null);
  const path = collectionRef ? (collectionRef as unknown as { path: string }).path : null;

  const fetchPage = useCallback(
    (reset: boolean) => {
      if (!collectionRef) return Promise.resolve();
      const after = !reset && cursor.current ? [startAfter(cursor.current)] : [];
      return getDocs(query(collectionRef, orderBy('createdAt', 'desc'), ...after, limit(PAGE_SIZE)))
        .then((snapshot) => {
          const page: EventRecord[] = [];
          snapshot.forEach((d) => {
            page.push({ ...(d.data() as EventRecord), id: d.id });
          });
          cursor.current = (snapshot.docs[snapshot.docs.length - 1] as Cursor) ?? cursor.current;
          setEvents((current) => (reset ? page : [...current, ...page]));
          setDone(page.length < PAGE_SIZE);
          setError(null);
        })
        .catch((exc: unknown) => setError(exc))
        .finally(() => setLoading(false));
    },
    // path identifies the collection; the ref object itself changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path],
  );

  useEffect(() => {
    cursor.current = null;
    void fetchPage(true);
  }, [fetchPage]);

  const load = (reset: boolean) => {
    if (reset) cursor.current = null;
    setLoading(true);
    return fetchPage(reset);
  };

  return {
    events,
    loading,
    done,
    error,
    loadMore: () => (!loading && !done ? load(false) : undefined),
    refresh: () => load(true),
  };
}
