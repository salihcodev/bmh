import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const RINGS = 3;
const DURATION = 2200;
const STAGGER = 700;

/**
 * Concentric ripples behind the splash mark. Scale and opacity run on the UI
 * thread. `active` is false when the OS asks for reduced motion: nothing loops.
 */
export function WaterRipples({
  size,
  color,
  active,
}: {
  size: number;
  color: string;
  active: boolean;
}) {
  if (!active) return null;
  const ring = Math.round(size * 1.15);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: RINGS }, (_, index) => (
        <Ripple key={index} index={index} size={ring} color={color} />
      ))}
    </View>
  );
}

function Ripple({
  index,
  size,
  color,
}: {
  index: number;
  size: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * STAGGER,
      withRepeat(
        withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: (1 - progress.value) * 0.5,
    transform: [{ scale: 0.62 + progress.value * 0.7 }],
  }));
  const inset = -size / 2;

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          marginTop: inset,
          marginStart: inset,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    top: "50%",
    start: "50%",
    borderWidth: 2,
  },
});
