import { useCallback, useMemo } from 'react';

import { useToast } from '@/components/ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import type { Actor } from '@/services/firebase/refs';
import { checkOnline } from '@/services/sync/connectivity';

/** Runs an online-only admin write with the offline check and success/error toasts. Returns true on success. */
export function useAdminAction() {
  const { profile, user } = useCurrentUser();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const actor = useMemo<Actor>(
    () => ({ uid: user?.uid ?? '', name: profile?.displayName || user?.email || '' }),
    [profile?.displayName, user?.email, user?.uid],
  );

  const run = useCallback(
    async (write: (actor: Actor) => Promise<unknown>, successMessage?: string): Promise<boolean> => {
      if (!(await checkOnline())) {
        showToast({ kind: 'warning', message: t('manage.offline') });
        return false;
      }
      try {
        await write(actor);
        if (successMessage) showToast({ kind: 'success', message: successMessage });
        return true;
      } catch (error) {
        showToast({ kind: 'error', message: errorMessage(error) });
        return false;
      }
    },
    [actor, showToast, t],
  );

  return { actor, run };
}
