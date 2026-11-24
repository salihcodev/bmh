import { collectionGroup, query, where } from '@react-native-firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Member, Workspace, WorkspaceRole } from '@/domain/types';
import { pickActiveWorkspace } from '@/domain/workspace';
import { db } from '@/services/firebase/client';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs, type Actor } from '@/services/firebase/refs';
import { canWorkspace } from '@/services/permissions/can';
import { WORKSPACE_ADMIN_ROLE, type WorkspacePermission } from '@/services/permissions/catalog';
import { appStorage } from '@/services/storage/mmkv';
import { userKey } from '@/services/storage/user-scope';
import { setLastWorkspace } from '@/services/workspaces/api';

import { useAuth } from './auth-provider';

export type Membership = { workspaceId: string; member: Member };

type WorkspaceContextValue = {
  /** True until the first membership snapshot (cache or server) arrives. */
  loading: boolean;
  /** True when the membership list came only from the device cache. */
  fromCache: boolean;
  memberships: Membership[];
  workspaces: Record<string, Workspace | undefined>;
  /** Set only when a membership doc for the current user exists for it. */
  workspaceId: string | null;
  workspace: Workspace | null;
  member: Member | null;
  /** The member's role doc. Null for admins (they hold every key) and while it loads. */
  role: WorkspaceRole | null;
  /** True until the member's role doc has loaded (always false for admins). */
  roleLoading: boolean;
  actor: (Actor & { email: string }) | null;
  /**
   * Makes `workspaceId` active. Works right after create/join, before the membership snapshot
   * arrives; `known.name` (from the form or the invite) is shown until the workspace doc loads.
   */
  switchWorkspace: (workspaceId: string, known?: { name?: string }) => void;
  /** The workspace name, or null while it is still loading. */
  nameOf: (workspaceId: string) => string | null;
};

const RETRY_BASE_MS = 1000;
const RETRY_MAX_ATTEMPTS = 6;

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const LAST_WORKSPACE = 'lastWorkspaceId';

