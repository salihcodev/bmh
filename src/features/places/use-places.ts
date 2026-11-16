import { onSnapshot } from '@/services/firebase/listeners';
import { useEffect, useMemo, useState } from 'react';

import type { Area, City } from '@/domain/types';
import { refs } from '@/services/firebase/refs';

function useCollection<T extends { id: string }>(wid: string, key: 'cities' | 'areas') {
  const [items, setItems] = useState<T[] | null>(null);
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
        setItems(list);
      },
      () => setItems([]),
    );
  }, [wid, key]);
  return items;
}

/** Cities and areas are small (tens), so one live listener each covers the app and works offline. */
export function usePlaces(wid: string) {
  const cities = useCollection<City>(wid, 'cities');
  const areas = useCollection<Area>(wid, 'areas');
  return useMemo(() => {
    const cityById = new Map((cities ?? []).map((c) => [c.id, c]));
    const areaById = new Map((areas ?? []).map((a) => [a.id, a]));
    return {
      loading: cities === null || areas === null,
      cities: cities ?? [],
      areas: areas ?? [],
      activeCities: (cities ?? []).filter((c) => !c.isArchived),
      cityById,
      areaById,
      areasOf: (cityId: string, includeInactive = false) =>
        (areas ?? []).filter((a) => a.cityId === cityId && (includeInactive || a.isActive)),
    };
  }, [cities, areas]);
}
