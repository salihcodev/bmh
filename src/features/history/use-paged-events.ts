import { orderBy, query } from '@react-native-firebase/firestore';

import type { EventRecord } from '@/domain/types';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';

type CollectionRef = Parameters<typeof query>[0];

export const PAGE_SIZE = 20;

/**
 * Newest-first event pages (beneficiary history, workspace audit log) on usePaginatedQuery.
 * `collectionRef` null disables the query; the ref's path is the cache key.
 */
export function usePagedEvents(collectionRef: CollectionRef | null) {
  const path = collectionRef ? (collectionRef as unknown as { path: string }).path : null;
  return usePaginatedQuery<EventRecord>({
    key: path ? `events:${path}` : null,
    build: () => query(collectionRef!, orderBy('createdAt', 'desc')),
    map: (d) => ({ ...(d.data() as EventRecord), id: d.id }),
    pageSize: PAGE_SIZE,
  });
}
