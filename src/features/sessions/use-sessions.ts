import { documentId, getDocs, limit, orderBy, query, where } from '@react-native-firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { onSnapshot } from '@/services/firebase/listeners';
import { chunk } from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';
import type { Session, SessionItem } from '@/domain/types';
import { refs } from '@/services/firebase/refs';
import { useConnectivity } from '@/services/sync/connectivity';

/**
 * Members without session-history permission may only list their own sessions;
 * the query must carry that filter or rules reject the whole list.
 */
function sessionsQuery(wid: string, uid: string, seeAll: boolean) {
  return seeAll
    ? query(refs.sessions(wid), orderBy('createdAt', 'desc'))
    : query(refs.sessions(wid), where('operatorId', '==', uid), orderBy('createdAt', 'desc'));
}

/** Newest-first session pages. `sessions` mirrors `items` for callers that only need the list. */
export function useSessions(wid: string, uid: string, seeAll: boolean) {
  const page = usePaginatedQuery<Session>({
    key: wid && uid ? `sessions:${wid}:${seeAll ? 'all' : uid}` : null,
    build: () => sessionsQuery(wid, uid, seeAll),
    map: (d) => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) }),
  });
  return { ...page, sessions: page.items };
}

/** My active sessions (operator = me), for the home card and the setup warning. */
export function useMyActiveSessions(wid: string, uid: string) {
  const [state, setState] = useState<{ key: string; sessions: Session[] }>({ key: '', sessions: [] });
  const key = `${wid}:${uid}`;
  useEffect(() => {
    if (!wid || !uid) return;
    return onSnapshot(
      query(refs.sessions(wid), where('operatorId', '==', uid), orderBy('createdAt', 'desc'), limit(10)),
      (snapshot) => {
        const list: Session[] = [];
        snapshot.forEach((d) => {
          const s = { id: d.id, ...(d.data() as Omit<Session, 'id'>) };
          if (s.status === 'active') list.push(s);
        });
        setState({ key: `${wid}:${uid}`, sessions: list });
      },
      () => setState({ key: `${wid}:${uid}`, sessions: [] }),
    );
  }, [wid, uid]);
  // Keyed so a workspace switch never shows the previous workspace's sessions.
  return state.key === key ? state.sessions : [];
}

/** undefined while loading, null when missing or unreadable. Keyed so a switch never shows another session. */
export function useSession(wid: string, sid: string | undefined) {
  const key = `${wid}:${sid ?? ''}`;
  const [state, setState] = useState<{ key: string; session: Session | null | undefined }>({ key: '', session: undefined });
  useEffect(() => {
    if (!wid || !sid) return;
    return onSnapshot(
      refs.session(wid, sid),
      (snapshot) =>
        setState({ key, session: snapshot?.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<Session, 'id'>) } : null }),
      () => setState({ key, session: null }),
    );
  }, [wid, sid, key]);
  return state.key === key ? state.session : undefined;
}

const prefetched = new Set<string>();

/**
 * Warms the cache with the live beneficiary docs of an active session (≤100
 * reads, once per session per app run) so "View details" also opens offline.
 */
export function usePrefetchSessionBeneficiaries(wid: string, session: Session, items: SessionItem[], enabled: boolean) {
  const isOnline = useConnectivity((state) => state.isOnline);
  useEffect(() => {
    const key = `${wid}/${session.id}`;
    if (!enabled || !isOnline || session.status !== 'active' || items.length === 0 || prefetched.has(key)) return;
    prefetched.add(key);
    const ids = items.map((i) => i.beneficiaryId);
    for (const group of chunk(ids, SESSION_CONFIG.areaQueryChunk)) {
      getDocs(query(refs.beneficiaries(wid), where(documentId(), 'in', group))).catch(() => prefetched.delete(key));
    }
  }, [wid, session.id, session.status, items, enabled, isOnline]);
}

/** One listener for ≤100 items; it also keeps them in the offline cache for the runner. */
export function useSessionItems(wid: string, sid: string | undefined) {
  const key = `${wid}:${sid ?? ''}`;
  const [state, setState] = useState<{ key: string; items: SessionItem[] | null; error: boolean }>({
    key: '',
    items: null,
    error: false,
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!wid || !sid) return;
    return onSnapshot(
      query(refs.items(wid, sid), orderBy('order')),
      (snapshot) => {
        const list: SessionItem[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<SessionItem, 'id'>) });
        });
        setState({ key, items: list, error: false });
      },
      () => setState({ key, items: null, error: true }),
    );
  }, [wid, sid, key, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === key ? state : { items: null, error: false };
  return { items: current.items, error: current.error, retry };
}
