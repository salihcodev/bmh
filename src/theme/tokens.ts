// Single source of truth for design tokens (docs/design-system.md).
// (ref) values come from the reference images; the rest are derived and kept consistent with them.

export const palette = {
  ink: '#202020', // (ref) text, primary buttons, selected chips
  lime: '#C9F158', // (ref) brand accent, always paired with ink
  canvas: '#F2F3F5', // (ref) screen background, grey tiles
  white: '#FFFFFF', // (ref) cards and surfaces
} as const;

const light = {
  background: palette.canvas,
  surface: palette.white,
  surfaceMuted: palette.canvas,
  textPrimary: palette.ink,
  textSecondary: '#6B6F76',
  textTertiary: '#8A8F96',
  border: '#E6E8EB',
  divider: '#ECEEF0',
  primary: palette.ink,
  onPrimary: palette.white,
  accent: palette.lime,
  accentPressed: '#B5E040',
  accentTint: '#F3FAD6',
  onAccent: palette.ink,
  success: '#237A36',
  successTint: '#E6F6EA',
  warning: '#8F5300',
  warningTint: '#FEF3DC',
  danger: '#C4262C',
  dangerTint: '#FDECEC',
  info: '#2560C8',
  infoTint: '#E8F0FE',
  skeletonBase: '#E9EBEE',
  skeletonHighlight: '#F5F6F8',
  overlay: 'rgba(32,32,32,0.50)',
  shadow: '#000000',
} as const;

export type SemanticColors = { [K in keyof typeof light]: string };

const dark: SemanticColors = {
  background: '#121212',
  surface: '#1C1C1E',
  surfaceMuted: '#26262A',
  textPrimary: '#F5F6F7',
  textSecondary: '#A0A4AB',
  textTertiary: '#6F737A',
  border: '#2E2F33',
  divider: '#2A2B2F',
  primary: palette.lime, // lime is the primary action on dark, with ink text
  onPrimary: palette.ink,
  accent: palette.lime,
  accentPressed: '#B5E040',
  accentTint: '#2A3112',
  onAccent: palette.ink,
  success: '#4CC764',
  successTint: '#16281B',
  warning: '#FFB84D',
  warningTint: '#2E2411',
  danger: '#FF6B6F',
  dangerTint: '#2E1618',
  info: '#6EA5FF',
  infoTint: '#14203A',
  skeletonBase: '#26262A',
  skeletonHighlight: '#303036',
  overlay: 'rgba(0,0,0,0.60)',
  shadow: '#000000',
};

/** Names used by screens written before the v3 design system. Kept as aliases of the semantic tokens. */
function withLegacy(c: SemanticColors) {
  return {
    ...c,
    text: c.textPrimary,
    primarySoft: c.accentTint,
    accentSoft: c.accentTint,
    topBar: c.background,
    surfaceRaised: c.surface,
    backgroundElement: c.surfaceMuted,
    backgroundSelected: c.accentTint,
    dangerSoft: c.dangerTint,
    warningSoft: c.warningTint,
    successSoft: c.successTint,
  };
}

export const lightColors = withLegacy(light);
export const darkColors = withLegacy(dark);
export type ThemeColors = typeof lightColors;

/** 4pt grid. Numeric keys follow the spec; named keys are the legacy aliases. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const screenPadding = 20;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16, // inputs
  lg: 20, // row tiles
  xl: 24, // cards
  xxl: 28, // bottom sheets
  iconButton: 14, // square-rounded back / icon buttons
  pill: 999, // buttons, chips, badges
  round: 999,
} as const;

export const sizes = {
  button: 56,
  buttonSm: 44,
  input: 56,
  chip: 40,
  iconButton: 44,
  iconTile: 40,
  tabBar: 72,
  fab: 60,
  avatarSm: 40,
  avatarMd: 56,
  avatarLg: 96,
  minTouch: 44,
  icon: 20,
  iconSm: 16,
  iconLg: 24,
  maxContent: 800,
} as const;

export const iconStroke = 1.75;

export const elevation = {
  none: {},
  floating: { shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, shadowOpacity: 0.08, elevation: 6 },
  sheet: { shadowOffset: { width: 0, height: -8 }, shadowRadius: 32, shadowOpacity: 0.1, elevation: 12 },
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 350,
  pressScale: 0.98,
  skeletonShimmer: 1200,
  skeletonDelay: 150,
  skeletonMinVisible: 400,
  carouselAutoplay: 5000,
} as const;

export type TypeVariant = 'display' | 'h1' | 'h2' | 'h3' | 'bodyLg' | 'body' | 'bodySm' | 'label' | 'caption';
export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export const typography: Record<TypeVariant, { size: number; line: number; weight: FontWeight; heading?: boolean }> = {
  display: { size: 32, line: 38, weight: 'bold', heading: true },
  h1: { size: 28, line: 34, weight: 'bold', heading: true },
  h2: { size: 22, line: 28, weight: 'bold', heading: true },
  h3: { size: 18, line: 24, weight: 'bold', heading: true },
  bodyLg: { size: 16, line: 24, weight: 'medium' },
  body: { size: 15, line: 22, weight: 'regular' },
  bodySm: { size: 13, line: 18, weight: 'regular' },
  label: { size: 13, line: 18, weight: 'medium' },
  caption: { size: 12, line: 16, weight: 'medium' },
};

/** Arabic glyphs need a little more room than Latin at the same nominal size. */
export const arabicAdjust = { size: 1, line: 4 } as const;
export const latinHeadingTracking = -0.2;
