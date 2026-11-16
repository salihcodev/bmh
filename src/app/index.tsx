import { Redirect } from 'expo-router';

import { LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function IndexScreen() {
  const { user, profile, loading, profileReady } = useAuth();
  const { loading: workspacesLoading, workspaceId } = useWorkspace();
  if (loading || (user && !profileReady) || (user && profile && workspacesLoading)) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!profile) return <Redirect href="/complete-profile" />;
  return <Redirect href={workspaceId ? '/(app)' : '/onboarding'} />;
}
