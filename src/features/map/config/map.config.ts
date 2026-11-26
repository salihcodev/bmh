/** Public, keyless endpoints. Same defaults in development and production (V8-D2). */

const DEFAULT_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const DEFAULT_OSRM = 'https://router.project-osrm.org';

function publicUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return fallback;
    return trimmed.replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export const mapConfig = {
  styleLight: publicUrl(process.env.EXPO_PUBLIC_MAP_STYLE_LIGHT, DEFAULT_STYLE_LIGHT),
  styleDark: publicUrl(process.env.EXPO_PUBLIC_MAP_STYLE_DARK, DEFAULT_STYLE_DARK),
  routingBaseUrl: publicUrl(process.env.EXPO_PUBLIC_OSRM_BASE_URL, DEFAULT_OSRM),
  /** Cairo, Egypt — fallback center when GPS is unavailable. */
  defaultCenter: { lat: 30.0444, lng: 31.2357 } as const,
  defaultZoom: 11,
  routeCacheTtlMs: 60_000,
  routeTimeoutMs: 12_000,
  routeDebounceMs: 300,
  clusterRadius: 50,
  attribution:
    '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors',
};

export function mapStyleUrl(scheme: 'light' | 'dark'): string {
  return scheme === 'dark' ? mapConfig.styleDark : mapConfig.styleLight;
}
