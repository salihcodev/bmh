import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';

/** Sign-out with the pending-writes check: warns before discarding unsynced offline changes. */
export function useSignOut() {
  const { signOutUser } = useAuth();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await signOutUser();
      if (result !== 'pending') return;
      Alert.alert(t('signOutFlow.pendingTitle'), t('signOutFlow.pendingBody'), [
        { text: t('signOutFlow.stay'), style: 'cancel' },
        { text: t('signOutFlow.signOutAnyway'), style: 'destructive', onPress: () => void signOutUser({ force: true }) },
      ]);
    } finally {
      setBusy(false);
    }
  }, [busy, signOutUser, t]);

  return { signOut, busy };
}
