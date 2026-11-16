import type { FontWeight } from './tokens';

// Pure module (no native imports) so it can be unit tested.

export type Script = 'arabic' | 'latin' | 'locale';

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const FAMILIES = {
  latin: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    // Space Grotesk ships no 600; semibold maps to bold.
    semibold: 'SpaceGrotesk_700Bold',
    bold: 'SpaceGrotesk_700Bold',
  },
  arabic: {
    regular: 'IBMPlexSansArabic_400Regular',
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
    bold: 'IBMPlexSansArabic_700Bold',
  },
} as const;

let uiLanguage: 'ar' | 'en' = 'ar';

/** Called when the UI language changes so 'locale' resolves to the right family. */
export function setFontLanguage(language: 'ar' | 'en') {
  uiLanguage = language;
}

/**
 * Picks the script of a text: any Arabic letter means Arabic (IBM Plex Sans Arabic also
 * covers Latin and digits, so mixed strings render in one family). Pure Latin/digits/
 * symbols use Space Grotesk. Non-string content falls back to the UI language.
 */
export function detectScript(content: unknown): 'arabic' | 'latin' {
  const text = flatten(content);
  if (text === null) return uiLanguage === 'ar' ? 'arabic' : 'latin';
  return ARABIC.test(text) ? 'arabic' : 'latin';
}

function flatten(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return String(content);
  if (Array.isArray(content)) {
    const parts = content.map(flatten);
    if (parts.every((part) => part === null)) return null;
    return parts.filter((part) => part !== null).join('');
  }
  return null;
}

export function resolveFontFamily(weight: FontWeight, script: Script): string {
  const resolved = script === 'locale' ? (uiLanguage === 'ar' ? 'arabic' : 'latin') : script;
  return FAMILIES[resolved][weight];
}
