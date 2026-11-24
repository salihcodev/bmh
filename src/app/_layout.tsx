import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider , router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCartStore } from '@/services/store/cart-store';
import { clearPendingHref, getPendingHref } from '@/services/navigation/pending-href';

import { Splash } from '@/components/brand/splash';
import { ConfirmHost, ToastProvider } from '@/components/ui';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useTranslation } from '@/localization';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { WorkspaceProvider } from '@/providers/workspace-provider';
import { useSplashOverlay } from '@/services/session/splash-overlay';
import { startConnectivity } from '@/services/sync/connectivity';
import { startOutbox } from '@/services/sync/outbox-runtime';
import { SyncHealthReporter } from '@/services/sync/health';
import { startSyncStatus } from '@/services/sync/sync-status';
import { usePreferences } from '@/store/preferences';
import { fontAssets, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

/** Startup never blocks longer than this, even if fonts, language, or auth never settle. */
const SPLASH_CAP_MS = 4000;

function useBackgroundServices() {
  useEffect(() => {
    const stops = [startConnectivity(), startOutbox(), startSyncStatus()];
    return () => stops.forEach((stop) => stop());
  }, []);
}

/** Hydrates cart and resolves any pending deep-link href when user signs in. */
function CartHydrator() {
  const { user, profileReady } = useAuth();
  const uid = user?.uid ?? null;
  useEffect(() => {
    useCartStore.getState().hydrate(uid);
  }, [uid]);
  useEffect(() => {
    if (!uid || !profileReady) return;
    const pending = getPendingHref();
    if (!pending) return;
    clearPendingHref();
    // Navigate after a tick so the router is ready
    setTimeout(() => { try { router.replace(pending as Parameters<typeof router.replace>[0]); } catch { /* invalid route */ } }, 50);
  }, [uid, profileReady]);
  return null;
}

/** Remounts per account so no state of a previous user survives a user change. */
function UserScopedProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <WorkspaceProvider key={user?.uid ?? 'signed-out'}>
      <SyncHealthReporter />
      <CartHydrator />
      {children}
    </WorkspaceProvider>
  );
}

/** Reports when routing can leave the splash (auth and profile are no longer loading). */
function RouteReady({ onChange }: { onChange: (ready: boolean) => void }) {
  const ready = useRouteGuard().kind !== 'loading';
  useEffect(() => {
    onChange(ready);
  }, [onChange, ready]);
  return null;
}

function ThemedApp({ onRouteReady }: { onRouteReady: (ready: boolean) => void }) {
  const { dark, colors } = useTheme();
  const stackOptions = useStackScreenOptions();
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
            <RouteReady onChange={onRouteReady} />
            <StatusBar style={dark ? 'light' : 'dark'} />
            <Stack screenOptions={stackOptions}>
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="join" />
              <Stack.Screen name="sync" />
              <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
              <Stack.Screen name="suspended" options={{ animation: 'fade' }} />
              <Stack.Screen name="dev/design-system" />
            </Stack>
            <ConfirmHost />
          </UserScopedProviders>
        </AuthProvider>
      </ToastProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const languageReady = usePreferences((state) => state.bootstrapped);
  const language = usePreferences((state) => state.language);
  const [capped, setCapped] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const overlay = useSplashOverlay((state) => state.visible);
  const { i18n } = useTranslation();
  const onRouteReady = useCallback((ready: boolean) => setRouteReady(ready), []);
  const finishSplash = useCallback(() => setSplashDone(true), []);
  useBackgroundServices();
  useEffect(() => {
    const timer = setTimeout(() => setCapped(true), SPLASH_CAP_MS);
    return () => clearTimeout(timer);
  }, []);

  const languageApplied = language !== null && (i18n.resolvedLanguage === language || i18n.language === language);
  const fontsReady = (fontsLoaded || !!fontError) && languageReady && languageApplied;
  const bootReady = fontsReady || capped;
  const splashReady = (fontsReady && routeReady) || capped;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {bootReady ? <ThemedApp onRouteReady={onRouteReady} /> : null}
          {splashDone ? null : (
            <Splash mode="boot" ready={splashReady} fontsReady={fontsReady} onFinish={finishSplash} />
          )}
          {overlay && splashDone ? <Splash mode="hold" /> : null}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
