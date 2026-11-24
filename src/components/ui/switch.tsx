import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useDirection } from "@/hooks/use-direction";
import { radii, useTheme } from "@/theme";
import { timings } from "@/theme/motion";

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB = 26;
const PAD = (TRACK_HEIGHT - THUMB) / 2;
const TRAVEL = TRACK_WIDTH - THUMB - PAD * 2;

/** Design-system switch: lime track when on, grey track when off, white thumb in both states. */
export function Switch({
  value,
  onValueChange,
  label,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const { isRTL } = useDirection();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, timings.fast);
  }, [value, progress]);

  const offTrack = colors.switchTrackOff;
  const onTrack = colors.accent;
  const thumb = colors.switchThumbOff;
  const direction = isRTL ? -1 : 1;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [offTrack, onTrack],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: direction * progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onValueChange(!value);
      }}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: thumb, shadowColor: colors.shadow },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    padding: PAD,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1.5,
    shadowOpacity: 0.16,
    elevation: 0,
  },
  disabled: { opacity: 0.4 },
});
