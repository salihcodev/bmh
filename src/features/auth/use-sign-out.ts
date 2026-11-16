import { createElement, useCallback, useState } from 'react';

import { ConfirmDialog } from '@/components/ui';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';

/**
 * Sign-out with the pending-writes check: warns before discarding unsynced offline changes.
 * Render `dialog` next to the trigger; it is the confirmation sheet shown when writes are pending.
 */
export function useSignOut() {
  const { signOutUser } = useAuth();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await signOutUser();
      if (result === 'pending') setPending(true);
    } finally {
      setBusy(false);
    }
  }, [busy, signOutUser]);

  const dialog = createElement(ConfirmDialog, {
    visible: pending,
    title: t('signOutFlow.pendingTitle'),
    message: t('signOutFlow.pendingBody'),
    confirmLabel: t('signOutFlow.signOutAnyway'),
    cancelLabel: t('signOutFlow.stay'),
    destructive: true,
    onCancel: () => setPending(false),
    onConfirm: () => {
      setPending(false);
      void signOutUser({ force: true });
    },
  });

  return { signOut, busy, dialog };
}
