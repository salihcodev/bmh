import {
  getDocs,
  limit,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  canLoadMore,
  initialPageState,
  pageReducer,
  selectItems,
  selectStatus,
  type PageAction,
  type PageState,
} from '@/lib/pagination';
import { onSnapshot } from '@/services/firebase/listeners';

type Query = Parameters<typeof query>[0];
type Snap = QueryDocumentSnapshot;

export const DEFAULT_PAGE_SIZE = 20;

/**
 * Cursor pagination for any Firestore list.
 * - `key` identifies the query (filters included); `null` disables it.
 * - `build()` returns the ordered query without `limit`/cursor.
 * - The first page is a live listener by default (works offline from cache); later pages are reads.
 */
export function usePaginatedQuery<T extends { id: string }>({
  key,
  build,
  map,
  pageSize = DEFAULT_PAGE_SIZE,
  live = true,
  filter,
}: {
  key: string | null;
  build: () => Query;
  map: (snapshot: Snap) => T;
  pageSize?: number;
  live?: boolean;
  filter?: (item: T) => boolean;
}) {
  const [state, dispatch] = useReducer(
    pageReducer as (s: PageState<T, Snap>, a: PageAction<T, Snap>) => PageState<T, Snap>,
    undefined,
    () => initialPageState<T, Snap>(),
  );
  const [nonce, setNonce] = useState(0);
  const latest = useRef({ build, map, filter, state });
  // Declared before the query effect so it runs first in each commit.
  useEffect(() => {
    latest.current = { build, map, filter, state };
  });

  const apply = useCallback((docs: Snap[]) => {
    const { map: toItem, filter: keep } = latest.current;
    const items = docs.map(toItem);
    return keep ? items.filter(keep) : items;
  }, []);

  useEffect(() => {
    dispatch({ type: 'reset' });
    if (key === null) return;
    const q = query(latest.current.build(), limit(pageSize));
    if (live) {
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const docs = snapshot.docs as Snap[];
          dispatch({
            type: 'first',
            items: apply(docs),
            cursor: docs[docs.length - 1] ?? null,
            pageSize,
            fromCache: snapshot.metadata.fromCache,
          });
        },
        (error) => dispatch({ type: 'firstError', error }),
      );
    }
    let cancelled = false;
    getDocs(q).then(
      (snapshot) => {
        if (cancelled) return;
        const docs = snapshot.docs as Snap[];
        dispatch({
          type: 'first',
          items: apply(docs),
          cursor: docs[docs.length - 1] ?? null,
          pageSize,
          fromCache: snapshot.metadata.fromCache,
        });
      },
      (error) => !cancelled && dispatch({ type: 'firstError', error }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, live, pageSize, nonce, apply]);

  const loadMore = useCallback(async () => {
    const current = latest.current.state;
    if (key === null || !canLoadMore(current) || !current.cursor) return;
    dispatch({ type: 'moreStart' });
    try {
      const snapshot = await getDocs(query(latest.current.build(), startAfter(current.cursor), limit(pageSize)));
      const docs = snapshot.docs as Snap[];
      dispatch({ type: 'more', items: apply(docs), cursor: docs[docs.length - 1] ?? null, pageSize });
    } catch (error) {
      dispatch({ type: 'moreError', error });
    }
  }, [key, pageSize, apply]);

  /** Pull-to-refresh and retry after a first-page error: re-run the first page. */
  const refresh = useCallback(() => {
    dispatch({ type: 'refresh' });
    setNonce((n) => n + 1);
  }, []);

  const items = useMemo(() => selectItems(state), [state]);
  return {
    items,
    status: key === null ? ('empty' as const) : selectStatus(state),
    error: state.error,
    moreError: state.moreError,
    done: state.done,
    loadingMore: state.loadingMore,
    refreshing: state.refreshing,
    fromCache: state.fromCache,
    loadMore,
    refresh,
  };
}
