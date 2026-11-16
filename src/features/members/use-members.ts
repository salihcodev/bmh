import { onSnapshot, query, where } from '@react-native-firebase/firestore';
import { useEffect, useState } from 'react';

import type { Invite, Member } from '@/domain/types';
import { refs } from '@/services/firebase/refs';

export function useMembers(wid: string) {
  const [members, setMembers] = useState<Member[] | null>(null);
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
        setMembers(list);
      },
      () => setMembers([]),
    );
  }, [wid]);
  return members;
}

/** Only for members_manage holders (rules allow list only to them). */
export function usePendingInvites(wid: string, enabled: boolean) {
  const [invites, setInvites] = useState<Invite[]>([]);
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
        setInvites(list);
      },
      () => setInvites([]),
    );
  }, [wid, enabled]);
  return enabled ? invites : [];
}
