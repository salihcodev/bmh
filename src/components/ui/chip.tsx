import { ChevronDown, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconStroke, motion, radii, sizes, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';

/**
 * Filter chip. Selected: dark pill with an x (tap clears). Unselected: outlined pill,
 * with a chevron when it opens a picker (`dropdown`).
 */
export function Chip({
  label,
  selected = false,
  onPress,
  onClear,
  dropdown = false,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shown as an x on a selected chip. */
  onClear?: () => void;
  dropdown?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const fg = selected ? colors.onPrimary : colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={selected && onClear ? onClear : onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
        },
      ]}
    >
      <AppText variant="label" style={{ color: fg }} numberOfLines={1}>
        {label}
      </AppText>
      {selected && onClear ? <X size={sizes.iconSm} color={fg} strokeWidth={iconStroke} /> : null}
      {!selected && dropdown ? <ChevronDown size={sizes.iconSm} color={fg} strokeWidth={iconStroke} /> : null}
    </Pressable>
  );
}

export type BadgeTone = 'lime' | 'neutral' | 'ink' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

/** Small pill tag. Lime is the brand highlight and always carries ink text. */
export function Badge({ label, tone = 'neutral', ltr }: { label: string; tone?: BadgeTone; ltr?: boolean }) {
  const { colors } = useTheme();
  const palette = {
    lime: [colors.accent, colors.onAccent],
    primary: [colors.accent, colors.onAccent],
    ink: [colors.primary, colors.onPrimary],
    neutral: [colors.surfaceMuted, colors.textSecondary],
    success: [colors.successTint, colors.success],
    warning: [colors.warningTint, colors.warning],
    danger: [colors.dangerTint, colors.danger],
    info: [colors.infoTint, colors.info],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <AppText variant="caption" ltr={ltr} style={{ color: palette[1] }} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Alias used for status tags. */
export const Tag = Badge;

const styles = StyleSheet.create({
  chip: {
    minHeight: sizes.chip,
    paddingHorizontal: spacing[4],
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
});
