import { getCountFromServer, orderBy, query, where } from '@react-native-firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { bannerSchema, parseDoc, type Banner } from '@/domain/marketing';
import { normalizeProfile, type UserProfile } from '@/domain/user';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';
import type { MediaKind } from '@/services/media/upload-rules';

// Super admin reads. Every hook is keyed on isSuperAdmin, so nothing is queried for other users
// (the rules would deny it anyway).

function toMillis(value: unknown): number | null {
  const v = value as { toMillis?: () => number } | null;
  return typeof v?.toMillis === 'function' ? v.toMillis() : null;
}

export type MediaAsset = {
  id: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  kind: MediaKind;
  lang: 'ar' | 'en' | null;
  label: string;
  isArchived: boolean;
  createdAt: number | null;
};

export function useMediaAssets(kind: MediaKind | null, archived = false) {
  const { isSuperAdmin, user } = useCurrentUser();
  return usePaginatedQuery<MediaAsset>({
    key: isSuperAdmin && user ? `media:${user.uid}:${kind ?? 'all'}:${archived}` : null,
    build: () =>
      kind
        ? query(refs.mediaAssets(), where('kind', '==', kind), where('isArchived', '==', archived), orderBy('createdAt', 'desc'))
        : query(refs.mediaAssets(), where('isArchived', '==', archived), orderBy('createdAt', 'desc')),
    map: (snap) => {
      const d = snap.data();
      return {
        id: snap.id,
        publicId: String(d.publicId ?? ''),
        width: Number(d.width ?? 0),
        height: Number(d.height ?? 0),
        bytes: Number(d.bytes ?? 0),
        format: String(d.format ?? ''),
        kind: (d.kind as MediaKind) ?? 'other',
        lang: d.lang === 'ar' || d.lang === 'en' ? d.lang : null,
        label: String(d.label ?? ''),
        isArchived: d.isArchived === true,
        createdAt: toMillis(d.createdAt),
      };
    },
    pageSize: 24,
  });
}

/** Every banner, including hidden and scheduled ones. */
export function useAdminBanners() {
  const { isSuperAdmin, user } = useCurrentUser();
  return usePaginatedQuery<Banner>({
    key: isSuperAdmin && user ? `adminBanners:${user.uid}` : null,
    build: () => query(refs.banners(), orderBy('order')),
    map: (snap) => parseDoc(bannerSchema, snap.id, snap.data()),
  });
}

export function useAdminBanner(id: string | null) {
  const { isSuperAdmin } = useCurrentUser();
  const [state, setState] = useState<{ id: string | null; banner: Banner | null | false; error: boolean }>({
    id: null,
    banner: null,
    error: false,
  });
  useEffect(() => {
    if (!isSuperAdmin || !id) return;
    return onSnapshot(
      refs.banner(id),
      (snap) => setState({ id, banner: snap.exists() ? parseDoc(bannerSchema, id, snap.data()) : false, error: false }),
      () => setState({ id, banner: null, error: true }),
    );
  }, [id, isSuperAdmin]);
  return state.id === id ? state : { id, banner: null, error: false };
}

export function useAdminUsers(status: 'all' | 'suspended') {
  const { isSuperAdmin, user } = useCurrentUser();
  return usePaginatedQuery<UserProfile>({
    key: isSuperAdmin && user ? `adminUsers:${user.uid}:${status}` : null,
    // Document-id order: every profile has one, unlike createdAt on legacy docs.
    build: () => (status === 'suspended' ? query(refs.users(), where('status', '==', 'suspended')) : query(refs.users())),
    map: (snap) => normalizeProfile(snap.id, snap.data()),
    pageSize: 30,
  });
}

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorId: string;
  actorName: string;
  createdAt: number | null;
};

export function useAdminAudit() {
  const { isSuperAdmin, user } = useCurrentUser();
  return usePaginatedQuery<AuditEntry>({
    key: isSuperAdmin && user ? `adminAudit:${user.uid}` : null,
    build: () => query(refs.adminAuditLog(), orderBy('createdAt', 'desc')),
    map: (snap) => {
      const d = snap.data();
      return {
        id: snap.id,
        action: String(d.action ?? ''),
        targetType: String(d.targetType ?? ''),
        targetId: String(d.targetId ?? ''),
        actorId: String(d.actorId ?? ''),
        actorName: String(d.actorName ?? ''),
        createdAt: toMillis(d.createdAt),
      };
    },
    live: false,
  });
}

export type PlatformCounts = {
  users: number;
  suspended: number;
  workspaces: number;
  banners: number;
  activeBanners: number;
  media: number;
};

/** Server-side count aggregations (one read per 1000 docs). Online only. */
export function usePlatformCounts() {
  const { isSuperAdmin } = useCurrentUser();
  const [state, setState] = useState<{ data: PlatformCounts | null; error: boolean; loading: boolean }>({
    data: null,
    error: false,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    const count = (q: Parameters<typeof getCountFromServer>[0]) => getCountFromServer(q).then((s) => s.data().count);
    Promise.all([
      count(refs.users()),
      count(query(refs.users(), where('status', '==', 'suspended'))),
      count(refs.workspaces()),
      count(refs.banners()),
      count(query(refs.banners(), where('isActive', '==', true))),
      count(query(refs.mediaAssets(), where('isArchived', '==', false))),
    ])
      .then(([users, suspended, workspaces, banners, activeBanners, media]) => {
        if (!cancelled) setState({ data: { users, suspended, workspaces, banners, activeBanners, media }, error: false, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, error: true, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, nonce]);
  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: false }));
    setNonce((n) => n + 1);
  }, []);
  return { ...state, retry };
}
