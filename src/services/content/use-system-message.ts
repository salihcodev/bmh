import { useEffect, useMemo, useState } from 'react';

import type { Language } from '@/domain/marketing';
import {
  isVisible,
  normalizeSystemMessage,
  resolveMessageText,
  resolveMessageTitle,
  type Reader,
  type SystemMessage,
} from '@/domain/system-message';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';

const TICK_MS = 60_000;

/** Wall clock that re-renders once a minute, so a message expires or starts without a reload. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Who is reading: user type plus every role id that can match a `role` audience. */
export function useMessageReader(): Reader {
  const { profile } = useAuth();
  const { member } = useWorkspace();
  const userType = profile?.userType ?? null;
  const systemRoleId = profile?.systemRoleId ?? null;
  const workspaceRoleId = member?.roleId ?? null;
  return useMemo(
    () => ({ userType, roleIds: [systemRoleId, workspaceRoleId].filter((id): id is string => !!id) }),
    [userType, systemRoleId, workspaceRoleId],
  );
}

export type SystemMessageState = {
  /** The published message addressed to this reader right now, if any. */
  message: SystemMessage | null;
  title: string | null;
  /** Admin text, or `fallback` when there is nothing to show. Always safe to render. */
  text: string;
  /** True when `text` comes from the admin message rather than the fallback. */
  isRemote: boolean;
};

/**
 * One live system message by key. A missing, unpublished, expired or foreign-audience message
 * (and a read error, e.g. offline with nothing cached) all resolve to the app's own `fallback`.
 */
export function useSystemMessage(key: string, fallback: string): SystemMessageState {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const language: Language = i18n.language === 'en' ? 'en' : 'ar';
  const reader = useMessageReader();
  const now = useMinuteClock();
  const uid = user?.uid ?? null;
  const [live, setLive] = useState<{ id: string; message: SystemMessage | null } | null>(null);
  const id = uid ? `${uid}:${key}` : null;

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      refs.systemMessage(key),
      (snap) => setLive({ id, message: snap.exists() ? normalizeSystemMessage(key, snap.data()) : null }),
      () => setLive({ id, message: null }),
    );
  }, [id, key]);

  const message = live && live.id === id ? live.message : null;
  const visible = message && isVisible(message, reader, now) ? message : null;
  const text = resolveMessageText(visible, reader, now, language, fallback);
  return { message: visible, title: resolveMessageTitle(visible, language), text, isRemote: visible !== null && text !== fallback };
}
