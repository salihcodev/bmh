import { Redirect, Stack } from 'expo-router';

import { BrandLoading } from '@/components/brand/brand-loading';
import { routeFor } from '@/domain/route-guard';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useWorkspace } from '@/providers/workspace-provider';

export default function AppLayout() {
  const guard = useRouteGuard();
  const { loading: workspacesLoading, workspaceId } = useWorkspace();
  if (guard.kind === 'loading' || (guard.kind === 'app' && workspacesLoading)) return <BrandLoading />;
  if (guard.kind !== 'app') return <Redirect href={routeFor(guard)!} />;
  if (!workspaceId) return <Redirect href="/onboarding?step=workspace" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
