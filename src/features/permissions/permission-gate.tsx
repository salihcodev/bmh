import { Redirect, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { LoadingState, Screen } from '@/components/ui';
import { permissionGate } from '@/domain/permission-gate';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';

/**
 * Route-level guard (UX only; rules enforce). An unauthorized route says why and leaves for
 * `fallback`, so deep links and stale navigation never land on a screen that cannot load.
 */
export function PermissionGate({
  allowed,
  loading = false,
  fallback = '/',
  children,
}: {
  allowed: boolean;
  loading?: boolean;
  fallback?: Href;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const state = permissionGate({ allowed, loading });

  useEffect(() => {
    if (state === 'redirect') emitActionFeedback({ message: t('states.noPermissionTitle'), kind: 'error' });
  }, [state, t]);

  if (state === 'allow') return <>{children}</>;
  if (state === 'redirect') return <Redirect href={fallback} />;
  return (
    <Screen scroll={false}>
      <LoadingState />
    </Screen>
  );
}
