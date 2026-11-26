/**
 * Be My Hand splash: the only splash implementation in the app.
 *
 * `boot` (cold start, once per JS runtime):
 *   0–400ms    the mark fades in with a short upward slide
 *   with it    three concentric ripples expand behind the mark (UI-02)
 *   then       wordmark + tagline fade in once fonts are ready
 *   hold       the finished mark stays until the app is ready
 *   exit       280ms fade-out over the already-rendered app
 *
 * `hold`: the finished frame with no intro, used while routes load (`BrandLoading`) and over the
 * app during sign-out, so the screen goes straight from the app to the splash and the reload's
 * boot splash continues from the same frame.
 *
 * The native splash image is a blank PNG on the same background, so hiding it on the first
 * laid-out frame is a solid-color hand-off. The intro uses React Native's Animated API
 * (native driver). Ripples use Reanimated on the UI thread. Respects "Reduce Motion":
 * the final frame, with no ripples.
 */
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useTranslation } from "@/localization";
import { detectScript, resolveFontFamily, useTheme } from "@/theme";

import { BrandMark } from "./brand-mark";
import { WaterRipples } from "./water-ripples";

const MARK = 160;
const RIPPLE_HOST = 280;
const SPINNER_DELAY_MS = 1000;

type BootProps = {
  mode: "boot";
  /** true when fonts, auth state and other startup work are done */
  ready: boolean;
  /** true when the brand fonts are loaded (the wordmark waits for them) */
  fontsReady: boolean;
  onFinish: () => void;
  /** safety net: leave even if `ready` never becomes true */
  maxWaitMs?: number;
};

type HoldProps = {
  mode: "hold";
  /** fades in a spinner after a second, for loads that take longer than expected */
  spinner?: boolean;
};

export function Splash(props: BootProps | HoldProps) {
  const { dark, colors } = useTheme();
  const { t } = useTranslation();
  const tagline = t("app.tagline");
  const bg = dark ? colors.background : colors.accent;
  const ink = dark ? colors.textPrimary : colors.onAccent;
  const markColor = dark ? colors.accent : colors.onAccent;

  const reducedMotion = useReducedMotion();
  const hold = props.mode === "hold";
  const [mark] = useState(() => new Animated.Value(hold ? 1 : 0));
  const [wordmark] = useState(() => new Animated.Value(hold ? 1 : 0));
  const [tag] = useState(() => new Animated.Value(hold ? 1 : 0));
  const [fade] = useState(() => new Animated.Value(1));
  const [spinner] = useState(() => new Animated.Value(0));

  useBootTimeline(props, { mark, wordmark, tag, fade });

  const showSpinner = props.mode === "hold" && props.spinner === true;
  useEffect(() => {
    if (!showSpinner) return;
    const timing = Animated.timing(spinner, {
      toValue: 1,
      duration: 200,
      delay: SPINNER_DELAY_MS,
      useNativeDriver: true,
    });
    timing.start();
    return () => timing.stop();
  }, [showSpinner, spinner]);

  // Hide the native splash only after our first frame is laid out → seamless hand-off.
  const nativeHidden = useRef(hold);
  const onLayout = useCallback(() => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const rise = (v: Animated.Value) => ({
    opacity: v,
    transform: [
      {
        translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
      },
    ],
  });

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.root, { backgroundColor: bg, opacity: fade }]}
      accessible
      accessibilityRole={hold ? "progressbar" : undefined}
      accessibilityLabel="Be My Hand"
    >
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={styles.rippleHost}>
        <WaterRipples
          size={MARK}
          color={markColor}
          active={!reducedMotion}
        />
        <Animated.View style={[styles.stage, rise(mark)]}>
          <BrandMark size={MARK} color={markColor} on={bg} />
        </Animated.View>
      </View>
      <Animated.Text
        style={[
          styles.wordmark,
          { color: ink, fontFamily: resolveFontFamily("bold", "latin") },
          rise(wordmark),
        ]}
      >
        Be My Hand
      </Animated.Text>
      <Animated.Text
        style={[
          styles.tagline,
          {
            color: ink,
            fontFamily: resolveFontFamily("regular", detectScript(tagline)),
          },
          rise(tag),
        ]}
      >
        {tagline}
      </Animated.Text>
      {showSpinner ? (
        <Animated.View style={[styles.spinner, { opacity: spinner }]}>
          <ActivityIndicator color={markColor} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

type Values = {
  mark: Animated.Value;
  wordmark: Animated.Value;
  tag: Animated.Value;
  fade: Animated.Value;
};

/** Intro, hold and exit of the boot splash. Does nothing in hold mode. */
function useBootTimeline(props: BootProps | HoldProps, { mark, wordmark, tag, fade }: Values) {
  const boot = props.mode === "boot" ? props : null;
  const active = boot !== null;
  const ready = boot?.ready ?? false;
  const fontsReady = boot?.fontsReady ?? false;
  const onFinish = boot?.onFinish;
  const maxWaitMs = boot?.maxWaitMs ?? 6000;

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const introComplete = reduceMotion === true || introDone;
  const [holdDone, setHoldDone] = useState(false);
  const exiting = useRef(false);

  useEffect(() => {
    if (!active) return;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, [active]);

  useEffect(() => {
    if (!active || reduceMotion === null) return;
    if (reduceMotion) {
      mark.setValue(1);
      return;
    }
    const intro = Animated.timing(mark, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    intro.start(({ finished }) => {
      if (finished) setIntroDone(true);
    });
    return () => intro.stop();
  }, [active, reduceMotion, mark]);

  // Wordmark + tagline wait for fonts so the text never flashes in a fallback font.
  useEffect(() => {
    if (!active || !introComplete || !fontsReady) return;
    if (reduceMotion) {
      wordmark.setValue(1);
      tag.setValue(1);
      return;
    }
    const text = Animated.stagger(100, [
      Animated.timing(wordmark, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tag, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    text.start();
    return () => text.stop();
  }, [active, introComplete, fontsReady, reduceMotion, wordmark, tag]);

  // Let the user see the finished mark for a moment.
  useEffect(() => {
    if (!active || !introComplete || !fontsReady) return;
    const timer = setTimeout(() => setHoldDone(true), reduceMotion ? 500 : 900);
    return () => clearTimeout(timer);
  }, [active, introComplete, fontsReady, reduceMotion]);

  const exit = useCallback(() => {
    if (!onFinish || exiting.current) return;
    exiting.current = true;
    Animated.timing(fade, {
      toValue: 0,
      duration: reduceMotion ? 1 : 280,
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [fade, onFinish, reduceMotion]);

  useEffect(() => {
    if (ready && holdDone) exit();
  }, [ready, holdDone, exit]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(exit, maxWaitMs);
    return () => clearTimeout(timer);
  }, [active, exit, maxWaitMs]);
  // The fade completion can be dropped (native driver, a surface torn down mid-exit).
  // Leave anyway so a failed startup cannot pin the splash for the rest of the session.
  useEffect(() => {
    if (!active || !onFinish) return;
    const timer = setTimeout(onFinish, maxWaitMs + 800);
    return () => clearTimeout(timer);
  }, [active, onFinish, maxWaitMs]);
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
    zIndex: 1000,
  },
  rippleHost: {
    width: RIPPLE_HOST,
    height: RIPPLE_HOST,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    width: MARK,
    height: MARK,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { marginTop: 36, fontSize: 34, letterSpacing: -0.5 },
  tagline: { marginTop: 8, fontSize: 16, opacity: 0.8 },
  spinner: { position: "absolute", bottom: 96 },
});
