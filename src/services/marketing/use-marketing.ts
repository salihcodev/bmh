import { limit, orderBy, query, where } from '@react-native-firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  bannerSchema,
  marketingCardSchema,
  newsSchema,
  parseDoc,
  platformStatsSchema,
  sortNews,
  supportConfigSchema,
  visibleBanners,
  type Banner,
  type MarketingCard,
  type NewsItem,
  type PlatformStats,
  type SupportConfig,
} from '@/domain/marketing';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useAuth } from '@/providers/auth-provider';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';

export type LiveState<T> = {
  data: T | null;
  status: 'loading' | 'ready' | 'error';
  error: Error | null;
  retry: () => void;
};

type Target = Parameters<typeof onSnapshot>[0];
type Snapshot = { exists?: boolean | (() => boolean); id?: string; data?: () => unknown; forEach?: (cb: (d: { id: string; data: () => unknown }) => void) => void };

/** One live listener (works offline from cache). `key` null disables it; change `key` to resubscribe. */
function useLive<T>(key: string | null, target: () => Target, read: (snap: Snapshot) => T): LiveState<T> {
  const [result, setResult] = useState<{ key: string | null; data: T | null; error: Error | null }>({ key: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!key) return;
    return (onSnapshot as (t: Target, next: (s: Snapshot) => void, fail: (e: Error) => void) => () => void)(
      target(),
      (snap) => setResult({ key, data: read(snap), error: null }),
      (error) => setResult({ key, data: null, error }),
    );
    // target/read are stable per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = result.key === key ? result : { data: null, error: null };
  return {
    data: current.data,
    error: current.error,
    status: current.error ? 'error' : current.data === null ? 'loading' : 'ready',
    retry,
  };
}

function docs<T>(snap: Snapshot, toItem: (id: string, data: unknown) => T): T[] {
  const list: T[] = [];
  snap.forEach?.((d) => list.push(toItem(d.id, d.data())));
  return list;
}

function exists(snap: Snapshot): boolean {
  return typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
}

const BANNER_LIMIT = 8;

/** Active banners in their schedule window. The query keys on the signed-in user so sign-out drops it. */
export function useBanners(): LiveState<Banner[]> {
  const { user } = useAuth();
  const live = useLive(
    user ? `banners:${user.uid}` : null,
    () => query(refs.banners(), where('isActive', '==', true), orderBy('order'), limit(BANNER_LIMIT)) as Target,
    (snap) => docs(snap, (id, data) => parseDoc(bannerSchema, id, data)),
  );
  const [now] = useState(() => Date.now());
  const data = useMemo(() => (live.data ? visibleBanners(live.data, now) : null), [live.data, now]);
  return { ...live, data };
}

export function useMarketingCards(): LiveState<MarketingCard[]> {
  const { user } = useAuth();
  return useLive(
    user ? `cards:${user.uid}` : null,
    () => query(refs.marketingCards(), where('isActive', '==', true), orderBy('order'), limit(12)) as Target,
    (snap) => docs(snap, (id, data) => parseDoc(marketingCardSchema, id, data)),
  );
}

/** `data` is `{}`-normalized when the doc is missing, so the UI can hide zeros instead of erroring. */
export function usePlatformStats(): LiveState<(PlatformStats & { exists: boolean })> {
  const { user } = useAuth();
  return useLive(
    user ? `stats:${user.uid}` : null,
    () => refs.platformStats() as unknown as Target,
    (snap) => ({ ...platformStatsSchema.parse(exists(snap) ? (snap.data?.() ?? {}) : {}), exists: exists(snap) }),
  );
}

export function useSupportConfig(): LiveState<SupportConfig> {
  const { user } = useAuth();
  return useLive(
    user ? `support:${user.uid}` : null,
    () => refs.appConfig('support') as unknown as Target,
    (snap) => supportConfigSchema.parse(exists(snap) ? (snap.data?.() ?? {}) : {}),
  );
}

export function useNewsItem(id: string | undefined): LiveState<NewsItem | false> {
  const { user } = useAuth();
  return useLive<NewsItem | false>(
    user && id ? `news:${user.uid}:${id}` : null,
    () => refs.newsItem(id!) as unknown as Target,
    (snap) => {
      if (!exists(snap)) return false;
      const item = parseDoc(newsSchema, id!, snap.data?.());
      return item.isPublished ? item : false;
    },
  );
}

/** Published news, newest first. The `isPublished` filter is required by the rules. */
export function useNewsFeed(pageSize = 10) {
  const { user } = useAuth();
  return usePaginatedQuery<NewsItem>({
    key: user ? `news:${user.uid}:${pageSize}` : null,
    build: () => query(refs.news(), where('isPublished', '==', true), orderBy('publishedAt', 'desc')),
    map: (snap) => parseDoc(newsSchema, snap.id, snap.data()),
    pageSize,
  });
}

/** Home preview: the first page with pinned items floated up (a full list keeps server order so paging never reorders). */
export function useNewsPreview(count = 3) {
  const feed = useNewsFeed(count);
  const items = useMemo(() => sortNews(feed.items ?? []).slice(0, count), [feed.items, count]);
  return { ...feed, items };
}
