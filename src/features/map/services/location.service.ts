import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { validCoords, type Coords } from '@/domain/maps';
import type { LocationPermissionState } from '@/features/map/types/map.types';

export type LocationReading = {
  permission: LocationPermissionState;
  coords: Coords | null;
  asked: boolean;
};

/**
 * One-shot foreground read. Does not re-prompt when the system will not show a dialog
 * (blocked). Does not use `src/services/location.ts` `currentCoords()`, which requests
 * permission on every call.
 */
export async function readForegroundLocation(opts: { mayPrompt: boolean }): Promise<LocationReading> {
  const current = await Location.getForegroundPermissionsAsync();
  let status = current.status;
  let asked = false;

  if (status !== 'granted' && opts.mayPrompt && current.canAskAgain) {
    const next = await Location.requestForegroundPermissionsAsync();
    status = next.status;
    asked = true;
    if (status !== 'granted') {
      return { permission: next.canAskAgain ? 'denied' : 'blocked', coords: null, asked };
    }
  } else if (status !== 'granted') {
    return { permission: current.canAskAgain ? 'denied' : 'blocked', coords: null, asked };
  }

  const gpsOn = await Location.hasServicesEnabledAsync();
  if (!gpsOn) return { permission: 'gpsOff', coords: null, asked };

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
    if (!validCoords(coords.lat, coords.lng)) return { permission: 'granted', coords: null, asked };
    return { permission: 'granted', coords, asked };
  } catch {
    return { permission: 'gpsOff', coords: null, asked };
  }
}

export function openAppSettings(): void {
  void Linking.openSettings();
}
