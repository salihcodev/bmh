import { Redirect, Stack } from 'expo-router';

import { BrandLoading } from '@/components/brand/brand-loading';
import { routeFor } from '@/domain/route-guard';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

/** Open while onboarding is incomplete, and afterwards for its workspace step (create / join later). */
export default function OnboardingLayout() {
  const guard = useRouteGuard();
  const stackOptions = useStackScreenOptions();
  if (guard.kind === 'loading') return <BrandLoading />;
  if (guard.kind === 'signedOut' || guard.kind === 'suspended') return <Redirect href={routeFor(guard)!} />;
  return <Stack screenOptions={stackOptions} />;
}
