// Compatibility layer: screens written before the v3 design system import from here.
// New code imports from '@/theme'. All values are aliases of the tokens in src/theme/tokens.ts.
import { radii, sizes, spacing, typography } from '@/theme/tokens';

export { Fonts } from '@/theme/fonts';
export { darkColors, lightColors, type ThemeColors } from '@/theme/tokens';

export const FontSizes = {
  xs: typography.caption.size,
  sm: typography.bodySm.size,
  md: typography.body.size,
  lg: typography.h3.size,
  xl: typography.h2.size,
  xxl: typography.h1.size,
} as const;

export const Spacing = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  xxl: spacing.xxl,
  huge: spacing.huge,
} as const;

export const Radii = radii;

/** Cards rely on contrast, not shadows. Floating elements use `elevation.floating` from '@/theme'. */
export const Shadows = {};

export const TouchTarget = sizes.minTouch;
export const MaxContentWidth = sizes.maxContent;
