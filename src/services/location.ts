import * as Location from 'expo-location';

import { isShortMapsLink, parseCoordinates, type Coords, type ParseResult } from '@/domain/maps';
import { isOnlineNow } from '@/services/sync/connectivity';

export async function currentCoords(): Promise<Coords | 'denied'> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return 'denied';
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

/** Like parseCoordinates, but follows a short maps link when online. */
export async function resolveCoordinates(input: string): Promise<ParseResult> {
  const parsed = parseCoordinates(input);
  if (parsed.ok || !isShortMapsLink(input) || !isOnlineNow()) return parsed;
  try {
    const response = await fetch(input.trim(), { method: 'GET', redirect: 'follow' });
    return parseCoordinates(response.url);
  } catch {
    return parsed;
  }
}
