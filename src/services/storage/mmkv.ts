import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import type { EnumerableStore } from './user-scope';

const mmkv = createMMKV({ id: 'be-my-hand' });

export const appStorage: EnumerableStore = {
  getString: (key) => mmkv.getString(key),
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => {
    mmkv.remove(key);
  },
  keys: () => mmkv.getAllKeys(),
};

/** Synchronous zustand persist adapter backed by MMKV. */
export const zustandMMKVStorage: StateStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key);
  },
};
