import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';

/**
 * Floating white tab bar (72pt, radius 28). The active tab gets an ink pill with its label;
 * inactive tabs are icon-only with the label kept for screen readers.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing[3]), backgroundColor: colors.background }]}>
      <View style={[styles.bar, elevation.floating, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options;
          if (!options || (options as { href?: unknown }).href === null) return null;
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.onPrimary : colors.textSecondary;
          const icon = options.tabBarIcon?.({ focused, color, size: sizes.icon });
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={[styles.tab, focused && [styles.active, { backgroundColor: colors.primary }]]}
            >
              {icon}
              {focused ? (
                <AppText variant="label" weight="bold" numberOfLines={1} style={{ color }}>
                  {label}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { paddingHorizontal: screenPadding, paddingTop: spacing[2] },
  bar: {
    height: sizes.tabBar,
    borderRadius: radii.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  tab: {
    minWidth: sizes.minTouch + 8,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
  },
  active: { flexShrink: 1, paddingHorizontal: spacing[4] },
});
