import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { BrandLoading } from '@/components/brand/brand-loading';
import { useToast } from '@/components/ui';
import { routeFor } from '@/domain/route-guard';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useTranslation } from '@/localization';

/** Platform admin area. UX guard only: firestore.rules (isSuperAdmin) is the enforcement. */
export default function AdminLayout() {
  const guard = useRouteGuard();
  const { isSuperAdmin } = useCurrentUser();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const denied = guard.kind === 'app' && !isSuperAdmin;

  useEffect(() => {
    if (denied) showToast({ kind: 'warning', message: t('manage.notAllowed') });
  }, [denied, showToast, t]);

  if (guard.kind === 'loading') return <BrandLoading />;
  if (guard.kind !== 'app') return <Redirect href={routeFor(guard)!} />;
  if (!isSuperAdmin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
