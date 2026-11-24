import { cloneElement, isValidElement, type ReactElement } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePressScale } from "@/hooks/use-press-scale";
import {
  elevation,
  iconStroke,
  motion,
  radii,
  screenPadding,
  sizes,
  spacing,
  useTheme,
} from "@/theme";
import { enter } from "@/theme/motion";

import { AppText } from "./app-text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const press = usePressScale({ to: 0.92 });
  const renderedIcon = isValidElement(icon)
    ? cloneElement(icon, {
        color: colors.onAccent,
        size: sizes.iconLg,
        strokeWidth: iconStroke,
      })
    : icon;
  return (
    <Animated.View
      entering={enter.fade(motion.base)}
      style={[
        styles.host,
        { bottom: spacing[4] + bottomOffset + insets.bottom },
      ]}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        {...press.handlers}
        style={[
          styles.fab,
          elevation.floating,
          extended ? styles.extended : styles.circle,
          { backgroundColor: colors.accent, shadowColor: colors.shadow },
          press.style,
        ]}
      >
        {renderedIcon}
        {extended ? (
          <AppText variant="bodyLg" weight="bold" tone="onAccent">
            {label}
          </AppText>
        ) : null}
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", end: screenPadding },
  fab: {
    height: sizes.fab,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  circle: { width: sizes.fab },
  extended: { paddingHorizontal: spacing[5] },
});
