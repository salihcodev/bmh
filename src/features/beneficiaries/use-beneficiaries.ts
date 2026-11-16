import {
  endAt,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  startAt,
  where,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PREFIX_END, type SearchPlan } from '@/domain/search';
import type { Beneficiary } from '@/domain/types';
import { refs } from '@/services/firebase/refs';

export const PAGE_SIZE = 20;

export type ListFilter = {
  plan: SearchPlan;
  cityId?: string | null;
  areaId?: string | null;
  archived?: boolean;
};

type Snap = QueryDocumentSnapshot;

function buildConstraints(filter: ListFilter) {
  const archived = filter.archived ?? false;
  if (filter.plan.kind === 'phone') {
    // (isArchived, phoneDigits) index; area/city narrowing is done in memory (≤ a few hits).
    return [where('isArchived', '==', archived), where('phoneDigits', 'array-contains', filter.plan.e164)];
  }
  const constraints = [where('isArchived', '==', archived)];
  if (filter.areaId) constraints.push(where('areaId', '==', filter.areaId));
  else if (filter.cityId) constraints.push(where('cityId', '==', filter.cityId));
  const ordered = [...constraints, orderBy('nameSearch')] as Parameters<typeof query>[1][];
  if (filter.plan.kind === 'name') {
    ordered.push(startAt(filter.plan.prefix), endAt(filter.plan.prefix + PREFIX_END));
  }
  return ordered;
}

function toBeneficiary(d: Snap): Beneficiary {
  return { id: d.id, ...(d.data() as Omit<Beneficiary, 'id'>) };
}

/**
 * First page is a live listener (new/edited rows appear immediately, also offline);
 * later pages are cursor reads of 20. Offline, both are served from the device cache.
 */
export function useBeneficiaryList(wid: string, filter: ListFilter) {
  const [first, setFirst] = useState<Beneficiary[] | null>(null);
  const [more, setMore] = useState<Beneficiary[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cursor = useRef<Snap | null>(null);
  const key = JSON.stringify(filter);

  useEffect(() => {
    if (!wid || filter.plan.kind === 'invalidPhone') return;
    const q = query(refs.beneficiaries(wid), ...buildConstraints(filter), limit(PAGE_SIZE));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const docs = snapshot.docs as Snap[];
        setFirst(
          docs
            .map(toBeneficiary)
            .filter((b) => filter.plan.kind !== 'phone' || matchesPlace(b, filter)),
        );
        setMore([]);
        cursor.current = docs[docs.length - 1] ?? null;
        setDone(docs.length < PAGE_SIZE);
        setFromCache(snapshot.metadata.fromCache);
        setError(null);
      },
      (exc) => setError(exc),
    );
    // key captures every filter field
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wid, key]);

  const loadMore = useCallback(async () => {
    if (!cursor.current || done || loadingMore || filter.plan.kind === 'phone') return;
    setLoadingMore(true);
    try {
      const snapshot = await getDocs(
        query(refs.beneficiaries(wid), ...buildConstraints(filter), startAfter(cursor.current), limit(PAGE_SIZE)),
      );
      const docs = snapshot.docs as Snap[];
      cursor.current = docs[docs.length - 1] ?? cursor.current;
      setMore((current) => [...current, ...docs.map(toBeneficiary)]);
      setDone(docs.length < PAGE_SIZE);
    } catch (exc) {
      setError(exc);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wid, key, done, loadingMore]);

  const invalid = filter.plan.kind === 'invalidPhone';
  return {
    items: invalid ? [] : first === null ? null : [...first, ...more],
    fromCache,
    done: invalid || done,
    loadingMore,
    error,
    loadMore,
  };
}

function matchesPlace(b: Beneficiary, filter: ListFilter) {
  if (filter.areaId) return b.areaId === filter.areaId;
  if (filter.cityId) return b.cityId === filter.cityId;
  return true;
}

export function useBeneficiary(wid: string, id: string | undefined) {
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null | undefined>(undefined);
  const [fromCache, setFromCache] = useState(false);
  useEffect(() => {
    if (!wid || !id) return;
    return onSnapshot(
      refs.beneficiary(wid, id),
      { includeMetadataChanges: true },
      (snapshot) => {
        setBeneficiary(snapshot?.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<Beneficiary, 'id'>) } : null);
        setFromCache(!!snapshot?.metadata.fromCache);
      },
      () => setBeneficiary(null),
    );
  }, [wid, id]);
  return { beneficiary, fromCache };
}
