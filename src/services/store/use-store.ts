import {
  limit,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from '@react-native-firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { normalizeBag, normalizeBagChange, normalizeBagItem, normalizeParticipant } from '@/domain/bag';
import { normalizeReview } from '@/domain/review';
import { nameSearchKey, PREFIX_END } from '@/domain/search';
import {
  normalizeStoreCategory,
  normalizeStoreConfig,
  normalizeStoreItem,
  STORE_CONFIG_DEFAULTS,
  type StoreCategory,
  type StoreConfig,
  type StoreItem,
} from '@/domain/store';
import { normalizeSupplierProfile, type SupplierProfile } from '@/domain/supplier-profile';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';

function parseDoc<T>(map: (id: string, data: Record<string, unknown>) => T, snap: { id: string; data: () => Record<string, unknown> | undefined }) {
  return map(snap.id, snap.data() ?? {});
}

export function useStoreCategories() {
  return usePaginatedQuery<StoreCategory>({
    key: 'storeCategories',
    build: () => query(refs.storeCategories(), orderBy('order', 'asc')),
    map: (snap) => parseDoc(normalizeStoreCategory, snap),
    filter: (item) => !item.isDeleted,
    pageSize: 100,
  });
}

export function useStoreItems(opts: {
  search?: string;
  categoryId?: string | null;
  subCategoryId?: string | null;
  supplierId?: string | null;
  staff?: boolean;
  /** When false, skips the Firestore listener (store home preview). */
  enabled?: boolean;
} = {}) {
  const search = opts.search?.trim() ?? '';
  const prefix = search ? nameSearchKey(search) : '';
  const enabled = opts.enabled !== false;
  const key = enabled
    ? `storeItems:${opts.staff ? 'staff' : 'pub'}:${opts.categoryId ?? ''}:${opts.subCategoryId ?? ''}:${opts.supplierId ?? ''}:${prefix}`
    : null;
  return usePaginatedQuery<StoreItem>({
    key,
    build: () => {
      const constraints: QueryConstraint[] = [];
      if (opts.supplierId) {
        constraints.push(where('supplierId', '==', opts.supplierId), where('isDeleted', '==', false), orderBy('createdAt', 'desc'));
      } else if (opts.staff) {
        constraints.push(where('isDeleted', '==', false), orderBy('createdAt', 'desc'));
      } else if (opts.subCategoryId) {
        constraints.push(
          where('status', '==', 'active'),
          where('isDeleted', '==', false),
          where('subCategoryId', '==', opts.subCategoryId),
          orderBy('nameSearch', 'asc'),
        );
      } else if (opts.categoryId) {
        constraints.push(
          where('status', '==', 'active'),
          where('isDeleted', '==', false),
          where('categoryId', '==', opts.categoryId),
          orderBy('nameSearch', 'asc'),
        );
      } else if (prefix) {
        constraints.push(
          where('status', '==', 'active'),
          where('isDeleted', '==', false),
          where('nameSearch', '>=', prefix),
          where('nameSearch', '<=', prefix + PREFIX_END),
          orderBy('nameSearch', 'asc'),
        );
      } else {
        constraints.push(
          where('status', '==', 'active'),
          where('isDeleted', '==', false),
          orderBy('bagsCount', 'desc'),
        );
      }
      return query(refs.storeItems(), ...constraints);
    },
    map: (snap) => parseDoc(normalizeStoreItem, snap),
    filter: (item) => !item.isDeleted && (opts.staff || opts.supplierId ? true : item.status === 'active'),
  });
}

export function usePopularItems(count: number) {
  const n = Math.max(0, Math.floor(count));
  return usePaginatedQuery<StoreItem>({
    // Home renders one StoreSection per key but still calls all three hooks; skip when unused.
    key: n > 0 ? `popularItems:${n}` : null,
    build: () =>
      query(
        refs.storeItems(),
        where('status', '==', 'active'),
        where('isDeleted', '==', false),
        orderBy('bagsCount', 'desc'),
        limit(n),
      ),
    map: (snap) => parseDoc(normalizeStoreItem, snap),
    pageSize: n || 1,
  });
}

export function usePopularSuppliers(count: number) {
  const n = Math.max(0, Math.floor(count));
  return usePaginatedQuery<SupplierProfile>({
    key: n > 0 ? `popularSuppliers:${n}` : null,
    build: () =>
      query(
        refs.suppliers(),
        where('status', '==', 'active'),
        where('isDeleted', '==', false),
        orderBy('ratingCount', 'desc'),
        limit(n),
      ),
    map: (snap) => parseDoc(normalizeSupplierProfile, snap),
    pageSize: n || 1,
  });
}

export function useTopBags(count: number) {
  const n = Math.max(0, Math.floor(count));
  return usePaginatedQuery({
    key: n > 0 ? `topBags:${n}` : null,
    build: () =>
      query(
        refs.bags(),
        where('isPublic', '==', true),
        where('isDeleted', '==', false),
        orderBy('donationsCount', 'desc'),
        limit(n),
      ),
    map: (snap) => parseDoc(normalizeBag, snap),
    pageSize: n || 1,
  });
}

export function useSupplierProfile(sid: string | null) {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  useEffect(() => {
    if (!sid) return;
    return onSnapshot(
      refs.supplier(sid),
      (snap) => {
        if (!snap?.exists()) {
          setProfile(null);
          setStatus('missing');
          return;
        }
        setProfile(normalizeSupplierProfile(snap.id, snap.data() ?? {}));
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  }, [sid]);
  // Wait for auth/route id — do not flash "missing" before sid is known.
  if (!sid) return { profile: null, status: 'loading' as const };
  return { profile, status };
}

export function useSupplierReviews(sid: string | null) {
  return usePaginatedQuery({
    key: sid ? `reviews:${sid}` : null,
    build: () => query(refs.supplierReviews(sid!), orderBy('createdAt', 'desc')),
    map: (snap) => parseDoc(normalizeReview, snap),
    filter: (r) => !r.isHidden,
  });
}

export function useStoreItem(id: string | null) {
  const [item, setItem] = useState<StoreItem | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      refs.storeItem(id),
      (snap) => {
        if (!snap?.exists()) {
          setItem(null);
          setStatus('missing');
          return;
        }
        setItem(normalizeStoreItem(snap.id, snap.data() ?? {}));
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  }, [id]);
  if (!id) return { item: null, status: 'missing' as const };
  return { item, status };
}

export function useStoreConfig() {
  const [config, setConfig] = useState<StoreConfig>(STORE_CONFIG_DEFAULTS);
  useEffect(() => {
    return onSnapshot(refs.appConfig('store'), (snap) => {
      setConfig(normalizeStoreConfig(snap?.exists() ? snap.data() ?? {} : null));
    });
  }, []);
  return config;
}

export function useBag(bagId: string | null) {
  const [bag, setBag] = useState<ReturnType<typeof normalizeBag> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  useEffect(() => {
    if (!bagId) return;
    return onSnapshot(
      refs.bag(bagId),
      (snap) => {
        if (!snap?.exists()) {
          setBag(null);
          setStatus('missing');
          return;
        }
        setBag(normalizeBag(snap.id, snap.data() ?? {}));
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  }, [bagId]);
  if (!bagId) return { bag: null, status: 'missing' as const };
  return { bag, status };
}

export function useBagItems(bagId: string | null) {
  return usePaginatedQuery({
    key: bagId ? `bagItems:${bagId}` : null,
    build: () => query(refs.bagItems(bagId!)),
    map: (snap) => parseDoc(normalizeBagItem, snap),
    pageSize: 100,
  });
}

export function useBagChanges(bagId: string | null) {
  return usePaginatedQuery({
    key: bagId ? `bagChanges:${bagId}` : null,
    build: () => query(refs.bagChanges(bagId!), orderBy('createdAt', 'desc')),
    map: (snap) => parseDoc(normalizeBagChange, snap),
    pageSize: 40,
  });
}

export function useBagParticipant(bagId: string | null, uid: string | null) {
  const [participant, setParticipant] = useState<ReturnType<typeof normalizeParticipant> | null>(null);
  useEffect(() => {
    if (!bagId || !uid) return;
    return onSnapshot(refs.bagParticipant(bagId, uid), (snap) => {
      setParticipant(snap?.exists() ? normalizeParticipant(snap.id, snap.data() ?? {}) : null);
    });
  }, [bagId, uid]);
  if (!bagId || !uid) return null;
  return participant;
}

export function useMyBags(uid: string | null) {
  return usePaginatedQuery({
    key: uid ? `myBags:${uid}` : null,
    build: () =>
      query(refs.bags(), where('creatorId', '==', uid!), where('isDeleted', '==', false), orderBy('updatedAt', 'desc')),
    map: (snap) => parseDoc(normalizeBag, snap),
  });
}

export function useBagLink(token: string | null) {
  const [bagId, setBagId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing' | 'inactive'>('loading');
  useEffect(() => {
    if (!token) return;
    return onSnapshot(
      refs.bagLink(token),
      (snap) => {
        if (!snap?.exists()) {
          setBagId(null);
          setStatus('missing');
          return;
        }
        const data = snap.data() ?? {};
        if (data.isActive !== true) {
          setBagId(null);
          setStatus('inactive');
          return;
        }
        setBagId(typeof data.bagId === 'string' ? data.bagId : null);
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  }, [token]);
  if (!token) return { bagId: null, status: 'missing' as const };
  return { bagId, status };
}

export function useCategoryTree(categories: StoreCategory[] | null | undefined) {
  return useMemo(() => {
    const list = categories ?? [];
    const roots = list.filter((c) => c.level === 1 && c.isActive).sort((a, b) => a.order - b.order);
    const children = (parentId: string) =>
      list.filter((c) => c.parentId === parentId && c.isActive).sort((a, b) => a.order - b.order);
    return { roots, children };
  }, [categories]);
}
