import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { BrandLoading } from '@/components/brand/brand-loading';
import { SurfaceMemory } from '@/components/layout/surface-switch';
import { useToast } from '@/components/ui';
import { routeFor } from '@/domain/route-guard';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useTranslation } from '@/localization';

/** Platform admin area for staff (owner or a system role). UX guard only: firestore.rules (hasSys) enforce. */
export default function AdminLayout() {
  const guard = useRouteGuard();
  const { hasDashboard, systemRoleLoading } = useCurrentUser();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  const inside = guard.kind === 'app' || guard.kind === 'dashboard';
  const denied = inside && !systemRoleLoading && !hasDashboard;

  useEffect(() => {
    if (denied) showToast({ kind: 'warning', message: t('manage.notAllowed') });
  }, [denied, showToast, t]);

  if (guard.kind === 'loading' || (inside && systemRoleLoading)) return <BrandLoading />;
  if (!inside) return <Redirect href={routeFor(guard)!} />;
  if (!hasDashboard) return <Redirect href="/" />;
  return (
    <SurfaceMemory surface="dashboard">
      <Stack screenOptions={stackOptions} />
    </SurfaceMemory>
  );
}
