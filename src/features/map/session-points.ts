import { firstValidPin } from '@/domain/maps';
import type { SessionItem } from '@/domain/types';
import type { MapPoint } from '@/features/map/types/map.types';
import { visitFromStatus } from '@/features/map/types/map.types';

export function sessionMapPoints(items: SessionItem[]): { points: MapPoint[]; missingCount: number } {
  const points: MapPoint[] = [];
  let missingCount = 0;
  for (const item of items) {
    const coords = firstValidPin(item.mapPins);
    if (!coords) {
      missingCount += 1;
      continue;
    }
    points.push({
      id: item.id,
      name: item.fullName,
      address: item.residentialAddress ?? item.pickupLocation ?? item.areaName,
      coords,
      phone: item.primaryPhone,
      householdCount: item.householdCount,
      areaName: item.areaName,
      visit: visitFromStatus(item.status),
    });
  }
  return { points, missingCount };
}
