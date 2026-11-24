import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { radii, spacing, useTheme } from "@/theme";
import { enter, exit, layout } from "@/theme/motion";

/**
 * Rows grouped in one white rounded card with hairline dividers (settings reference),
 * or `tiles`: each row its own rounded tile with a gap (options-list reference).
 */
export function GroupedList({
  children,
  variant = "card",
  style,
}: {
  children: ReactNode;
  variant?: "card" | "tiles";
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  if (variant === "tiles") {
    return (
      <View style={[styles.tiles, style]}>
        {items.map((child, index) => (
          <Animated.View
            key={child.key ?? index}
            entering={enter.rise()}
            layout={layout()}
            style={[styles.tile, { backgroundColor: colors.surface }]}
          >
            {child}
          </Animated.View>
        ))}
      </View>
    );
  }
  return (
    <Animated.View
      layout={layout()}
      style={[styles.card, { backgroundColor: colors.surface }, style]}
    >
      {items.map((child, index) => (
        <Animated.View
          key={child.key ?? index}
          entering={enter.fade()}
          exiting={exit.fade()}
          layout={layout()}
        >
          {index > 0 ? (
            <View
              style={[styles.divider, { backgroundColor: colors.divider }]}
            />
          ) : null}
          {child}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, overflow: "hidden" },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginStart: spacing[4] + 40 + spacing[3],
  },
  tiles: { gap: spacing[2] },
  tile: { borderRadius: radii.lg, overflow: "hidden" },
});
