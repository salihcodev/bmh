import { onSnapshot } from '@/services/firebase/listeners';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Area, City } from '@/domain/types';
import { refs } from '@/services/firebase/refs';

type Keyed<T> = { wid: string; items: T[] | null; error: boolean };

function useCollection<T extends { id: string }>(wid: string, key: 'cities' | 'areas', nonce: number) {
  const [state, setState] = useState<Keyed<T>>({ wid: '', items: null, error: false });
  useEffect(() => {
    if (!wid) return;
    const ref = key === 'cities' ? refs.cities(wid) : refs.areas(wid);
    return onSnapshot(
      ref,
      (snapshot) => {
        const list: T[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<T, 'id'>) } as T);
        });
        list.sort((a, b) =>
          String((a as unknown as { nameSearch: string }).nameSearch).localeCompare(
            String((b as unknown as { nameSearch: string }).nameSearch),
            'ar',
          ),
        );
        setState({ wid, items: list, error: false });
      },
      () => setState({ wid, items: [], error: true }),
    );
  }, [wid, key, nonce]);
  return state.wid === wid ? state : { items: null, error: false };
}

/**
 * Cities and areas are small (tens), so one live listener each covers the app and works offline.
 * Keyed on the workspace so a switch never shows the previous workspace's places.
 */
export function usePlaces(wid: string) {
  const [nonce, setNonce] = useState(0);
  const cities = useCollection<City>(wid, 'cities', nonce);
  const areas = useCollection<Area>(wid, 'areas', nonce);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => {
    const cityList = cities.items ?? [];
    const areaList = areas.items ?? [];
    const cityById = new Map(cityList.map((c) => [c.id, c]));
    const areaById = new Map(areaList.map((a) => [a.id, a]));
    return {
      loading: cities.items === null || areas.items === null,
      error: cities.error || areas.error,
      retry,
      cities: cityList,
      areas: areaList,
      activeCities: cityList.filter((c) => !c.isArchived),
      cityById,
      areaById,
      areasOf: (cityId: string, includeInactive = false) =>
        areaList.filter((a) => a.cityId === cityId && (includeInactive || a.isActive)),
    };
  }, [cities, areas, retry]);
}
