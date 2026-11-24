import type { Surface } from '@/domain/user';

/** `/` is the root redirect gate, which sends dashboard users back; the app home is the `(app)` group (same href as `routeFor`). */
const APP_HOME = '/(app)';

const DEFAULTS: Record<Surface, string> = {
  app: APP_HOME,
  dashboard: '/dashboard',
};

const memory: Record<Surface, string> = { ...DEFAULTS };

/** Last dashboard path, so going back to the dashboard returns where you were. */
export function rememberSurface(surface: Surface, pathname: string) {
  if (surface !== 'dashboard' || !pathname.startsWith('/')) return;
  memory.dashboard = pathname;
}

/** The app side always opens on Home; the dashboard side reopens the last dashboard screen. */
export function surfaceTarget(current: Surface): string {
  return current === 'app' ? memory.dashboard || DEFAULTS.dashboard : APP_HOME;
}

/** Test hook. */
export function resetSurfaceMemory() {
  memory.app = DEFAULTS.app;
  memory.dashboard = DEFAULTS.dashboard;
}
