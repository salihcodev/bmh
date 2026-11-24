import { router, usePathname, type Href } from 'expo-router';
import { LayoutDashboard, Smartphone } from 'lucide-react-native';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { IconButton } from '@/components/ui';
import { canSwitchSurfaces, type Surface } from '@/domain/user';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { rememberSurface, surfaceTarget } from '@/services/navigation/surface-memory';

export function useShowSurfaceSwitch(): boolean {
  const { profile } = useCurrentUser();
  const guard = useRouteGuard();
  const ready = guard.kind === 'app' || guard.kind === 'dashboard';
  return ready && canSwitchSurfaces(profile?.userType);
}

const SurfaceContext = createContext<Surface | null>(null);

export function surfaceOfPath(pathname: string): Surface {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/manage' || pathname.startsWith('/manage/')
    ? 'dashboard'
    : 'app';
}

/**
 * Remembers this side's path so the header switch can come back to it, and tells every header below
 * which side it belongs to. `usePathname` is global: while a side is animating out, its layout still
 * sees the other side's path, so the path alone must never decide the icon or what gets remembered.
 */
export function SurfaceMemory({ surface, children }: { surface: Surface; children?: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    if (surfaceOfPath(pathname) === surface) rememberSurface(surface, pathname);
  }, [pathname, surface]);
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}

/** Dashboard ⇄ app, beside the sync chip. Owner and moderator only. */
export function SurfaceSwitch() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const owner = useContext(SurfaceContext);
  const show = useShowSurfaceSwitch();
  if (!show) return null;
  const current: Surface = owner ?? surfaceOfPath(pathname);
  return (
    <IconButton
      icon={current === 'app' ? LayoutDashboard : Smartphone}
      label={t(current === 'app' ? 'dashboard.switchToDashboard' : 'dashboard.switchToApp')}
      // replace, not navigate: the two sides are alternates, so each switch swaps the top screen.
      // `navigate` tried to pop back to the side left underneath, and a stale one swallowed the tap.
      onPress={() => router.replace(surfaceTarget(current) as Href)}
    />
  );
}
