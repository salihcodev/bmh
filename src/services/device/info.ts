import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { appStorage } from '@/services/storage/mmkv';

export type DevicePlatform = 'ios' | 'android' | 'web';

export function devicePlatform(): DevicePlatform {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
}

export function appVersion(): string {
  return (Constants.expoConfig?.version ?? '').slice(0, 32);
}

const DEVICE_ID_KEY = 'device.id';

/** Random id for this install, kept on the device. It names the sync health summary. */
export function deviceId(): string {
  const stored = appStorage.getString(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = Array.from({ length: 12 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  appStorage.set(DEVICE_ID_KEY, id);
  return id;
}
