import { create } from 'zustand';

export type SyncFailure = {
  id: string;
  label: string;
  message: string;
  code?: string;
  at: number;
  retry?: () => void;
};

type SyncState = {
  /** Batches committed in this app run that the server has not acknowledged yet. */
  pending: number;
  /** True until writes queued in a previous app run are confirmed (waitForPendingWrites). */
  previousRunPending: boolean;
  failures: SyncFailure[];
  lastSyncedAt: number | null;
  begin: () => void;
  end: () => void;
  fail: (failure: SyncFailure) => void;
  dismiss: (id: string) => void;
  setPreviousRunPending: (value: boolean) => void;
  markSynced: () => void;
  /** Sign-out: forget everything about the previous account. */
  reset: () => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  pending: 0,
  previousRunPending: true,
  failures: [],
  lastSyncedAt: null,
  begin: () => set((state) => ({ pending: state.pending + 1 })),
  end: () => set((state) => ({ pending: Math.max(0, state.pending - 1) })),
  fail: (failure) =>
    set((state) => ({ pending: Math.max(0, state.pending - 1), failures: [failure, ...state.failures].slice(0, 50) })),
  dismiss: (id) => set((state) => ({ failures: state.failures.filter((failure) => failure.id !== id) })),
  setPreviousRunPending: (previousRunPending) => set({ previousRunPending }),
  markSynced: () => set({ lastSyncedAt: Date.now() }),
  reset: () => set({ pending: 0, previousRunPending: false, failures: [], lastSyncedAt: null }),
}));
