import { cloneElement, isValidElement, type ReactElement } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, iconStroke, motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';

/**
 * Lime circular action at the bottom end of the screen. `extended` adds the label
 * next to the icon; otherwise the label is the accessibility name only.
 */
export function Fab({
  label,
  icon,
  onPress,
  extended = false,
  bottomOffset = 0,
}: {
  label: string;
  icon: ReactElement<{ color?: string; size?: number; strokeWidth?: number }>;
  onPress: () => void;
  extended?: boolean;
  /** Extra space when the screen has a tab bar. */
  bottomOffset?: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const renderedIcon = isValidElement(icon)
    ? cloneElement(icon, { color: colors.onAccent, size: sizes.iconLg, strokeWidth: iconStroke })
    : icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        elevation.floating,
        extended ? styles.extended : styles.circle,
        {
          bottom: spacing[4] + bottomOffset + insets.bottom,
          backgroundColor: colors.accent,
          shadowColor: colors.shadow,
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
        },
      ]}
    >
      {renderedIcon}
      {extended ? (
        <AppText variant="bodyLg" weight="bold" tone="onAccent">
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    end: screenPadding,
    height: sizes.fab,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  circle: { width: sizes.fab },
  extended: { paddingHorizontal: spacing[5] },
});
