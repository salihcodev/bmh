import { Redirect, Stack } from 'expo-router';

import { LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';

export default function OnboardingLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
