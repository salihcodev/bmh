import { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { motion, radii, sizes, spacing, useTheme } from "@/theme";
import { useMotion } from "@/theme/motion";

/**
 * Shows skeletons only if loading lasts longer than `motion.skeletonDelay`, and keeps them
 * for at least `motion.skeletonMinVisible` once shown, so fast loads never flash.
 */
export function useDelayedLoading(loading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, motion.skeletonDelay);
      return () => clearTimeout(timer);
    }
    if (shownAt.current === null) return;
    const remaining = Math.max(
      0,
      motion.skeletonMinVisible - (Date.now() - shownAt.current),
    );
    const timer = setTimeout(() => {
      shownAt.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [loading]);
  return visible;
}

/** Base block with a soft pulse; static when reduce motion is on. */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = radii.xs,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, {
        duration: motion.skeletonShimmer / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [1, 0.55]),
  }));
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.skeletonBase,
        },
        pulseStyle,
        style,
      ]}
    />
  );
}

export function SkeletonText({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.text}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? "60%" : "100%"}
          height={14}
        />
      ))}
    </View>
  );
}

export function SkeletonAvatar({ size = sizes.avatarSm }: { size?: number }) {
  return <Skeleton width={size} height={size} radius={radii.pill} />;
}

export function SkeletonListRow() {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Skeleton
        width={sizes.iconTile}
        height={sizes.iconTile}
        radius={radii.sm}
      />
      <View style={styles.flex}>
        <SkeletonText lines={2} />
      </View>
    </View>
  );
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Skeleton width="40%" height={18} />
      <Skeleton height={height - 60} radius={radii.sm} />
    </View>
  );
}

export function SkeletonBanner() {
  return <Skeleton height={180} radius={radii.xl} />;
}

export function SkeletonStatCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]}>
      <Skeleton width={56} height={28} />
      <Skeleton width="70%" height={12} />
    </View>
  );
}

/** A stack of list-row skeletons, the usual first-page placeholder. */
export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonListRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  text: { gap: spacing[2] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
  },
  card: { borderRadius: radii.xl, padding: spacing[5], gap: spacing[3] },
  stat: {
    flex: 1,
    borderRadius: radii.xl,
    padding: spacing[4],
    gap: spacing[2],
  },
  list: { gap: spacing[2] },
});
