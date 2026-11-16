import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  // The index gate decides between onboarding and the app.
  if (!loading && user) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
