import { firstValidPin, round, toLngLat, validCoords, type Coords } from '@/domain/maps';

export { firstValidPin, toLngLat, validCoords };
export type { Coords };

/** Rounded origin+destination key so nearby GPS jitter reuses a cached route. */
export function routeCacheKey(origin: Coords, dest: Coords): string {
  return `${round(origin.lat, 4)},${round(origin.lng, 4)}|${round(dest.lat, 4)},${round(dest.lng, 4)}`;
}

export function boundsFor(a: Coords, b: Coords): [number, number, number, number] {
  const west = Math.min(a.lng, b.lng);
  const east = Math.max(a.lng, b.lng);
  const south = Math.min(a.lat, b.lat);
  const north = Math.max(a.lat, b.lat);
  return [west, south, east, north];
}
