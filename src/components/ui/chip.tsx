import { Pressable, StyleSheet } from 'react-native';

import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './app-text';

export function Chip({
  label,
  selected = false,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.backgroundElement,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppText style={[styles.text, { color: selected ? colors.onPrimary : colors.text }]}>{label}</AppText>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }) {
  const { colors } = useAppTheme();
  const palette = {
    neutral: [colors.backgroundElement, colors.textSecondary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    primary: [colors.primarySoft, colors.primary],
  }[tone];
  return (
    <AppText variant="caption" style={[styles.badge, { backgroundColor: palette[0], color: palette[1] }]}>
      {label}
    </AppText>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.round,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: Fonts.medium, fontSize: 14 },
  badge: {
    fontFamily: Fonts.medium,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.round,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
});
