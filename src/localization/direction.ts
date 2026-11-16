import * as Expo from 'expo';
import { I18nManager, Platform } from 'react-native';

import { isRTLLanguage, type Language } from './index';

/**
 * Native layout direction can only change after a reload. Returns true when a
 * reload was triggered, so callers can keep the splash screen up.
 */
export function applyLayoutDirection(language: Language): boolean {
  if (Platform.OS === 'web') return false;
  const wantRTL = isRTLLanguage(language);
  if (I18nManager.isRTL === wantRTL) return false;
  I18nManager.allowRTL(wantRTL);
  I18nManager.forceRTL(wantRTL);
  void Expo.reloadAppAsync();
  return true;
}
