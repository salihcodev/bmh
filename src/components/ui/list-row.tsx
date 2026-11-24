import {
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react-native";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useDirection } from "@/hooks/use-direction";
import { iconStroke, radii, sizes, spacing, useTheme } from "@/theme";
import { timings } from "@/theme/motion";

import { AppText } from "./app-text";
import { Skeleton } from "./skeleton";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Grouped row from the reference: icon in a soft tile, label (+ secondary text),
 * optional value or trailing control, chevron that mirrors in RTL.
 */
export function ListRow({
  icon,
  label,
  hint,
  value,
  right,
  onPress,
  destructive = false,
  disabled = false,
  chevron,
  tile = "muted",
  accessibilityLabel,
  loading = false,
}: {
  icon?: LucideIcon | ReactElement;
  label: string;
  /** Shows a skeleton line instead of the label while it is still loading. */
  loading?: boolean;
  hint?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Defaults to true when the row is pressable. */
  chevron?: boolean;
  tile?: "muted" | "lime" | "none";
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const { isRTL } = useDirection();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const fg = destructive ? colors.danger : colors.textPrimary;
  const iconNode = !icon
    ? null
    : isValidElement(icon)
      ? cloneElement(icon as ReactElement<{ color?: string; size?: number }>, {
          size: sizes.icon,
        })
      : (() => {
          const Icon = icon as LucideIcon;
          return (
            <Icon
              size={sizes.icon}
              color={tile === "lime" ? colors.onAccent : fg}
              strokeWidth={iconStroke}
            />
          );
        })();
  const tileBg = destructive
    ? colors.dangerTint
    : tile === "lime"
      ? colors.accent
      : colors.surfaceMuted;
  const showChevron = chevron ?? !!onPress;
  const pressed = useSharedValue(0);
  const pressedBg = colors.surfaceMuted;
  const pressStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressed.value,
      [0, 1],
      ["transparent", pressedBg],
    ),
  }));
  return (
    <AnimatedPressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        accessibilityLabel ?? [label, value, hint].filter(Boolean).join(", ")
      }
      accessibilityState={{ disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={() => {
        pressed.set(withTiming(1, timings.fast));
      }}
      onPressOut={() => {
        pressed.set(withTiming(0, timings.base));
      }}
      style={[styles.row, { opacity: disabled ? 0.45 : 1 }, pressStyle]}
    >
      {iconNode ? (
        tile === "none" ? (
          <View style={styles.bareIcon}>{iconNode}</View>
        ) : (
          <View style={[styles.tile, { backgroundColor: tileBg }]}>
            {iconNode}
          </View>
        )
      ) : null}
      <View style={styles.text}>
        {loading ? (
          <Skeleton width="55%" height={18} />
        ) : (
          <AppText variant="bodyLg" style={{ color: fg }} numberOfLines={2}>
            {label}
          </AppText>
        )}
        {hint ? (
          <AppText variant="bodySm" muted numberOfLines={2}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="body" muted numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right}
      {showChevron ? (
        <Chevron
          size={sizes.icon}
          color={colors.textTertiary}
          strokeWidth={iconStroke}
        />
      ) : null}
    </AnimatedPressable>
  );
}

/** Legacy name. */
export const NavRow = ({
  danger,
  ...props
}: Parameters<typeof ListRow>[0] & { danger?: boolean }) => (
  <ListRow destructive={danger} {...props} />
);

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.minTouch + spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  tile: {
    width: sizes.iconTile,
    height: sizes.iconTile,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  bareIcon: { width: sizes.iconTile, alignItems: "center" },
  text: { flex: 1, gap: 2 },
  value: { maxWidth: "45%" },
});
