/** MMKV-backed pending navigation href. Saves a path before redirecting to login. */
import { appStorage } from '@/services/storage/mmkv';

const KEY = 'navigation.pendingHref';

export function setPendingHref(href: string) {
  appStorage.set(KEY, href);
}

export function getPendingHref(): string | null {
  return appStorage.getString(KEY) ?? null;
}

export function clearPendingHref() {
  appStorage.remove(KEY);
}
