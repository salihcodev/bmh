import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText } from "@/components/ui";
import {
  pick,
  resolveCta,
  safeGradient,
  type Banner,
  type Language,
} from "@/domain/marketing";
import { useDirection } from "@/hooks/use-direction";
import { usePressScale } from "@/hooks/use-press-scale";
import { bannerSource } from "@/services/media/cloudinary";
import {
  iconStroke,
  motion,
  palette,
  radii,
  sizes,
  spacing,
  useTheme,
} from "@/theme";

import { openCta } from "./open-cta";

export const BANNER_ASPECT = 16 / 9;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Cloudinary art when mapped for this language (it has text baked in, so never the other
 * language's art); otherwise a gradient card with the localized title.
 */
export function BannerCard({
  banner,
  language,
  width,
}: {
  banner: Banner;
  language: Language;
  width: number;
}) {
  const { colors } = useTheme();
  const { isRTL } = useDirection();
  const [failed, setFailed] = useState(false);
  const source = failed ? null : bannerSource(banner, language, width);
  const cta = resolveCta(banner.cta);
  const title = pick(banner.title, language);
  const subtitle = pick(banner.subtitle, language);
  const ctaLabel = banner.cta ? pick(banner.cta.label, language) : "";
  const gradient = safeGradient(
    banner.gradient,
    palette.ink,
    palette.white,
  ) ?? {
    from: colors.accent,
    to: colors.accentPressed,
    text: colors.onAccent,
  };
  const height = width / BANNER_ASPECT;
  const press = usePressScale();

  return (
    <AnimatedPressable
      accessibilityRole={cta ? "button" : "image"}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(". ")}
      accessibilityHint={cta ? ctaLabel || undefined : undefined}
      disabled={!cta}
      onPress={() => openCta(cta)}
      {...press.handlers}
      style={[
        styles.card,
        { width, height, backgroundColor: colors.surfaceMuted },
        press.style,
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source.uri }}
          placeholder={
            source.placeholder ? { uri: source.placeholder } : undefined
          }
          placeholderContentFit="cover"
          contentFit="cover"
          cachePolicy="disk"
          transition={motion.base}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      ) : (
        <LinearGradient
          colors={[gradient.from, gradient.to]}
          start={{ x: isRTL ? 1 : 0, y: 0 }}
          end={{ x: isRTL ? 0 : 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fallback]}
        >
          <View style={styles.copy}>
            <AppText
              variant="h3"
              numberOfLines={2}
              style={{ color: gradient.text }}
            >
              {title}
            </AppText>
            {subtitle ? (
              <AppText
                variant="bodySm"
                numberOfLines={2}
                style={{ color: gradient.text }}
              >
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {cta && ctaLabel ? (
            <View style={[styles.ctaPill, { backgroundColor: colors.primary }]}>
              <AppText
                variant="label"
                weight="semibold"
                style={{ color: colors.onPrimary }}
              >
                {ctaLabel}
              </AppText>
              <ArrowUpRight
                color={colors.onPrimary}
                size={sizes.iconSm}
                strokeWidth={iconStroke}
                style={isRTL ? styles.mirror : undefined}
              />
            </View>
          ) : null}
        </LinearGradient>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, overflow: "hidden" },
  fallback: { padding: spacing[5], justifyContent: "space-between" },
  copy: { gap: spacing[1], maxWidth: "85%" },
  ctaPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    minHeight: sizes.buttonSm - 8,
    paddingHorizontal: spacing[4],
    borderRadius: radii.pill,
  },
  mirror: { transform: [{ scaleX: -1 }] },
});
