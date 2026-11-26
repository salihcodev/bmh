import { distance } from '@turf/distance';
import { lineString, point } from '@turf/helpers';

import { isOnlineNow } from '@/services/sync/connectivity';
import { mapConfig } from '@/features/map/config/map.config';
import type { Coords } from '@/features/map/utils/coordinates';
import { routeCacheKey, toLngLat } from '@/features/map/utils/coordinates';
import type { MapRoute, RouteFailure, RoutingProvider } from '@/features/map/types/map.types';

type CacheEntry = { at: number; route: MapRoute };

const cache = new Map<string, CacheEntry>();

export function clearRouteCache(): void {
  cache.clear();
}

export function straightLineFallback(origin: Coords, dest: Coords, reason: RouteFailure): MapRoute {
  const km = distance(point(toLngLat(origin)), point(toLngLat(dest)), { units: 'kilometers' });
  return {
    kind: 'fallback',
    distanceM: km * 1000,
    durationS: null,
    geometry: lineString([toLngLat(origin), toLngLat(dest)]).geometry,
    reason,
  };
}

function parseOsrm(payload: unknown): MapRoute | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as {
    code?: string;
    routes?: { distance?: number; duration?: number; geometry?: GeoJSON.LineString }[];
  };
  const route = body.routes?.[0];
  if (body.code !== 'Ok' || !route?.geometry || route.geometry.type !== 'LineString') return null;
  if (!Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null;
  return {
    kind: 'osrm',
    distanceM: route.distance as number,
    durationS: route.duration as number,
    geometry: route.geometry,
  };
}

export function createOsrmProvider(
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): RoutingProvider {
  return {
    async getRoute(origin, dest, signal) {
      if (!isOnlineNow()) return straightLineFallback(origin, dest, 'offline');

      const key = routeCacheKey(origin, dest);
      const hit = cache.get(key);
      if (hit && now() - hit.at < mapConfig.routeCacheTtlMs) return hit.route;

      const url = `${mapConfig.routingBaseUrl}/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      const controller = new AbortController();
      const onOuterAbort = () => controller.abort();
      signal.addEventListener('abort', onOuterAbort);
      const timer = setTimeout(() => controller.abort('timeout'), mapConfig.routeTimeoutMs);

      try {
        const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
        if (response.status === 429) return remember(key, straightLineFallback(origin, dest, 'rateLimit'), now);
        if (!response.ok) return remember(key, straightLineFallback(origin, dest, 'network'), now);
        const parsed = parseOsrm(await response.json());
        if (!parsed) return remember(key, straightLineFallback(origin, dest, 'noRoute'), now);
        return remember(key, parsed, now);
      } catch (error) {
        if (signal.aborted) throw error;
        const timedOut = controller.signal.reason === 'timeout';
        return remember(key, straightLineFallback(origin, dest, timedOut ? 'timeout' : 'network'), now);
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', onOuterAbort);
      }
    },
  };
}

function remember(key: string, route: MapRoute, now: () => number): MapRoute {
  if (route.kind === 'osrm') cache.set(key, { at: now(), route });
  return route;
}

export const osrmProvider = createOsrmProvider();
