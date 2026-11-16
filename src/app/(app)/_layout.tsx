import { Redirect, Stack } from 'expo-router';

import { BrandLoading } from '@/components/brand/brand-loading';
import { routeFor } from '@/domain/route-guard';
import { useRouteGuard } from '@/hooks/use-route-guard';

/** Signed in, active and onboarded. A workspace is not required here; see (ws)/_layout. */
export default function AppLayout() {
  const guard = useRouteGuard();
  if (guard.kind === 'loading') return <BrandLoading />;
  if (guard.kind !== 'app') return <Redirect href={routeFor(guard)!} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
