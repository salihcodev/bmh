import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WorkspaceRole } from '@/domain/types';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';
import { WORKSPACE_ADMIN_ROLE, WORKSPACE_MEMBER_ROLE } from '@/services/permissions/catalog';

/** Built-in roles are shown in the reader's language; custom roles by the name their creator gave. */
export function roleLabel(t: TFunction, roleId: string, role?: Pick<WorkspaceRole, 'name'> | null): string {
  if (roleId === WORKSPACE_ADMIN_ROLE) return t('workspace.role.admin');
  if (roleId === WORKSPACE_MEMBER_ROLE) return t('workspace.role.member');
  return role?.name || t('workspace.role.custom');
}

const BUILT_IN_ORDER: Record<string, number> = { [WORKSPACE_ADMIN_ROLE]: 0, [WORKSPACE_MEMBER_ROLE]: 2 };

/** Admin first, custom roles next, member last. */
export function roleRank(roleId: string): number {
  return BUILT_IN_ORDER[roleId] ?? 1;
}

type State = { wid: string; roles: WorkspaceRole[] | null; error: boolean };

/** Live, non-deleted roles of a workspace (a small bounded set, one listener). */
export function useWorkspaceRoles(wid: string) {
  const [state, setState] = useState<State>({ wid: '', roles: null, error: false });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!wid) return;
    return onSnapshot(
      refs.roles(wid),
      (snapshot) => {
        const list: WorkspaceRole[] = [];
        snapshot.forEach((d) => {
          const role = { id: d.id, ...(d.data() as Omit<WorkspaceRole, 'id'>) };
          if (!role.isDeleted) list.push(role);
        });
        list.sort((a, b) => roleRank(a.id) - roleRank(b.id) || a.name.localeCompare(b.name));
        setState({ wid, roles: list, error: false });
      },
      () => setState({ wid, roles: null, error: true }),
    );
  }, [wid, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.wid === wid ? state : { roles: null, error: false };
  const byId = useMemo(() => new Map((current.roles ?? []).map((r) => [r.id, r])), [current.roles]);
  return { roles: current.roles, error: current.error, retry, byId };
}

export function isCreatorSeat(workspace: { ownerId: string } | null | undefined, memberId: string): boolean {
  return !!workspace && workspace.ownerId === memberId;
}
