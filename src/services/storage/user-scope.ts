import type { KeyValueStore } from './kv';

/** All per-user device data lives under `u:{uid}:` so sign-out can delete exactly that user's keys. */
export function userKey(uid: string, key: string): string {
  return `u:${uid}:${key}`;
}

export type EnumerableStore = KeyValueStore & { keys(): string[] };

export function clearUserKeys(store: EnumerableStore, uid: string): number {
  const prefix = `u:${uid}:`;
  const keys = store.keys().filter((key) => key.startsWith(prefix));
  keys.forEach((key) => store.remove(key));
  return keys.length;
}

/** Device-wide record of the last signed-in uid, used to detect an account change. */
export const LAST_UID_KEY = 'session.lastUid';
