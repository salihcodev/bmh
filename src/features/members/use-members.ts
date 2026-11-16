import { query, where } from '@react-native-firebase/firestore';
import { onSnapshot } from '@/services/firebase/listeners';
import { useCallback, useEffect, useState } from 'react';

import type { Invite, Member } from '@/domain/types';
import { refs } from '@/services/firebase/refs';

// Members and invites are small bounded sets (tens) shown in role order, so each is one live
// listener rather than a paged query (docs/product-flows.md). State is keyed on the workspace
// so a switch never shows the previous workspace's people.

type Keyed<T> = { wid: string; data: T | null; error: boolean };

export function useMemberList(wid: string) {
  const [state, setState] = useState<Keyed<Member[]>>({ wid: '', data: null, error: false });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!wid) return;
    return onSnapshot(
      refs.members(wid),
      (snapshot) => {
        const list: Member[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<Member, 'id'>) });
        });
        const rank = { owner: 0, admin: 1, member: 2 } as const;
        list.sort((a, b) => rank[a.role] - rank[b.role] || a.displayName.localeCompare(b.displayName));
        setState({ wid, data: list, error: false });
      },
      () => setState({ wid, data: null, error: true }),
    );
  }, [wid, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.wid === wid ? state : { data: null, error: false };
  return { members: current.data, error: current.error, retry };
}

/** Member list or null while loading (errors read as an empty list; use useMemberList for states). */
export function useMembers(wid: string) {
  const { members, error } = useMemberList(wid);
  return error ? [] : members;
}

/** Only for members_manage holders (rules allow list only to them). */
export function usePendingInvites(wid: string, enabled: boolean) {
  const [state, setState] = useState<Keyed<Invite[]>>({ wid: '', data: null, error: false });
  useEffect(() => {
    if (!wid || !enabled) return;
    return onSnapshot(
      query(refs.invites(wid), where('used', '==', false)),
      (snapshot) => {
        const list: Invite[] = [];
        const now = Date.now();
        snapshot.forEach((d) => {
          const invite = { id: d.id, ...(d.data() as Omit<Invite, 'id'>) };
          if (invite.expiresAt?.toMillis() > now) list.push(invite);
        });
        list.sort((a, b) => b.expiresAt.toMillis() - a.expiresAt.toMillis());
        setState({ wid, data: list, error: false });
      },
      () => setState({ wid, data: [], error: true }),
    );
  }, [wid, enabled]);
  return enabled && state.wid === wid ? (state.data ?? []) : [];
}
