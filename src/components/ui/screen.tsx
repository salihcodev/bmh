import { BlurTargetView } from "expo-blur";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { screenPadding, sizes, spacing, useTheme } from "@/theme";
import { enter } from "@/theme/motion";

import { Glass } from "./glass";
import { SurfaceProvider } from "./surface";

/**
 * Grey canvas, safe-area top inset, optional header, 20pt side padding and a footer
 * pinned above the home indicator for the primary CTA.
 * On the canvas, the header floats over the content with a frosted glass fill so
 * rows slide underneath it. White form screens keep a solid header.
 */
export function Screen({
  children,
  scroll = true,
  header,
  footer,
  contentStyle,
  refreshing,
  onRefresh,
  surface = "canvas",
  onCollapsedChange,
}: {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** `white` for focused form screens (auth, onboarding). */
  surface?: "canvas" | "white";
  /** Fires when the scroll offset crosses a short threshold (compact headers). */
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View>(null);
  const [headerHeight, setHeaderHeight] = useState(insets.top);
  const [targetReady, setTargetReady] = useState(false);
  const onScroll = useCollapseScroll(onCollapsedChange);
  const background = surface === "white" ? colors.surface : colors.background;
  const frostedHeader = surface === "canvas" && header != null;
  const frostedFooter = surface === "canvas" && footer != null;
  const contentTop = frostedHeader ? headerHeight : 0;
  return (
    <SurfaceProvider value={surface === "white" ? "raised" : "canvas"}>
      <View
        style={[
          styles.flex,
          {
            backgroundColor: background,
            paddingTop: frostedHeader ? 0 : insets.top,
          },
        ]}
      >
        {frostedHeader ? null : header ? (
          <View style={styles.headerFrame}>{header}</View>
        ) : null}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <BlurTargetView
            ref={blurTarget}
            collapsable={false}
            style={styles.flex}
            onLayout={() => setTargetReady(true)}
          >
            {scroll ? (
              <Animated.ScrollView
                entering={enter.rise()}
                style={styles.flex}
                contentContainerStyle={[
                  styles.scrollContent,
                  contentStyle,
                  contentTop > 0
                    ? { paddingTop: contentTop + spacing[2] }
                    : null,
                ]}
                scrollIndicatorInsets={
                  contentTop > 0 ? { top: contentTop } : undefined
                }
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                refreshControl={
                  onRefresh ? (
                    <RefreshControl
                      refreshing={!!refreshing}
                      onRefresh={onRefresh}
                      tintColor={colors.textSecondary}
                      progressViewOffset={
                        contentTop > 0 ? contentTop : undefined
                      }
                    />
                  ) : undefined
                }
              >
                {children}
              </Animated.ScrollView>
            ) : (
              <Animated.View
                entering={enter.fade()}
                style={[
                  styles.staticContent,
                  contentStyle,
                  contentTop > 0 ? { paddingTop: contentTop + spacing[2] } : null,
                ]}
              >
                {children}
              </Animated.View>
            )}
          </BlurTargetView>
          {footer ? (
            frostedFooter ? (
              <Glass
                edge="top"
                solid
                style={{ paddingBottom: insets.bottom + spacing[3] }}
              >
                <View style={styles.footer}>{footer}</View>
              </Glass>
            ) : (
              <View
                style={[
                  styles.footer,
                  {
                    backgroundColor: background,
                    paddingBottom: insets.bottom + spacing[3],
                  },
                ]}
              >
                {footer}
              </View>
            )
          ) : null}
        </KeyboardAvoidingView>
        {frostedHeader ? (
          <Glass
            edge="bottom"
            blurTarget={targetReady ? blurTarget : undefined}
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              setHeaderHeight((prev) => (prev === next ? prev : next));
            }}
            style={[styles.header, { paddingTop: insets.top }]}
          >
            <View style={styles.headerFrame}>{header}</View>
          </Glass>
        ) : null}
      </View>
    </SurfaceProvider>
  );
}

const COLLAPSE_AT = 16;

function useCollapseScroll(onCollapsedChange?: (collapsed: boolean) => void) {
  const notify = useCallback(
    (value: boolean) => onCollapsedChange?.(value),
    [onCollapsedChange],
  );
  const enabled = useSharedValue(false);
  const collapsed = useSharedValue(false);
  useEffect(() => {
    enabled.value = onCollapsedChange != null;
  }, [enabled, onCollapsedChange]);
  return useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        if (!enabled.value) return;
        const next = event.contentOffset.y > COLLAPSE_AT;
        if (next === collapsed.value) return;
        collapsed.value = next;
        runOnJS(notify)(next);
      },
    },
    [notify],
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    width: "100%",
    maxWidth: sizes.maxContent,
    alignSelf: "center",
    paddingHorizontal: screenPadding,
    paddingTop: spacing[2],
    paddingBottom: 120,
  },
  staticContent: {
    flex: 1,
    width: "100%",
    maxWidth: sizes.maxContent,
    alignSelf: "center",
  },
  footer: {
    width: "100%",
    maxWidth: sizes.maxContent,
    alignSelf: "center",
    paddingHorizontal: screenPadding,
    paddingTop: spacing[3],
    gap: spacing[2],
  },
  // Same column as the content, so header buttons line up with the rows on wide windows.
  headerFrame: {
    width: "100%",
    maxWidth: sizes.maxContent,
    alignSelf: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
});
