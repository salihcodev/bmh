import type { ReactElement } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Fonts, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './app-text';

/** Floating primary action, placed at the bottom end of the screen. */
export function Fab({ label, icon, onPress }: { label: string; icon: ReactElement; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, Shadows, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
    >
      {icon}
      <AppText style={[styles.text, { color: colors.onPrimary }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    end: Spacing.lg,
    bottom: Spacing.lg,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.round,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  text: { fontFamily: Fonts.bold },
});
