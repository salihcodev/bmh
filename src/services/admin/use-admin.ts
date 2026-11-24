import { getCountFromServer, orderBy, query, Timestamp, where, type QueryConstraint } from '@react-native-firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { normalizeAuditEntry, serverFilter, type AuditEntry, type AuditFilters } from '@/domain/audit-log';
import type { UserQueryMode } from '@/domain/dashboard';
import { bannerSchema, newsSchema, parseDoc, type Banner, type NewsItem } from '@/domain/marketing';
import { normalizeSupportMethod, type SupportMethod } from '@/domain/support-method';
import { normalizeSystemMessage, type SystemMessage } from '@/domain/system-message';
import { normalizeSupplierRequest, type SupplierRequest } from '@/domain/supplier';
import type { Workspace } from '@/domain/types';
import { normalizeProfile, type UserProfile } from '@/domain/user';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';
import { isMediaEntity, STAFF_UPLOAD_ENTITIES, type MediaEntity } from '@/services/media/groups';

// Staff reads. Every hook is keyed on the system key its query needs, so nothing is queried
// without it (the rules would deny it anyway).

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
  entity: MediaEntity;
  lang: 'ar' | 'en' | null;
  label: string;
  isDeleted: boolean;
  createdAt: number | null;
};

/**
 * The media library. Staff entities only (avatars are private to their owners and stay out of the
 * shared library). `removed` switches to the Removed view; removed files cannot be restored.
 */
export function useMediaAssets(entity: MediaEntity | null, removed = false, enabled = true) {
  const { can, user } = useCurrentUser();
  return usePaginatedQuery<MediaAsset>({
    key: enabled && can('media.view') && user ? `media:${user.uid}:${entity ?? 'all'}:${removed}` : null,
    build: () =>
      query(
        refs.media(),
        where('entityType', entity ? '==' : 'in', entity ?? [...STAFF_UPLOAD_ENTITIES]),
        where('isDeleted', '==', removed),
        orderBy('createdAt', 'desc'),
      ),
    map: (snap) => {
      const d = snap.data();
      return {
        id: snap.id,
        publicId: String(d.publicId ?? ''),
        width: Number(d.width ?? 0),
        height: Number(d.height ?? 0),
        bytes: Number(d.bytes ?? 0),
        format: String(d.format ?? ''),
        entity: isMediaEntity(d.entityType) ? d.entityType : 'other',
        lang: d.lang === 'ar' || d.lang === 'en' ? d.lang : null,
        label: String(d.label ?? ''),
        isDeleted: d.isDeleted === true,
        createdAt: toMillis(d.createdAt),
      };
    },
    pageSize: 24,
  });
}

/** Every banner, including hidden and scheduled ones. */
export function useAdminBanners() {
  const { can, user } = useCurrentUser();
  return usePaginatedQuery<Banner>({
    key: can('banners.view') && user ? `adminBanners:${user.uid}` : null,
    build: () => query(refs.banners(), orderBy('order')),
    map: (snap) => parseDoc(bannerSchema, snap.id, snap.data()),
    filter: (banner) => !banner.isDeleted,
  });
}

