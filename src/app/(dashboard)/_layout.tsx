import { Redirect, Slot } from 'expo-router';
import { useEffect } from 'react';

import { BrandLoading } from '@/components/brand/brand-loading';
import { SurfaceMemory } from '@/components/layout/surface-switch';
import { useToast } from '@/components/ui';
import { routeFor } from '@/domain/route-guard';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useTranslation } from '@/localization';

/** Staff dashboard. Members are sent back to the app. Rules enforce every query. */
export default function DashboardGroupLayout() {
  const guard = useRouteGuard();
  const { hasDashboard, systemRoleLoading } = useCurrentUser();
  const { showToast } = useToast();
  const { t } = useTranslation();
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
      <Slot />
    </SurfaceMemory>
  );
}
