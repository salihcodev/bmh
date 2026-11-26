import { useCallback, useEffect, useRef, useState } from 'react';

import { mapConfig } from '@/features/map/config/map.config';
import { openAppSettings, readForegroundLocation } from '@/features/map/services/location.service';
import type { LocationPermissionState } from '@/features/map/types/map.types';
import type { Coords } from '@/features/map/utils/coordinates';

export function useCurrentLocation() {
  const prompted = useRef(false);
  const [permission, setPermission] = useState<LocationPermissionState>('unknown');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (mayPrompt: boolean) => {
    setLoading(true);
    const reading = await readForegroundLocation({ mayPrompt });
    if (reading.asked) prompted.current = true;
    setPermission(reading.permission);
    setCoords(reading.coords);
    setLoading(false);
    return reading;
  }, []);

  useEffect(() => {
    void refresh(!prompted.current);
  }, [refresh]);

  const center = coords ?? mapConfig.defaultCenter;

  return {
    permission,
    coords,
    center,
    loading,
    usingFallbackCenter: !coords,
    refresh: () => refresh(permission !== 'blocked'),
    openSettings: openAppSettings,
  };
}
