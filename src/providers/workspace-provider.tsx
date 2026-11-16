import {
  collectionGroup,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Member, Workspace } from '@/domain/types';
import { pickActiveWorkspace } from '@/domain/workspace';
import { db } from '@/services/firebase/client';
import { refs, type Actor } from '@/services/firebase/refs';
import { can, type MemberLike } from '@/services/permissions/can';
import type { Permission } from '@/services/permissions/matrix';
import { setLastWorkspace } from '@/services/workspaces/api';
import { usePreferences } from '@/store/preferences';

import { useAuth } from './auth-provider';

export type Membership = { workspaceId: string; member: Member };

type WorkspaceContextValue = {
  /** True until the first membership snapshot (cache or server) arrives. */
  loading: boolean;
  /** True when the membership list came only from the device cache. */
  fromCache: boolean;
  memberships: Membership[];
  workspaces: Record<string, Workspace | undefined>;
  workspaceId: string | null;
  workspace: Workspace | null;
  member: Member | null;
  actor: (Actor & { email: string }) | null;
  switchWorkspace: (workspaceId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const lastWorkspaceId = usePreferences((state) => state.lastWorkspaceId);
  const setLastWorkspaceId = usePreferences((state) => state.setLastWorkspaceId);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, Workspace | undefined>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const uid = user?.uid ?? null;

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
          if (!workspaceId || data.status !== 'active') return;
          next.push({ workspaceId, member: { id: docSnap.id, ...data } });
        });
        setMemberships(next);
        setFromCache(snapshot.metadata.fromCache);
        setLoadedFor(uid);
      },
      () => setLoadedFor(uid),
    );
  }, [uid]);

  const workspaceIds = useMemo(() => memberships.map((m) => m.workspaceId).sort().join('|'), [memberships]);

  useEffect(() => {
    if (!workspaceIds) return;
    const unsubscribers = workspaceIds.split('|').map((wid) =>
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
  }, [workspaceIds]);

  const activeMemberships = useMemo(
    () => (uid && loadedFor === uid ? memberships : []),
    [uid, loadedFor, memberships],
  );
  const current = pickActiveWorkspace(activeMemberships, lastWorkspaceId, profile?.lastWorkspaceId);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      setLastWorkspaceId(workspaceId);
      if (uid) setLastWorkspace(uid, workspaceId);
    },
    [setLastWorkspaceId, uid],
  );

  const name = profile?.displayName || user?.displayName || user?.email || '';
  const email = (profile?.email || user?.email || '').toLowerCase();

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading: !!uid && loadedFor !== uid,
      fromCache,
      memberships: activeMemberships,
      workspaces,
      workspaceId: current?.workspaceId ?? null,
      workspace: current ? (workspaces[current.workspaceId] ?? null) : null,
      member: current?.member ?? null,
      actor: uid ? { uid, name, email } : null,
      switchWorkspace,
    }),
    [uid, loadedFor, fromCache, activeMemberships, workspaces, current, name, email, switchWorkspace],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}

/** Workspace screens render only after the (app) layout guarantees these exist. */
export function useActiveWorkspace() {
  const { workspaceId, workspace, member, actor } = useWorkspace();
  return {
    wid: workspaceId ?? '',
    workspace,
    member,
    actor: actor ?? { uid: '', name: '', email: '' },
  };
}

export function useCan(permission: Permission): boolean {
  const { member } = useWorkspace();
  return can(member as MemberLike | null, permission);
}
