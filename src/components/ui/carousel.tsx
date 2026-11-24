import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useDirection } from "@/hooks/use-direction";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { motion, radii, screenPadding, spacing, useTheme } from "@/theme";
import { timings } from "@/theme/motion";

/**
 * Horizontal paging carousel with a peek of the next card and page dots.
 * Autoplay pauses while the user is touching and is off under reduce motion.
 */
export function Carousel<T>({
  data,
  renderItem,
  keyExtractor,
  autoplay = true,
  peek = 24,
  accessibilityLabel,
}: {
  data: T[];
  renderItem: (item: T, index: number, width: number) => ReactElement;
  keyExtractor: (item: T) => string;
  autoplay?: boolean;
  peek?: number;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const { isRTL } = useDirection();
  const reduced = useReducedMotion();
  const { width: screen } = useWindowDimensions();
  const itemWidth =
    Math.min(screen, 800) - screenPadding * 2 - (data.length > 1 ? peek : 0);
  const step = itemWidth + spacing[3];
  const list = useRef<FlatList<T>>(null);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = Math.abs(event.nativeEvent.contentOffset.x);
      const next = Math.round(x / step);
      setIndex((current) =>
        current === next
          ? current
          : Math.max(0, Math.min(data.length - 1, next)),
      );
    },
    [data.length, step],
  );

  useEffect(() => {
    if (!autoplay || reduced || touching || data.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % data.length;
        list.current?.scrollToOffset({ offset: next * step, animated: true });
        return next;
      });
    }, motion.carouselAutoplay);
    return () => clearInterval(timer);
  }, [autoplay, data.length, reduced, step, touching]);

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <FlatList
        ref={list}
        data={data}
        horizontal
        inverted={false}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onScrollEndDrag={() => setTouching(false)}
        ItemSeparatorComponent={Separator}
        renderItem={({ item, index: i }) => (
          <View style={{ width: itemWidth }}>
            {renderItem(item, i, itemWidth)}
          </View>
        )}
      />
      {data.length > 1 ? (
        <View
          style={[styles.dots, isRTL && styles.rtl]}
          importantForAccessibility="no-hide-descendants"
        >
          {data.map((item, i) => (
            <Dot
              key={keyExtractor(item)}
              active={i === index}
              on={colors.textPrimary}
              off={colors.border}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const DOT = 6;
const DOT_ACTIVE = 20;

function Dot({
  active,
  on,
  off,
}: {
  active: boolean;
  on: string;
  off: string;
}) {
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, timings.fast);
  }, [active, progress]);
  const style = useAnimatedStyle(() => ({
    width: DOT + (DOT_ACTIVE - DOT) * progress.value,
    backgroundColor: interpolateColor(progress.value, [0, 1], [off, on]),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Separator() {
  return <View style={{ width: spacing[3] }} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[3],
  },
  rtl: { flexDirection: "row-reverse" },
  dot: { height: DOT, borderRadius: radii.pill },
});
