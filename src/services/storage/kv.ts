/** Minimal synchronous key-value contract, so storage users can be unit tested without native MMKV. */
export type KeyValueStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
};

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    getString: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
    },
    remove: (key) => {
      data.delete(key);
    },
  };
}

export function readJSON<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(store: KeyValueStore, key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}
