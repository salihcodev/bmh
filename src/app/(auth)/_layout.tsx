import { Redirect, Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  const stackOptions = useStackScreenOptions();
  // The index gate decides between onboarding and the app.
  if (!loading && user) return <Redirect href="/" />;
  return <Stack screenOptions={stackOptions} />;
}