/** Mount with `key={uid}` so every piece of state starts empty for a new account. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? null;
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, Workspace | undefined>>({});
  const [loaded, setLoaded] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [devicePreference, setDevicePreference] = useState<string | null>(() =>
    uid ? (appStorage.getString(userKey(uid, LAST_WORKSPACE)) ?? null) : null,
  );
  const [knownNames, setKnownNames] = useState<Record<string, string>>({});
  const confirmed = useRef(new Set<string>());

  useEffect(() => {
    if (!uid) return;
    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', uid));
    return onSnapshot(
      membersQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const next: Membership[] = [];
        snapshot.forEach((docSnap) => {
          const workspaceId = docSnap.ref.parent.parent?.id;
          const data = docSnap.data() as Omit<Member, 'id'>;
          // Defense in depth: the cache does not evaluate rules, so re-check ownership here.
          if (!workspaceId || data.userId !== uid || data.status !== 'active') return;
          // A just-written membership (join/create batch) is not on the server yet: listeners opened
          // on it would be denied by the rules and closed for good. Wait for the confirmed snapshot.
          // Memberships confirmed before stay visible during later offline edits (profile echo).
          if (docSnap.metadata.hasPendingWrites && !confirmed.current.has(workspaceId)) return;
          confirmed.current.add(workspaceId);
          next.push({ workspaceId, member: { id: docSnap.id, ...data } });
        });
        setMemberships(next);
        setFromCache(snapshot.metadata.fromCache);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [uid]);

  const workspaceIds = useMemo(() => memberships.map((m) => m.workspaceId).sort().join('|'), [memberships]);

  useEffect(() => {
    if (!uid || !workspaceIds) return;
    const ids = workspaceIds.split('|');
    let stopped = false;
    const stops = ids.map((wid) => {
      let unsubscribe: (() => void) | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      // A failed listener is closed by Firestore, so it is opened again with backoff.
      const subscribe = (attempt: number) => {
        unsubscribe = onSnapshot(
          refs.workspace(wid),
          (snapshot) => {
            if (!snapshot?.exists()) return;
            setWorkspaces((current) => ({
              ...current,
              [wid]: { id: wid, ...(snapshot.data() as Omit<Workspace, 'id'>) },
            }));
          },
          (error) => {
            if (__DEV__) console.warn(`[workspace] listener for ${wid} failed (attempt ${attempt + 1})`, error);
            if (stopped || attempt + 1 >= RETRY_MAX_ATTEMPTS) return;
            timer = setTimeout(() => subscribe(attempt + 1), RETRY_BASE_MS * 2 ** attempt);
          },
        );
      };
      subscribe(0);
      return () => {
        if (timer) clearTimeout(timer);
        unsubscribe?.();
      };
    });
    return () => {
      stopped = true;
      stops.forEach((stop) => stop());
    };
  }, [uid, workspaceIds]);

  // A soft-deleted workspace disappears for its members.
  const liveMemberships = useMemo(
    () => memberships.filter((m) => !workspaces[m.workspaceId]?.isDeleted),
    [memberships, workspaces],
  );

  // Only workspaces with a current membership are exposed (a left workspace's doc may linger in state).
  const visibleWorkspaces = useMemo(
    () => Object.fromEntries(liveMemberships.map((m) => [m.workspaceId, workspaces[m.workspaceId]])),
    [liveMemberships, workspaces],
  );

  const current = uid ? pickActiveWorkspace(liveMemberships, devicePreference, profile?.lastWorkspaceId) : null;

  const roleKey =
    current && current.member.roleId !== WORKSPACE_ADMIN_ROLE ? `${current.workspaceId}/${current.member.roleId}` : null;
  const [roleState, setRoleState] = useState<{ key: string; role: WorkspaceRole | null } | null>(null);

  useEffect(() => {
    if (!roleKey) return;
    const [wid = '', roleId = ''] = roleKey.split('/');
    return onSnapshot(
      refs.role(wid, roleId),
      (snapshot) => {
        const role = snapshot?.exists() ? ({ id: roleId, ...snapshot.data() } as WorkspaceRole) : null;
        setRoleState({ key: roleKey, role });
      },
      () => setRoleState({ key: roleKey, role: null }),
    );
  }, [roleKey]);

  const role = roleKey && roleState?.key === roleKey ? roleState.role : null;
  const roleLoading = !!roleKey && roleState?.key !== roleKey;

  // No membership check here: pickActiveWorkspace ignores an id without a membership, so a choice
  // made right after join/create takes effect as soon as the confirmed membership arrives.
  const switchWorkspace = useCallback(
    (workspaceId: string, known?: { name?: string }) => {
      if (!uid) return;
      const name = known?.name?.trim();
      if (name) setKnownNames((current) => ({ ...current, [workspaceId]: name }));
      appStorage.set(userKey(uid, LAST_WORKSPACE), workspaceId);
      setDevicePreference(workspaceId);
      setLastWorkspace(uid, workspaceId);
    },
    [uid],
  );

  const nameOf = useCallback(
    (workspaceId: string) => visibleWorkspaces[workspaceId]?.name || knownNames[workspaceId] || null,
    [visibleWorkspaces, knownNames],
  );

  const name = profile?.displayName || user?.displayName || user?.email || '';
  const email = (profile?.email || user?.email || '').toLowerCase();

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading: !!uid && !loaded,
      fromCache,
      memberships: uid ? liveMemberships : [],
      workspaces: uid ? visibleWorkspaces : {},
      workspaceId: current?.workspaceId ?? null,
      workspace: current ? (visibleWorkspaces[current.workspaceId] ?? null) : null,
      member: current?.member ?? null,
      role,
      roleLoading,
      actor: uid ? { uid, name, email } : null,
      switchWorkspace,
      nameOf,
    }),
    [
      uid,
      loaded,
      fromCache,
      liveMemberships,
      visibleWorkspaces,
      current,
      role,
      roleLoading,
      name,
      email,
      switchWorkspace,
      nameOf,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}

/**
 * For screens inside the workspace gate only. Throws instead of falling back to an
 * empty id, so a screen can never query without a verified membership.
 */
export function useActiveWorkspace() {
  const { workspaceId, workspace, member, actor } = useWorkspace();
  if (!workspaceId || !member || !actor) {
    throw new Error('useActiveWorkspace used outside the workspace gate');
  }
  return { wid: workspaceId, workspace, member, actor };
}

/** Workspace permission of the signed-in member in the active workspace (mirrors hasPerm in rules). */
export function usePermission(permission: WorkspacePermission): boolean {
  const { member, role } = useWorkspace();
  return canWorkspace(member, role, permission);
}

/** True only when the member holds every one of `permissions`. */
export function usePermissions(...permissions: WorkspacePermission[]): boolean {
  const { member, role } = useWorkspace();
  return permissions.every((key) => canWorkspace(member, role, key));
}

/** Every key the active member holds; used by role editors to prevent escalation. */
export function useWorkspaceKeys(all: readonly WorkspacePermission[]): WorkspacePermission[] {
  const { member, role } = useWorkspace();
  return useMemo(() => all.filter((key) => canWorkspace(member, role, key)), [all, member, role]);
}
