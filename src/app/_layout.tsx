import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { WorkspaceProvider } from '@/providers/workspace-provider';
import { startConnectivity } from '@/services/sync/connectivity';
import { startOutbox } from '@/services/sync/outbox-runtime';
import { startSyncStatus } from '@/services/sync/sync-status';
import { usePreferences } from '@/store/preferences';

void SplashScreen.preventAutoHideAsync();

function useBackgroundServices() {
  useEffect(() => {
    const stops = [startConnectivity(), startOutbox(), startSyncStatus()];
    return () => stops.forEach((stop) => stop());
  }, []);
}

/** Remounts per account so no state of a previous user survives a user change. */
function UserScopedProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <WorkspaceProvider key={user?.uid ?? 'signed-out'}>{children}</WorkspaceProvider>;
}

export default function RootLayout() {
  const { dark, colors } = useAppTheme();
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_700Bold,
  });
  const languageReady = usePreferences((state) => state.bootstrapped);
  useBackgroundServices();
  const ready = fontsLoaded && languageReady;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <ToastProvider>
            <AuthProvider>
              <UserScopedProviders>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="join" />
                  <Stack.Screen name="(app)" />
                  <Stack.Screen name="suspended" />
                </Stack>
              </UserScopedProviders>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
