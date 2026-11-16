import { Redirect, Stack } from 'expo-router';

import { LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { loading: workspacesLoading, workspaceId } = useWorkspace();
  if (loading || (user && workspacesLoading)) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!workspaceId) return <Redirect href="/onboarding" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
