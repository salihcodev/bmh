import {
  cloneElement,
  isValidElement,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";

import { usePressScale } from "@/hooks/use-press-scale";
import { iconStroke, radii, sizes, spacing, useTheme } from "@/theme";
import { enter } from "@/theme/motion";

import { AppText } from "./app-text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant =
  "primary" | "secondary" | "lime" | "ghost" | "destructive" | "danger";

/**
 * Pill button. `primary` is ink with white text in light mode and lime with ink text in dark mode.
 * Async-aware: while the returned promise is pending it shows a spinner and ignores presses.
 */
export function Button({
  title,
  icon,
  variant = "primary",
  loading = false,
  loadingTitle,
  disabled,
  compact = false,
  fullWidth = true,
  style,
  onPress,
  ...props
}: Omit<PressableProps, "style"> & {
  title: string;
  icon?: ReactElement<{ color?: string; size?: number; strokeWidth?: number }>;
  variant?: ButtonVariant;
  loading?: boolean;
  loadingTitle?: string;
  /** 44pt height instead of 56. */
  compact?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const busy = loading || pending;
  const press = usePressScale({
    onPressIn: props.onPressIn,
    onPressOut: props.onPressOut,
  });
  const kind = variant === "danger" ? "destructive" : variant;

  const palette = {
    primary: {
      bg: colors.primary,
      fg: colors.onPrimary,
      border: colors.primary,
    },
    secondary: {
      bg: colors.surface,
      fg: colors.textPrimary,
      border: colors.border,
    },
    lime: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    ghost: { bg: "transparent", fg: colors.textPrimary, border: "transparent" },
    destructive: {
      bg: colors.dangerTint,
      fg: colors.danger,
      border: colors.dangerTint,
    },
  }[kind];
  const renderedIcon = isValidElement(icon)
    ? cloneElement(icon, {
        color: palette.fg,
        size: sizes.icon,
        strokeWidth: iconStroke,
      })
    : icon;

  const handlePress: NonNullable<PressableProps["onPress"]> = async (event) => {
    if (!onPress || busy || lock.current) return;
    const result = onPress(event) as unknown;
    if (!result || typeof (result as PromiseLike<unknown>).then !== "function")
      return;
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
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      {...props}
      {...press.handlers}
      onPress={handlePress}
      disabled={disabled || busy}
      style={[
        styles.button,
        compact && styles.compact,
        !fullWidth && styles.inline,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
        press.style,
      ]}
    >
      {busy ? (
        <Animated.View entering={enter.fade()}>
          <ActivityIndicator size="small" color={palette.fg} />
        </Animated.View>
      ) : renderedIcon ? (
        <View>{renderedIcon}</View>
      ) : null}
      <AppText
        variant="bodyLg"
        weight="bold"
        style={{ color: palette.fg }}
        numberOfLines={1}
      >
        {busy && loadingTitle ? loadingTitle : title}
      </AppText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.button,
    flexDirection: "row",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[6],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  compact: { minHeight: sizes.buttonSm, paddingHorizontal: spacing[4] },
  inline: { alignSelf: "flex-start" },
});
