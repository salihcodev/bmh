import { Redirect } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components/ui';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';

export default function SuspendedScreen() {
  const { t } = useTranslation();
  const { user, isSuspended } = useCurrentUser();
  const { signOut, busy, dialog } = useSignOut();
  if (!user || !isSuspended) return <Redirect href="/" />;
  return (
    <Screen scroll={false}>
      <EmptyState title={t('suspended.title')} hint={t('suspended.body')} />
      <Button title={t('auth.signOut')} onPress={signOut} loading={busy} />
      {dialog}
    </Screen>
  );
}
