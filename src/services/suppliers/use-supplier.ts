import { useCallback, useEffect, useState } from 'react';

import { normalizeSupplierRequest, type SupplierRequest } from '@/domain/supplier';
import { onSnapshot } from '@/services/firebase/listeners';
import { refs } from '@/services/firebase/refs';

type State = { uid: string; request: SupplierRequest | null; error: boolean };

/** The signed-in user's own `supplierRequests/{uid}` (null when they never asked). */
export function useOwnSupplierRequest(uid: string | null) {
  const [state, setState] = useState<State | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      refs.supplierRequest(uid),
      (snap) =>
        setState({
          uid,
          request: snap?.exists() ? normalizeSupplierRequest(snap.id, snap.data() ?? {}) : null,
          error: false,
        }),
      () => setState({ uid, request: null, error: true }),
    );
  }, [uid, nonce]);
  const retry = useCallback(() => {
    setState(null);
    setNonce((n) => n + 1);
  }, []);
  const current = uid && state?.uid === uid ? state : null;
  return {
    status: !current ? ('loading' as const) : current.error ? ('error' as const) : ('ready' as const),
    request: current?.request ?? null,
    retry,
  };
}
