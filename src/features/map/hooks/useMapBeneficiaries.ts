import { query, where, type QueryDocumentSnapshot } from '@react-native-firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { firstValidPin } from '@/domain/maps';
import type { Beneficiary } from '@/domain/types';
import type { MapPoint } from '@/features/map/types/map.types';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';

function toBeneficiary(d: QueryDocumentSnapshot): Beneficiary {
  return { id: d.id, ...(d.data() as Omit<Beneficiary, 'id'>) };
}

export function toMapPoint(b: Beneficiary): MapPoint | null {
  const coords = firstValidPin(b.mapPins);
  if (!coords) return null;
  const last = b.lastConfirmedAssistanceAt?.toDate?.() ?? null;
  return {
    id: b.id,
    name: b.fullName,
    address: b.residentialAddress ?? b.pickupLocation ?? b.areaName,
    coords,
    phone: b.primaryPhone,
    householdCount: b.householdCount,
    areaName: b.areaName,
    lastAssistanceAt: last,
  };
}

/** Full workspace list for the map (~500). Paginated lists stay on usePaginatedQuery. */
export function useMapBeneficiaries(wid: string, enabled: boolean) {
  const key = enabled && wid ? `${wid}:map` : '';
  const [state, setState] = useState<{ key: string; rows: Beneficiary[] | null; error: Error | null }>({
    key: '',
    rows: null,
    error: null,
  });

  useEffect(() => {
    if (!key) return;
    return onSnapshot(
      query(refs.beneficiaries(wid), where('isArchived', '==', false)),
      (snapshot) => {
        setState({ key, rows: snapshot.docs.map(toBeneficiary), error: null });
      },
      (err) => setState({ key, rows: null, error: err as Error }),
    );
  }, [key, wid]);

  const current = state.key === key ? state : { rows: null, error: null };
  const points = useMemo(
    () => (current.rows ?? []).map(toMapPoint).filter((p): p is MapPoint => !!p),
    [current.rows],
  );
  const missingPin = useMemo(() => (current.rows ?? []).filter((b) => !firstValidPin(b.mapPins)), [current.rows]);

  return {
    status: !key
      ? ('ready' as const)
      : current.rows === null && !current.error
        ? ('loading' as const)
        : current.error
          ? ('error' as const)
          : ('ready' as const),
    points,
    missingPin,
    error: current.error,
  };
}
