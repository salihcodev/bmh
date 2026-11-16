import { orderBy, query, where, type QueryDocumentSnapshot } from '@react-native-firebase/firestore';
import { useEffect, useState } from 'react';

import { PREFIX_END, type SearchPlan } from '@/domain/search';
import type { Beneficiary } from '@/domain/types';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';

export const PAGE_SIZE = 20;

export type ListFilter = {
  plan: SearchPlan;
  cityId?: string | null;
  areaId?: string | null;
  archived?: boolean;
};

function buildConstraints(filter: ListFilter) {
  const archived = filter.archived ?? false;
  if (filter.plan.kind === 'phone') {
    // (isArchived, phoneDigits) index; area/city narrowing is done in memory (few hits).
    return [where('isArchived', '==', archived), where('phoneDigits', 'array-contains', filter.plan.e164)];
  }
  const constraints = [where('isArchived', '==', archived)];
  if (filter.areaId) constraints.push(where('areaId', '==', filter.areaId));
  else if (filter.cityId) constraints.push(where('cityId', '==', filter.cityId));
  // Prefix as a range filter (not startAt/endAt) so the pager's startAfter cursor is the only start bound.
  if (filter.plan.kind === 'name') {
    constraints.push(where('nameSearch', '>=', filter.plan.prefix), where('nameSearch', '<=', filter.plan.prefix + PREFIX_END));
  }
  return [...constraints, orderBy('nameSearch')] as Parameters<typeof query>[1][];
}

function toBeneficiary(d: QueryDocumentSnapshot): Beneficiary {
  return { id: d.id, ...(d.data() as Omit<Beneficiary, 'id'>) };
}

function matchesPlace(b: Beneficiary, filter: ListFilter) {
  if (filter.areaId) return b.areaId === filter.areaId;
  if (filter.cityId) return b.cityId === filter.cityId;
  return true;
}

/**
 * Beneficiary list on usePaginatedQuery: the first page is live (new/edited rows appear
 * immediately, also offline from cache); later pages are cursor reads of 20.
 */
export function useBeneficiaryList(wid: string, filter: ListFilter) {
  const invalid = filter.plan.kind === 'invalidPhone';
  const isPhone = filter.plan.kind === 'phone';
  const page = usePaginatedQuery<Beneficiary>({
    key: wid && !invalid ? `beneficiaries:${wid}:${JSON.stringify(filter)}` : null,
    build: () => query(refs.beneficiaries(wid), ...buildConstraints(filter)),
    map: toBeneficiary,
    filter: isPhone ? (b) => matchesPlace(b, filter) : undefined,
    pageSize: PAGE_SIZE,
  });
  if (invalid) return { ...page, items: [] as Beneficiary[], status: 'empty' as const, done: true };
  return page;
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
