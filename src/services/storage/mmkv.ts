import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import type { KeyValueStore } from './kv';

const mmkv = createMMKV({ id: 'be-my-hand' });

export const appStorage: KeyValueStore = {
  getString: (key) => mmkv.getString(key),
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => {
    mmkv.remove(key);
  },
};

/** Synchronous zustand persist adapter backed by MMKV. */
export const zustandMMKVStorage: StateStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key);
  },
};
