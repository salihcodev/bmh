import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing, TouchTarget } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDirection } from '@/hooks/use-direction';

import { AppText } from './app-text';

export function NavRow({
  icon,
  label,
  hint,
  right,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon?: ReactElement;
  label: string;
  hint?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const { isRTL } = useDirection();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.text}>
        <AppText style={danger ? { color: colors.danger } : undefined}>{label}</AppText>
        {hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      {right}
      {onPress ? <Chevron size={20} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: TouchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 28, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
