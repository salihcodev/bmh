import { Platform } from 'react-native';

// Neutral teal palette. Change `primary*` to rebrand; the rest are semantic tokens.
export const Colors = {
  light: {
    primary: '#0F766E',
    primarySoft: '#DDF3F0',
    onPrimary: '#FFFFFF',
    accent: '#C2410C',
    accentSoft: '#FDEBDD',
    topBar: '#0B4F4A',
    text: '#14201E',
    textSecondary: '#5F6B69',
    background: '#F6F8F7',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    backgroundElement: '#ECF0EF',
    backgroundSelected: '#D5EBE7',
    border: '#DDE3E1',
    danger: '#B42318',
    dangerSoft: '#FDE4E1',
    warning: '#A15C07',
    warningSoft: '#FDF0D5',
    success: '#1F7A4D',
    successSoft: '#DCF3E6',
    overlay: 'rgba(10, 20, 18, 0.5)',
  },
  dark: {
    primary: '#2DD4BF',
    primarySoft: '#0E2A27',
    onPrimary: '#06201D',
    accent: '#FB923C',
    accentSoft: '#2B1A0E',
    topBar: '#0C1413',
    text: '#E8EFEE',
    textSecondary: '#9AA6A4',
    background: '#0B0F0E',
    surface: '#131A19',
    surfaceRaised: '#1A2321',
    backgroundElement: '#1C2524',
    backgroundSelected: '#143430',
    border: '#26302F',
    danger: '#F97066',
    dangerSoft: '#2D1412',
    warning: '#FDB022',
    warningSoft: '#2B200C',
    success: '#47CD89',
    successSoft: '#0F2A1C',
    overlay: 'rgba(0, 0, 0, 0.72)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Fonts = {
  sans: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const FontSizes = { xs: 12, sm: 13, md: 15, lg: 17, xl: 22, xxl: 28 } as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 } as const;

export const Radii = { sm: 10, md: 14, lg: 20, xl: 28, round: 999 } as const;

export const Shadows = Platform.select({
  ios: { shadowColor: '#0B1412', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 2 },
  default: {},
})!;

/** Minimum touch target recommended by both platform guidelines. */
export const TouchTarget = 48;
export const MaxContentWidth = 800;
