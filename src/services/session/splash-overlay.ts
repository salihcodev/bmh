import { create } from 'zustand';

type SplashOverlayState = { visible: boolean };

/** The root layout draws the hold splash over everything while `visible` is true. */
export const useSplashOverlay = create<SplashOverlayState>(() => ({ visible: false }));

/**
 * Covers the app with the splash and resolves once it has been painted, so the caller can sign out
 * and reload without the login screen showing first. The JS reload starts a fresh store, so the
 * overlay is never hidden again in this runtime.
 */
export function showSplashOverlay(): Promise<void> {
  useSplashOverlay.setState({ visible: true });
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
