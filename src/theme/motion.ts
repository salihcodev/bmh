import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  type WithTimingConfig,
} from "react-native-reanimated";

import { motion } from "./tokens";

/**
 * Reanimated presets built on the `motion` tokens. Everything is a plain timed fade or slide (no
 * springs), and every preset follows the OS reduce-motion setting (ReduceMotion.System).
 */
const easeOut = Easing.out(Easing.cubic);

export const timings = {
  fast: {
    duration: motion.fast,
    easing: easeOut,
    reduceMotion: ReduceMotion.System,
  },
  base: {
    duration: motion.base,
    easing: easeOut,
    reduceMotion: ReduceMotion.System,
  },
  slow: {
    duration: motion.slow,
    easing: easeOut,
    reduceMotion: ReduceMotion.System,
  },
} satisfies Record<string, WithTimingConfig>;

export const enter = {
  fade: (delay = 0) =>
    FadeIn.duration(motion.base).delay(delay).reduceMotion(ReduceMotion.System),
  /** Fade with a short upward slide. */
  rise: () =>
    FadeInDown.duration(motion.base)
      .easing(easeOut)
      .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
      .reduceMotion(ReduceMotion.System),
};

export const exit = {
  fade: () => FadeOut.duration(motion.fast).reduceMotion(ReduceMotion.System),
};

export const layout = () =>
  LinearTransition.duration(motion.base)
    .easing(easeOut)
    .reduceMotion(ReduceMotion.System);

/** Use for animations Reanimated can't reduce on its own, e.g. infinite `withRepeat` loops. */
export function useMotion() {
  const reduced = useReducedMotion();
  return { reduced };
}
