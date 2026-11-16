import {
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

import { onSnapshot } from '@/services/firebase/listeners';
import { chunk } from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';
import type { Session, SessionItem } from '@/domain/types';
import { refs } from '@/services/firebase/refs';
import { useConnectivity } from '@/services/sync/connectivity';

const PAGE = 20;

/**
 * Members without session-history permission may only list their own sessions;
 * the query must carry that filter or rules reject the whole list.
 */
function sessionsQuery(wid: string, uid: string, seeAll: boolean) {
  return seeAll
    ? [orderBy('createdAt', 'desc')]
    : [where('operatorId', '==', uid), orderBy('createdAt', 'desc')];
}

export function useSessions(wid: string, uid: string, seeAll: boolean) {
  const [first, setFirst] = useState<Session[] | null>(null);
  const [more, setMore] = useState<Session[]>([]);
  const [done, setDone] = useState(false);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    if (!wid || !uid) return;
    return onSnapshot(
      query(refs.sessions(wid), ...sessionsQuery(wid, uid, seeAll), limit(PAGE)),
      (snapshot) => {
        const docs = snapshot.docs as QueryDocumentSnapshot[];
        setFirst(docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) })));
        setMore([]);
        cursor.current = docs[docs.length - 1] ?? null;
        setDone(docs.length < PAGE);
      },
      () => setFirst([]),
    );
  }, [wid, uid, seeAll]);

  const loadMore = useCallback(async () => {
    if (!cursor.current || done) return;
    const snapshot = await getDocs(
      query(refs.sessions(wid), ...sessionsQuery(wid, uid, seeAll), startAfter(cursor.current), limit(PAGE)),
    );
    const docs = snapshot.docs as QueryDocumentSnapshot[];
    cursor.current = docs[docs.length - 1] ?? cursor.current;
    setMore((current) => [...current, ...docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) }))]);
    setDone(docs.length < PAGE);
  }, [wid, uid, seeAll, done]);

  return { sessions: first === null ? null : [...first, ...more], done, loadMore };
}

/** My active sessions (operator = me), for the home card and the setup warning. */
export function useMyActiveSessions(wid: string, uid: string) {
  const [sessions, setSessions] = useState<Session[]>([]);
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
        setSessions(list);
      },
      () => setSessions([]),
    );
  }, [wid, uid]);
  return sessions;
}

export function useSession(wid: string, sid: string | undefined) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!wid || !sid) return;
    return onSnapshot(
      refs.session(wid, sid),
      (snapshot) => setSession(snapshot?.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<Session, 'id'>) } : null),
      () => setSession(null),
    );
  }, [wid, sid]);
  return session;
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
  const [items, setItems] = useState<SessionItem[] | null>(null);
  useEffect(() => {
    if (!wid || !sid) return;
    return onSnapshot(
      query(refs.items(wid, sid), orderBy('order')),
      (snapshot) => {
        const list: SessionItem[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<SessionItem, 'id'>) });
        });
        setItems(list);
      },
      () => setItems([]),
    );
  }, [wid, sid]);
  return items;
}
