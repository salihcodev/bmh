import type { Coords } from '@/domain/maps';
import type { ItemStatus } from '@/domain/types';

export type MapVisit = 'visited' | 'remaining' | 'ignored';

export type MapPoint = {
  id: string;
  name: string;
  address?: string | null;
  coords: Coords;
  phone?: string | null;
  householdCount?: number;
  areaName?: string;
  lastAssistanceAt?: Date | null;
  visit?: MapVisit;
};

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked' | 'gpsOff';

export type RouteKind = 'osrm' | 'fallback';

export type RouteFailure = 'offline' | 'timeout' | 'rateLimit' | 'noRoute' | 'network';

export type MapRoute = {
  kind: RouteKind;
  distanceM: number;
  durationS: number | null;
  geometry: GeoJSON.LineString | null;
  reason?: RouteFailure;
};

export type RoutingProvider = {
  getRoute: (origin: Coords, dest: Coords, signal: AbortSignal) => Promise<MapRoute>;
};

export function visitFromStatus(status: ItemStatus | undefined): MapVisit | undefined {
  if (status === 'checked') return 'visited';
  if (status === 'ignored') return 'ignored';
  if (status === 'pending') return 'remaining';
  return undefined;
}
