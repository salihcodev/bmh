import { collectionGroup, query, where } from '@react-native-firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Member, Workspace } from '@/domain/types';
import { pickActiveWorkspace } from '@/domain/workspace';
import { db } from '@/services/firebase/client';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs, type Actor } from '@/services/firebase/refs';
import { can, type MemberLike } from '@/services/permissions/can';
import type { Permission } from '@/services/permissions/matrix';
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
  actor: (Actor & { email: string }) | null;
  switchWorkspace: (workspaceId: string) => void;
};

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
    const unsubscribers = ids.map((wid) =>
      onSnapshot(
        refs.workspace(wid),
        (snapshot) => {
          if (!snapshot?.exists()) return;
          setWorkspaces((current) => ({
            ...current,
            [wid]: { id: wid, ...(snapshot.data() as Omit<Workspace, 'id'>) },
          }));
        },
        () => undefined,
      ),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [uid, workspaceIds]);

  // Only workspaces with a current membership are exposed (a left workspace's doc may linger in state).
  const visibleWorkspaces = useMemo(
    () => Object.fromEntries(memberships.map((m) => [m.workspaceId, workspaces[m.workspaceId]])),
    [memberships, workspaces],
  );

  const current = uid ? pickActiveWorkspace(memberships, devicePreference, profile?.lastWorkspaceId) : null;

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      if (!uid || !memberships.some((m) => m.workspaceId === workspaceId)) return;
      appStorage.set(userKey(uid, LAST_WORKSPACE), workspaceId);
      setDevicePreference(workspaceId);
      setLastWorkspace(uid, workspaceId);
    },
    [uid, memberships],
  );

  const name = profile?.displayName || user?.displayName || user?.email || '';
  const email = (profile?.email || user?.email || '').toLowerCase();

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading: !!uid && !loaded,
      fromCache,
      memberships: uid ? memberships : [],
      workspaces: uid ? visibleWorkspaces : {},
      workspaceId: current?.workspaceId ?? null,
      workspace: current ? (visibleWorkspaces[current.workspaceId] ?? null) : null,
      member: current?.member ?? null,
      actor: uid ? { uid, name, email } : null,
      switchWorkspace,
    }),
    [uid, loaded, fromCache, memberships, visibleWorkspaces, current, name, email, switchWorkspace],
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

export function useCan(permission: Permission): boolean {
  const { member } = useWorkspace();
  return can(member as MemberLike | null, permission);
}
