import type { GestureResponderEvent } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/theme";
import { timings } from "@/theme/motion";

type PressHandler = ((event: GestureResponderEvent) => void) | null | undefined;

/**
 * Press-in scale for pressables. Spread `handlers` on the pressable (it chains the caller's
 * own onPressIn/onPressOut) and put `style` on an Animated view or AnimatedPressable.
 */
export function usePressScale({
  to = motion.pressScale,
  onPressIn,
  onPressOut,
}: { to?: number; onPressIn?: PressHandler; onPressOut?: PressHandler } = {}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return {
    style,
    handlers: {
      onPressIn: (event: GestureResponderEvent) => {
        scale.set(withTiming(to, timings.fast));
        onPressIn?.(event);
      },
      onPressOut: (event: GestureResponderEvent) => {
        scale.set(withTiming(1, timings.fast));
        onPressOut?.(event);
      },
    },
  };
}
