import { useDirection } from "@/hooks/use-direction";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { motion, useTheme } from "@/theme";

/** Shared stack transition: a plain slide in from the reading-direction edge, or a fade under reduce-motion. */
export function useStackScreenOptions() {
  const { isRTL } = useDirection();
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  return {
    headerShown: false as const,
    animation: reduced
      ? ("fade" as const)
      : isRTL
        ? ("slide_from_left" as const)
        : ("slide_from_right" as const),
    animationDuration: motion.slow,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: colors.background },
  };
}
