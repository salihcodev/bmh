import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { iconStroke, motion, radii, sizes, useTheme } from '@/theme';

export type IconButtonVariant = 'outline' | 'filled' | 'ink' | 'lime' | 'ghost';

/**
 * Square-rounded 44x44 icon button (radius 14) as in the reference headers.
 * `round` makes it a circle (call buttons). `mirror` flips directional icons in RTL.
 */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  variant = 'outline',
  round = false,
  mirror = false,
  dot = false,
  disabled,
  size = sizes.iconButton,
  style,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  round?: boolean;
  mirror?: boolean;
  /** Small lime dot (unread). */
  dot?: boolean;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { isRTL } = useDirection();
  const palette = {
    outline: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
    filled: { bg: colors.surfaceMuted, fg: colors.textPrimary, border: colors.surfaceMuted },
    ink: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    lime: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    ghost: { bg: 'transparent', fg: colors.textPrimary, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      hitSlop={Math.max(0, (sizes.minTouch - size) / 2)}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: round ? radii.pill : radii.iconButton,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
        },
        style,
      ]}
    >
      <View style={mirror && isRTL ? styles.mirror : undefined}>
        <Icon size={sizes.icon} color={palette.fg} strokeWidth={iconStroke} />
      </View>
      {dot ? <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: palette.bg }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  mirror: { transform: [{ scaleX: -1 }] },
  dot: { position: 'absolute', top: 8, end: 8, width: 10, height: 10, borderRadius: radii.pill, borderWidth: 2 },
});
