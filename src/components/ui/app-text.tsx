import { StyleSheet, Text, type TextProps } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import {
  arabicAdjust,
  detectScript,
  latinHeadingTracking,
  resolveFontFamily,
  typography,
  useTheme,
  type FontWeight,
  type TypeVariant,
} from '@/theme';

type LegacyVariant = 'title' | 'heading' | 'subtitle';
export type TextVariant = TypeVariant | LegacyVariant;

const LEGACY: Record<LegacyVariant, TypeVariant> = { title: 'h1', heading: 'h3', subtitle: 'bodySm' };

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'warning' | 'onPrimary' | 'onAccent';

/**
 * The only text primitive. Picks Space Grotesk for Latin/numbers and IBM Plex Sans
 * Arabic for Arabic (by content, falling back to the UI language), applies the type
 * scale with the Arabic size/line adjustments, and keeps LTR content LTR.
 */
export function AppText({
  style,
  variant = 'body',
  weight,
  tone,
  muted = false,
  ltr = false,
  center = false,
  children,
  ...props
}: TextProps & {
  variant?: TextVariant;
  weight?: FontWeight;
  tone?: TextTone;
  muted?: boolean;
  /** Numbers, phone numbers, emails, codes: always left-to-right. */
  ltr?: boolean;
  center?: boolean;
}) {
  const { colors } = useTheme();
  const { writingDirection } = useDirection();
  const token = typography[(LEGACY as Record<string, TypeVariant>)[variant] ?? (variant as TypeVariant)];
  const script = detectScript(children);
  const arabic = script === 'arabic';
  const color = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    onPrimary: colors.onPrimary,
    onAccent: colors.onAccent,
  }[tone ?? (muted ? 'secondary' : 'primary')];
  return (
    <Text
      {...props}
      maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? 1.6}
      style={[
        {
          fontFamily: resolveFontFamily(weight ?? token.weight, script),
          fontSize: token.size + (arabic ? arabicAdjust.size : 0),
          lineHeight: token.line + (arabic ? arabicAdjust.line : 0),
          letterSpacing: token.heading && !arabic ? latinHeadingTracking : 0,
          color,
          writingDirection: ltr ? 'ltr' : writingDirection,
        },
        center && styles.center,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
