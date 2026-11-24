import type { BottomTabBarProps } from "expo-router/js-tabs";
import * as Haptics from "expo-haptics";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { motion, radii, screenPadding, sizes, spacing, useTheme } from "@/theme";
import { timings } from "@/theme/motion";

import { AppText } from "./app-text";
import { Glass } from "./glass";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const pressTiming: WithTimingConfig = {
  duration: 100,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

type TabModel = {
  key: string;
  name: string;
  params: object | undefined;
  focused: boolean;
  label: string;
  accessibilityLabel: string;
  icon: ReactNode;
};

/**
 * Floating tab bar. The active tab keeps the ink pill, with a small name beside
 * the icon. Inactive tabs are the icon alone. No top rail.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabs: TabModel[] = [];

  state.routes.forEach((route, index) => {
    const options = descriptors[route.key]?.options;
    if (!options || (options as { href?: unknown }).href === null) return;
    const focused = state.index === index;
    const label = typeof options.title === "string" ? options.title : route.name;
    const color = focused
      ? dark
        ? colors.onAccent
        : colors.accent
      : colors.textPrimary;
    tabs.push({
      key: route.key,
      name: route.name,
      params: route.params,
      focused,
      label,
      accessibilityLabel: options.tabBarAccessibilityLabel ?? label,
      icon: options.tabBarIcon?.({ focused, color, size: sizes.icon }) ?? null,
    });
  });

  const open = (tab: TabModel) => {
    const event = navigation.emit({
      type: "tabPress",
      target: tab.key,
      canPreventDefault: true,
    });
    if (!tab.focused && !event.defaultPrevented) {
      Haptics.selectionAsync().catch(() => undefined);
      navigation.navigate(tab.name, tab.params);
    }
  };

  return (
    <View
      style={[
        styles.host,
        {
          paddingBottom: Math.max(insets.bottom, spacing[3]),
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.shell}>
        <Glass radius={radii.xxl} floating edge="none" style={styles.bar}>
          {tabs.map((tab) => (
            <TabItem
              key={tab.key}
              focused={tab.focused}
              label={tab.label}
              accessibilityLabel={tab.accessibilityLabel}
              icon={tab.icon}
              onPress={() => open(tab)}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: tab.key })
              }
            />
          ))}
        </Glass>
      </View>
    </View>
  );
}

function TabItem({
  focused,
  label,
  accessibilityLabel,
  icon,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const scale = useSharedValue(1);
  const focus = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, timings.fast);
  }, [focused, focus]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
  }));
  const labelColor = dark ? colors.onAccent : colors.onPrimary;

  return (
    <AnimatedPressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.set(withTiming(0.96, pressTiming));
      }}
      onPressOut={() => {
        scale.set(withTiming(1, pressTiming));
      }}
      style={[styles.tab, focused && styles.active, pressStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          { backgroundColor: dark ? colors.accent : colors.primary },
          pillStyle,
        ]}
      />
      {icon}
      {focused ? (
        <Animated.View
          entering={FadeIn.duration(motion.fast).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(motion.fast).reduceMotion(ReduceMotion.System)}
          style={styles.label}
        >
          <AppText
            variant="caption"
            weight="medium"
            numberOfLines={1}
            style={[styles.labelText, { color: labelColor }]}
          >
            {label}
          </AppText>
        </Animated.View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  host: { paddingHorizontal: screenPadding, paddingTop: spacing[2] },
  shell: { alignSelf: "center", width: "100%", maxWidth: 560 },
  bar: {
    height: sizes.tabBar,
    borderRadius: radii.xxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[2],
  },
  tab: {
    minWidth: sizes.minTouch,
    height: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    overflow: "hidden",
  },
  active: { flexShrink: 1, paddingHorizontal: spacing[4] },
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
  },
  label: { flexShrink: 1, maxWidth: 96 },
  labelText: { fontSize: 11, lineHeight: 14 },
});
