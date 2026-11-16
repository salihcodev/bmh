import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

type ConnectivityState = {
  isOnline: boolean;
  /** False until NetInfo reports once; treat as online meanwhile to avoid false "offline" flashes. */
  known: boolean;
};

export const useConnectivity = create<ConnectivityState>(() => ({ isOnline: true, known: false }));

const reconnectListeners = new Set<() => void>();

function toOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

let started = false;

export function startConnectivity(): () => void {
  if (started) return () => undefined;
  started = true;
  const unsubscribe = NetInfo.addEventListener((state) => {
    const wasOnline = useConnectivity.getState().isOnline;
    const isOnline = toOnline(state);
    useConnectivity.setState({ isOnline, known: true });
    if (isOnline && !wasOnline) reconnectListeners.forEach((listener) => listener());
  });
  return () => {
    started = false;
    unsubscribe();
  };
}

export function isOnlineNow(): boolean {
  return useConnectivity.getState().isOnline;
}

/** Asks NetInfo directly; use before online-only actions. */
export async function checkOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  const isOnline = toOnline(state);
  useConnectivity.setState({ isOnline, known: true });
  return isOnline;
}

export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

export class OfflineError extends Error {
  constructor() {
    super('OFFLINE');
    this.name = 'OfflineError';
  }
}

export async function requireOnline(): Promise<void> {
  if (!(await checkOnline())) throw new OfflineError();
}
