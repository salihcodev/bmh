import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import { resolveFontFamily } from './font-resolver';

export { detectScript, resolveFontFamily, type Script } from './font-resolver';

/** Bundled with expo-font at startup (no network fonts). */
export const fontAssets = {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
};

/** Legacy names: weights in the current UI language (Arabic UI resolves to IBM Plex Sans Arabic). */
export const Fonts = {
  get sans() {
    return resolveFontFamily('regular', 'locale');
  },
  get medium() {
    return resolveFontFamily('medium', 'locale');
  },
  get bold() {
    return resolveFontFamily('bold', 'locale');
  },
  latin: resolveFontFamily('regular', 'latin'),
  latinMedium: resolveFontFamily('medium', 'latin'),
  latinBold: resolveFontFamily('bold', 'latin'),
};
