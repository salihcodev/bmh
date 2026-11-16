import { cloneElement, isValidElement, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Fonts, Radii, Spacing, TouchTarget } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * Async-aware button: while the returned promise is pending it shows a spinner
 * and ignores presses, which prevents double submits.
 */
export function Button({
  title,
  icon,
  variant = 'primary',
  loading = false,
  loadingTitle,
  disabled,
  compact = false,
  style,
  onPress,
  ...props
}: Omit<PressableProps, 'style'> & {
  title: string;
  icon?: ReactElement<{ color?: string }>;
  variant?: ButtonVariant;
  loading?: boolean;
  loadingTitle?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const busy = loading || pending;

  const backgroundColor = {
    primary: colors.primary,
    secondary: colors.backgroundElement,
    danger: colors.dangerSoft,
    ghost: 'transparent',
  }[variant];
  const color = {
    primary: colors.onPrimary,
    secondary: colors.text,
    danger: colors.danger,
    ghost: colors.primary,
  }[variant];
  const renderedIcon = isValidElement(icon) ? cloneElement(icon, { color }) : icon;

  const handlePress: NonNullable<PressableProps['onPress']> = async (event) => {
    if (!onPress || busy || lock.current) return;
    const result = onPress(event) as unknown;
    if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') return;
    lock.current = true;
    setPending(true);
    try {
      await result;
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      {...props}
      onPress={handlePress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : renderedIcon}
      <Text style={[styles.text, { color }]}>{busy && loadingTitle ? loadingTitle : title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TouchTarget + 4,
    flexDirection: 'row',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  compact: { minHeight: 44, paddingHorizontal: Spacing.md },
  text: { fontFamily: Fonts.bold, fontSize: 15, textAlign: 'center' },
});
