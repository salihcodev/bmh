import { BlurView, type BlurViewProps } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type RefObject } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { elevation, glassBlur, spacing, useTheme } from "@/theme";

type Edge = "all" | "top" | "bottom" | "none";

/**
 * Frosted surface: backdrop blur, a translucent tint and a light rim.
 * Light mode adds a short top sheen. Dark mode stays a solid tint over the blur (UI-01).
 * Pass `blurTarget` on Android so the blur samples the content behind the chrome.
 * `solid` is the stronger frost used under body text (sheets, pinned footers).
 */
export function Glass({
  children,
  style,
  radius,
  solid = false,
  edge = "all",
  floating = false,
  blurTarget,
  ...rest
}: ViewProps & {
  radius?: number;
  solid?: boolean;
  edge?: Edge;
  floating?: boolean;
  blurTarget?: RefObject<View | null>;
}) {
  const { colors, dark } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const flat = StyleSheet.flatten(style) ?? {};
  const clip: ViewStyle = {
    borderRadius: radius ?? flat.borderRadius,
    borderTopLeftRadius: flat.borderTopLeftRadius,
    borderTopRightRadius: flat.borderTopRightRadius,
    borderBottomLeftRadius: flat.borderBottomLeftRadius,
    borderBottomRightRadius: flat.borderBottomRightRadius,
    overflow: "hidden",
  };
  const rim =
    edge === "none"
      ? null
      : edge === "bottom"
        ? {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.glassEdge,
          }
        : edge === "top"
          ? {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.glassEdge,
            }
          : {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.glassBorder,
            };
  const sheen =
    !dark && colors.glassSheen && colors.glassSheenEnd
      ? ([colors.glassSheen, colors.glassSheenEnd] as const)
      : null;
  const blurMethod: BlurViewProps["blurMethod"] =
    Platform.OS === "android"
      ? blurTarget
        ? "dimezisBlurViewSdk31Plus"
        : "none"
      : undefined;

  return (
    <View
      {...rest}
      style={[
        floating ? elevation.floating : null,
        radius != null ? { borderRadius: radius } : null,
        floating ? { shadowColor: colors.shadow } : null,
        floating && Platform.OS === "android"
          ? { backgroundColor: colors.glassFallback }
          : null,
        rim,
        style,
      ]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, clip]}>
        {reduceTransparency ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.glassFallback },
            ]}
          />
        ) : (
          <BlurView
            intensity={solid ? glassBlur.strong : glassBlur.regular}
            tint={dark ? "dark" : "light"}
            blurMethod={blurMethod}
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
          />
        )}
        {reduceTransparency ? null : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: solid
                  ? colors.glassFillStrong
                  : colors.glassFill,
              },
            ]}
          />
        )}
        {sheen && edge !== "none" ? (
          <LinearGradient colors={[sheen[0], sheen[1]]} style={styles.sheen} />
        ) : null}
      </View>
      {children}
    </View>
  );
}

function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    const query = AccessibilityInfo.isReduceTransparencyEnabled?.();
    if (query) {
      void query.then((value) => {
        if (mounted) setReduce(value);
      });
    }
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduce,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

const styles = StyleSheet.create({
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: spacing[8],
  },
});
