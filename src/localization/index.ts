import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './ar.json';
import arPlatform from './ar.platform.json';
import en from './en.json';
import enPlatform from './en.platform.json';

export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'ar';
export const RTL_LANGUAGES: readonly Language[] = ['ar'];

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function isRTLLanguage(language: Language): boolean {
  return RTL_LANGUAGES.includes(language);
}

/** Arabic is the product default; the device locale only matters when it is supported. */
export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return isLanguage(code) ? code : DEFAULT_LANGUAGE;
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  // *.platform.json hold the namespaces added with the v3/v4 refactor (new top-level keys only).
  resources: { ar: { translation: { ...ar, ...arPlatform } }, en: { translation: { ...en, ...enPlatform } } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
export { useTranslation } from 'react-i18next';
