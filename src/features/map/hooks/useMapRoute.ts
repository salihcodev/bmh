import { useEffect, useRef, useState } from 'react';

import { mapConfig } from '@/features/map/config/map.config';
import { osrmProvider } from '@/features/map/services/routing.service';
import type { MapRoute, RoutingProvider } from '@/features/map/types/map.types';
import { routeCacheKey, type Coords } from '@/features/map/utils/coordinates';
import { useDebounced } from '@/hooks/use-debounced';

export function useMapRoute(
  origin: Coords | null,
  dest: Coords | null,
  enabled: boolean,
  provider: RoutingProvider = osrmProvider,
) {
  const debouncedDest = useDebounced(dest, mapConfig.routeDebounceMs);
  const requestKey = enabled && origin && debouncedDest ? routeCacheKey(origin, debouncedDest) : '';
  const [state, setState] = useState<{ key: string; route: MapRoute | null }>({ key: '', route: null });
  const seq = useRef(0);

  useEffect(() => {
    if (!requestKey || !origin || !debouncedDest) return;
    const id = ++seq.current;
    const controller = new AbortController();
    provider
      .getRoute(origin, debouncedDest, controller.signal)
      .then((next) => {
        if (seq.current !== id) return;
        setState({ key: requestKey, route: next });
      })
      .catch(() => {
        if (seq.current !== id) return;
        setState({ key: requestKey, route: null });
      });

    return () => {
      controller.abort();
    };
  }, [requestKey, origin, debouncedDest, provider]);

  const clear = () => {
    seq.current += 1;
    setState({ key: '', route: null });
  };

  const loading = !!requestKey && state.key !== requestKey;
  const route = state.key === requestKey ? state.route : null;
  return { route, loading, clear };
}