/** One staff-readable document, live. `false` when it does not exist, `null` while loading. */
function useStaffDoc<T>(id: string | null, allowed: boolean, ref: (id: string) => unknown, read: (id: string, data: unknown) => T) {
  const [state, setState] = useState<{ id: string | null; value: T | null | false; error: boolean }>({ id: null, value: null, error: false });
  useEffect(() => {
    if (!allowed || !id) return;
    return (onSnapshot as (target: unknown, next: (snap: { exists: () => boolean; data: () => unknown }) => void, fail: () => void) => () => void)(
      ref(id),
      (snap) => setState({ id, value: snap.exists() ? read(id, snap.data()) : false, error: false }),
      () => setState({ id, value: null, error: true }),
    );
    // ref/read are module-level functions per hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, allowed]);
  return state.id === id ? state : { id, value: null as T | null | false, error: false };
}

export function useAdminBanner(id: string | null) {
  const { can } = useCurrentUser();
  const state = useStaffDoc<Banner>(id, can('banners.view'), refs.banner, (docId, data) => parseDoc(bannerSchema, docId, data));
  return { id: state.id, banner: state.value, error: state.error };
}

/** Every post, drafts included, newest first. Deleted posts are hidden. */
export function useAdminNews() {
  const { can, user } = useCurrentUser();
  return usePaginatedQuery<NewsItem>({
    key: can('news.view') && user ? `adminNews:${user.uid}` : null,
    build: () => query(refs.news(), orderBy('createdAt', 'desc')),
    map: (snap) => parseDoc(newsSchema, snap.id, snap.data()),
    filter: (item) => !item.isDeleted,
  });
}

export function useAdminNewsItem(id: string | null) {
  const { can } = useCurrentUser();
  const state = useStaffDoc<NewsItem>(id, can('news.view'), refs.newsItem, (docId, data) => parseDoc(newsSchema, docId, data));
  return { id: state.id, item: state.value, error: state.error };
}

/** Every method, hidden ones included, in display order. Deleted methods are hidden. */
export function useAdminSupportMethods() {
  const { can, user } = useCurrentUser();
  return usePaginatedQuery<SupportMethod>({
    key: can('support-methods.view') && user ? `adminSupportMethods:${user.uid}` : null,
    build: () => query(refs.supportMethods(), orderBy('order')),
    map: (snap) => normalizeSupportMethod(snap.id, snap.data()),
    filter: (method) => !method.isDeleted,
    pageSize: 50,
  });
}

export function useAdminSupportMethod(id: string | null) {
  const { can } = useCurrentUser();
  const state = useStaffDoc<SupportMethod>(id, can('support-methods.view'), refs.supportMethod, normalizeSupportMethod);
  return { id: state.id, method: state.value, error: state.error };
}

export type MessageFamily = 'messages' | 'alerts' | 'info-texts';
export const MESSAGE_FAMILY: Record<SystemMessage['category'], MessageFamily> = {
  message: 'messages',
  alert: 'alerts',
  'info-text': 'info-texts',
};

/** System messages of one category (one query per category: each has its own view key in the rules). */
export function useAdminMessages(category: SystemMessage['category']) {
  const { can, user } = useCurrentUser();
  return usePaginatedQuery<SystemMessage>({
    key: can(`${MESSAGE_FAMILY[category]}.view`) && user ? `adminMessages:${user.uid}:${category}` : null,
    build: () => query(refs.systemMessages(), where('category', '==', category), orderBy('createdAt', 'desc')),
    map: (snap) => normalizeSystemMessage(snap.id, snap.data()),
    filter: (message) => !message.isDeleted,
  });
}

export function useAdminMessage(key: string | null) {
  const { can } = useCurrentUser();
  const anyView = can('messages.view') || can('alerts.view') || can('info-texts.view');
  const state = useStaffDoc<SystemMessage>(key, anyView, refs.systemMessage, normalizeSystemMessage);
  return { key: state.id, message: state.value, error: state.error };
}

function usersQuery(mode: UserQueryMode) {
  if (mode.kind === 'email') return query(refs.users(), where('email', '==', mode.email));
  if (mode.kind === 'status') return query(refs.users(), where('status', '==', mode.status));
  if (mode.kind === 'types') return query(refs.users(), where('userType', 'in', [...mode.values]));
  return query(refs.users());
}

export function useDashboardUsers(mode: UserQueryMode) {
  const { can, user } = useCurrentUser();
  const key = mode.kind === 'email' ? mode.email : mode.kind === 'status' ? mode.status : mode.kind === 'types' ? mode.values.join(',') : 'all';
  return usePaginatedQuery<UserProfile>({
    key: can('users.view') && user ? `dashUsers:${user.uid}:${key}` : null,
    build: () => usersQuery(mode),
    map: (snap) => normalizeProfile(snap.id, snap.data()),
    pageSize: 30,
  });
}

export type DashboardWorkspace = Workspace & { isArchived: boolean; isDeleted: boolean };

function mapWorkspace(id: string, data: Record<string, unknown>): DashboardWorkspace {
  return {
    id,
    name: String(data.name ?? ''),
    description: typeof data.description === 'string' ? data.description : null,
    ownerId: String(data.ownerId ?? ''),
    beneficiaryCount: Number(data.beneficiaryCount ?? 0),
    areaCount: Number(data.areaCount ?? 0),
    cityCount: Number(data.cityCount ?? 0),
    sessionCount: Number(data.sessionCount ?? 0),
    isArchived: data.isArchived === true,
    isDeleted: data.isDeleted === true,
  };
}

export function useDashboardUser(uid: string) {
  const { can } = useCurrentUser();
  const allowed = can('users.view') && !!uid;
  const [state, setState] = useState<{ id: string; user: UserProfile | null | false; error: boolean }>({
    id: '',
    user: null,
    error: false,
  });
  useEffect(() => {
    if (!allowed) return;
    return onSnapshot(
      refs.user(uid),
      (snap) => setState({ id: uid, user: snap.exists() ? normalizeProfile(uid, snap.data()) : false, error: false }),
      () => setState({ id: uid, user: null, error: true }),
    );
  }, [allowed, uid]);
  return state.id === uid ? state : { id: uid, user: null, error: false };
}

export function useDashboardWorkspaces() {
  const { can, user } = useCurrentUser();
  return usePaginatedQuery<DashboardWorkspace>({
    key: can('workspaces.view') && user ? `dashWorkspaces:${user.uid}` : null,
    build: () => query(refs.workspaces()),
    map: (snap) => mapWorkspace(snap.id, snap.data() as Record<string, unknown>),
    pageSize: 30,
  });
}

/** Supplier requests waiting for review, oldest first so nobody waits forever. */
export function useSupplierRequests() {
  const { can, user } = useCurrentUser();
  const allowed = can('suppliers.view') || can('suppliers.approve');
  return usePaginatedQuery<SupplierRequest>({
    key: allowed && user ? `supplierRequests:${user.uid}` : null,
    build: () => query(refs.supplierRequests(), where('status', '==', 'pending'), orderBy('createdAt', 'asc')),
    map: (snap) => normalizeSupplierRequest(snap.id, snap.data()),
    pageSize: 30,
  });
}

export type { AuditEntry } from '@/domain/audit-log';

/**
 * The admin log, newest first. One equality filter (actor, action or entity) and the date range run
 * in Firestore; the other filters and the search run on the loaded rows (see `matchesAuditFilters`).
 * `since` is fixed by the caller so the query key does not change every minute.
 */
export function useAdminAudit(filters: AuditFilters, since: number | null) {
  const { can, user } = useCurrentUser();
  const server = serverFilter(filters);
  const key = can('logs.view') && user ? `adminAudit:${user.uid}:${server ? `${server.field}=${server.value}` : 'all'}:${since ?? 'any'}` : null;
  return usePaginatedQuery<AuditEntry>({
    key,
    build: () => {
      const constraints: QueryConstraint[] = [];
      if (server) constraints.push(where(server.field, '==', server.value));
      if (since !== null) constraints.push(where('createdAt', '>=', Timestamp.fromMillis(since)));
      return query(refs.adminAuditLog(), ...constraints, orderBy('createdAt', 'desc'));
    },
    map: (snap) => normalizeAuditEntry(snap.id, snap.data(), toMillis),
    pageSize: 30,
    live: false,
  });
}

export type SyncHealthDevice = {
  id: string;
  uid: string;
  deviceId: string;
  platform: string;
  appVersion: string;
  pending: number;
  failed: number;
  oldestPendingAt: number | null;
  lastSyncAt: number | null;
  updatedAt: number | null;
};

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

/** Per-device queue summaries the clients write. Devices with failures first. */
export function useSyncHealth() {
  const { can, user } = useCurrentUser();
  return usePaginatedQuery<SyncHealthDevice>({
    key: can('sync-queue.view') && user ? `syncHealth:${user.uid}` : null,
    build: () => query(refs.syncHealthList(), orderBy('failed', 'desc'), orderBy('updatedAt', 'desc')),
    map: (snap) => {
      const d = snap.data();
      return {
        id: snap.id,
        uid: String(d.uid ?? ''),
        deviceId: String(d.deviceId ?? ''),
        platform: String(d.platform ?? ''),
        appVersion: String(d.appVersion ?? ''),
        pending: count(d.pending),
        failed: count(d.failed),
        oldestPendingAt: toMillis(d.oldestPendingAt) ?? (typeof d.oldestPendingAt === 'number' ? d.oldestPendingAt : null),
        lastSyncAt: toMillis(d.lastSyncAt) ?? (typeof d.lastSyncAt === 'number' ? d.lastSyncAt : null),
        updatedAt: toMillis(d.updatedAt),
      };
    },
    pageSize: 50,
    live: false,
  });
}

/** A count is null when the viewer lacks the key its query needs. */
export type PlatformCounts = {
  users: number | null;
  suspended: number | null;
  workspaces: number | null;
  banners: number | null;
  activeBanners: number | null;
  media: number | null;
};

/** Server-side count aggregations (one read per 1000 docs). Online only. */
export function usePlatformCounts() {
  const { can, hasDashboard } = useCurrentUser();
  const canUsers = can('users.view');
  const canWorkspaces = can('workspaces.view');
  const canMedia = can('media.view');
  const [state, setState] = useState<{ data: PlatformCounts | null; error: boolean; loading: boolean }>({
    data: null,
    error: false,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!hasDashboard) return;
    let cancelled = false;
    const count = (allowed: boolean, q: Parameters<typeof getCountFromServer>[0]) =>
      allowed ? getCountFromServer(q).then((s) => s.data().count) : Promise.resolve(null);
    Promise.all([
      count(canUsers, refs.users()),
      count(canUsers, query(refs.users(), where('status', '==', 'suspended'))),
      count(canWorkspaces, refs.workspaces()),
      count(true, refs.banners()),
      count(true, query(refs.banners(), where('isActive', '==', true))),
      count(canMedia, query(refs.media(), where('entityType', 'in', [...STAFF_UPLOAD_ENTITIES]), where('isDeleted', '==', false))),
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
  }, [hasDashboard, canUsers, canWorkspaces, canMedia, nonce]);
  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: false }));
    setNonce((n) => n + 1);
  }, []);
  return { ...state, retry };
}

