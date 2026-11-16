import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from 'react-native';

import { motion, radii, spacing, useTheme } from '@/theme';

type Tone = 'surface' | 'muted' | 'ink' | 'lime';

function toneColors(tone: Tone, colors: ReturnType<typeof useTheme>['colors']) {
  return {
    surface: colors.surface,
    muted: colors.surfaceMuted,
    ink: colors.primary,
    lime: colors.accent,
  }[tone];
}

/** White rounded card (radius 24) on the grey canvas. Contrast instead of shadow. */
export function Card({ style, tone = 'surface', flush = false, ...props }: ViewProps & { tone?: Tone; flush?: boolean }) {
  const { colors } = useTheme();
  return (
    <View {...props} style={[styles.card, flush && styles.flush, { backgroundColor: toneColors(tone, colors) }, style]} />
  );
}

export function PressableCard({
  style,
  tone = 'surface',
  selected = false,
  ...props
}: PressableProps & { style?: ViewProps['style']; tone?: Tone; selected?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...props}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: toneColors(tone, colors),
          borderColor: selected ? colors.textPrimary : 'transparent',
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
        },
        styles.bordered,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, padding: spacing[5], marginBottom: spacing[3] },
  flush: { padding: 0, overflow: 'hidden' },
  bordered: { borderWidth: 2 },
});
