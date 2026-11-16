import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { WorkspaceProvider } from '@/providers/workspace-provider';
import { startConnectivity } from '@/services/sync/connectivity';
import { startOutbox } from '@/services/sync/outbox-runtime';
import { startSyncStatus } from '@/services/sync/sync-status';
import { usePreferences } from '@/store/preferences';
import { fontAssets, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

/** The native splash never stays longer than this, even if fonts or the language are not ready. */
const SPLASH_CAP_MS = 4000;

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

function ThemedApp() {
  const { dark, colors } = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
    },
  };
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <ToastProvider>
        <AuthProvider>
          <UserScopedProviders>
            <StatusBar style={dark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="join" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="suspended" />
              <Stack.Screen name="dev/design-system" />
            </Stack>
          </UserScopedProviders>
        </AuthProvider>
      </ToastProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const languageReady = usePreferences((state) => state.bootstrapped);
  const [capped, setCapped] = useState(false);
  useBackgroundServices();
  useEffect(() => {
    const timer = setTimeout(() => setCapped(true), SPLASH_CAP_MS);
    return () => clearTimeout(timer);
  }, []);
  const ready = ((fontsLoaded || !!fontError) && languageReady) || capped;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