export type NamedPermissionDoc = {
  id: string;
  name: { ar: string; en: string };
  permissions: string[];
  isLocked: boolean;
  isDeleted: boolean;
  scope?: 'system' | 'workspace';
};

function mapNamed(id: string, data: Record<string, unknown>): NamedPermissionDoc {
  const name = data.name as { ar?: string; en?: string } | string | undefined;
  const bilingual =
    name && typeof name === 'object'
      ? { ar: String(name.ar ?? ''), en: String(name.en ?? '') }
      : { ar: String(name ?? ''), en: String(name ?? '') };
  const scope = data.scope === 'workspace' || data.scope === 'system' ? data.scope : undefined;
  return {
    id,
    name: bilingual,
    permissions: Array.isArray(data.permissions) ? data.permissions.filter((key) => typeof key === 'string') : [],
    isLocked: data.isLocked === true,
    isDeleted: data.isDeleted === true,
    scope,
  };
}

function useNamedCollection(allowed: boolean, kind: 'roles' | 'presets') {
  const [state, setState] = useState<{ kind: string; items: NamedPermissionDoc[] | null; error: boolean }>({
    kind: '',
    items: null,
    error: false,
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    const target = kind === 'roles' ? refs.systemRoles() : refs.permissionPresets();
    return onSnapshot(
      target,
      (snapshot) => {
        const items: NamedPermissionDoc[] = [];
        snapshot.forEach((docSnap) => {
          const item = mapNamed(docSnap.id, docSnap.data() as Record<string, unknown>);
          if (!item.isDeleted) items.push(item);
        });
        items.sort((a, b) => a.name.en.localeCompare(b.name.en));
        setState({ kind, items, error: false });
      },
      () => setState({ kind, items: null, error: true }),
    );
  }, [allowed, kind, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.kind === kind ? state : { items: null, error: false };
  const byId = useMemo(() => new Map((current.items ?? []).map((item) => [item.id, item])), [current.items]);
  return { items: current.items, error: current.error, retry, byId };
}

export function useSystemRoleList() {
  const { can, user } = useCurrentUser();
  return useNamedCollection(can('roles.view') && !!user, 'roles');
}

export function usePresetList() {
  const { can, user } = useCurrentUser();
  return useNamedCollection(can('presets.view') && !!user, 'presets');
}

export function useDashboardWorkspace(wid: string) {
  const { can } = useCurrentUser();
  const allowed = can('workspaces.view') && !!wid;
  const [state, setState] = useState<{ id: string; workspace: DashboardWorkspace | null | false; error: boolean }>({
    id: '',
    workspace: null,
    error: false,
  });
  useEffect(() => {
    if (!allowed) return;
    return onSnapshot(
      refs.workspace(wid),
      (snap) =>
        setState({
          id: wid,
          workspace: snap.exists() ? mapWorkspace(wid, snap.data() as Record<string, unknown>) : false,
          error: false,
        }),
      () => setState({ id: wid, workspace: null, error: true }),
    );
  }, [allowed, wid]);
  return state.id === wid ? state : { id: wid, workspace: null, error: false };
}

export type RecordRow = { id: string; title: string; subtitle: string; deleted?: boolean };

export function useWorkspaceBeneficiaries(wid: string, allowed: boolean) {
  return usePaginatedQuery<RecordRow>({
    key: allowed && wid ? `dashBen:${wid}` : null,
    build: () => query(refs.beneficiaries(wid), where('isArchived', '==', false), orderBy('nameSearch')),
    map: (snap) => {
      const data = snap.data();
      return {
        id: snap.id,
        title: String(data.fullName ?? ''),
        subtitle: String(data.areaName ?? data.cityName ?? ''),
      };
    },
  });
}

export function useWorkspaceSessions(wid: string, allowed: boolean) {
  return usePaginatedQuery<RecordRow>({
    key: allowed && wid ? `dashSessions:${wid}` : null,
    build: () => query(refs.sessions(wid), orderBy('createdAt', 'desc')),
    map: (snap) => {
      const data = snap.data();
      const status = String(data.status ?? '');
      return { id: snap.id, title: String(data.name || status), subtitle: status, deleted: data.isDeleted === true };
    },
    filter: (item) => !item.deleted,
  });
}
