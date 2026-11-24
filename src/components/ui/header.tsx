import { router } from "expo-router";
import { ChevronDown, ChevronLeft } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { useTranslation } from "@/localization";
import { iconStroke, screenPadding, sizes, spacing, useTheme } from "@/theme";

import { AppText } from "./app-text";
import { Badge } from "./chip";
import { IconButton } from "./icon-button";

/**
 * Screen header from the reference. Three variants:
 * - bar (default): back button at the start (mirrored in RTL), centered title + subtitle, trailing slot.
 * - `large`: the bar for back/trailing, then a big start-aligned title under it.
 * - `compact`: one row, start-aligned title + subtitle, trailing slot (Home).
 *
 * In the bar, both side slots take the width of the wider one, so the title stays centered and only
 * gets the space between them; it truncates instead of running under the trailing actions (FIX-03).
 * When balancing would leave the title less than `MIN_TITLE`, the slots fall back to their own widths.
 */
const MIN_TITLE = 112;

export function Header({
  title,
  subtitle,
  back = false,
  onBack,
  trailing,
  large = false,
  compact = false,
  collapsed = false,
  tag,
  onTitlePress,
  titleHint,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  trailing?: ReactNode;
  large?: boolean;
  compact?: boolean;
  /** Compact home header after the page has scrolled (UI-04). */
  collapsed?: boolean;
  /** Small lime tag next to the title, e.g. "SUPER ADMIN". */
  tag?: string;
  /** The title is a button (large variant shows a chevron), e.g. the workspace switcher. */
  onTitlePress?: () => void;
  /** Screen-reader hint for `onTitlePress`. */
  titleHint?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [startWidth, setStartWidth] = useState(0);
  const [endWidth, setEndWidth] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const goBack =
    onBack ??
    (() => (router.canGoBack() ? router.back() : router.replace("/")));
  const measure =
    (set: (width: number) => void) => (event: LayoutChangeEvent) => {
      const next = Math.ceil(event.nativeEvent.layout.width);
      set(next);
    };

  const backButton = back ? (
    <IconButton
      icon={ChevronLeft}
      label={t("common.back")}
      onPress={goBack}
      mirror
    />
  ) : null;
  const trailingRow = trailing ? (
    <View style={styles.row}>{trailing}</View>
  ) : null;

  if (large) {
    return (
      <View style={styles.wrap}>
        {back || trailing ? (
          <View style={styles.bar}>
            {backButton}
            <View style={styles.flex} />
            {trailingRow}
          </View>
        ) : null}
        <Pressable
          disabled={!onTitlePress}
          onPress={onTitlePress}
          accessibilityRole={onTitlePress ? "button" : undefined}
          accessibilityHint={onTitlePress ? titleHint : undefined}
          style={styles.large}
        >
          <View style={styles.titleLine}>
            <AppText
              variant="h1"
              accessibilityRole="header"
              numberOfLines={2}
              style={styles.shrink}
            >
              {title}
            </AppText>
            {onTitlePress ? (
              <ChevronDown
                color={colors.textPrimary}
                size={sizes.iconLg}
                strokeWidth={iconStroke}
              />
            ) : null}
            {tag ? <Badge label={tag} tone="lime" /> : null}
          </View>
          {subtitle ? (
            <AppText variant="body" muted numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </Pressable>
      </View>
    );
  }

  if (compact) {
    return (
      <View
        style={[
          styles.wrap,
          styles.bar,
          styles.compact,
          collapsed ? styles.collapsed : null,
        ]}
      >
        {backButton}
        <Pressable
          disabled={!onTitlePress}
          onPress={onTitlePress}
          accessibilityRole={onTitlePress ? "button" : "header"}
          style={styles.compactTitle}
        >
          <View style={styles.titleLine}>
            <AppText
              variant={collapsed ? "h3" : "h2"}
              numberOfLines={1}
              style={styles.shrink}
            >
              {title}
            </AppText>
            {tag ? <Badge label={tag} tone="lime" /> : null}
          </View>
          {subtitle && !collapsed ? (
            <AppText variant="caption" muted numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </Pressable>
        {trailingRow}
      </View>
    );
  }

  const balanced = Math.max(startWidth, endWidth, sizes.iconButton);
  const room = barWidth - screenPadding * 2 - spacing[2] * 2;
  const fits = barWidth === 0 || room - balanced * 2 >= MIN_TITLE;
  const startSide = fits ? balanced : Math.max(startWidth, sizes.iconButton);
  const endSide = fits ? balanced : endWidth;
  return (
    <View style={[styles.wrap, styles.bar]} onLayout={measure(setBarWidth)}>
      <View style={[styles.slot, { width: startSide }]}>
        <View onLayout={measure(setStartWidth)} style={styles.row}>
          {backButton}
        </View>
      </View>
      <Pressable
        disabled={!onTitlePress}
        onPress={onTitlePress}
        accessibilityRole={onTitlePress ? "button" : "header"}
        style={styles.center}
      >
        <View style={styles.titleLine}>
          <AppText variant="h3" numberOfLines={1} center style={styles.shrink}>
            {title}
          </AppText>
          {tag ? <Badge label={tag} tone="lime" /> : null}
        </View>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1} center>
            {subtitle}
          </AppText>
        ) : null}
      </Pressable>
      <View style={[styles.slot, styles.end, { width: endSide }]}>
        <View onLayout={measure(setEndWidth)} style={styles.row}>
          {trailing}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: screenPadding, paddingVertical: spacing[2] },
  bar: {
    minHeight: sizes.iconButton + spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  compact: { paddingBottom: spacing[3] },
  collapsed: {
    minHeight: sizes.iconButton,
    paddingTop: spacing[1],
    paddingBottom: spacing[2],
  },
  slot: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  end: { justifyContent: "flex-end" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexShrink: 0,
  },
  center: { flex: 1, minWidth: 0, alignItems: "center" },
  compactTitle: { flex: 1, minWidth: 0, gap: 2 },
  flex: { flex: 1 },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    maxWidth: "100%",
  },
  shrink: { flexShrink: 1 },
  large: {
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    gap: spacing[1],
  },
});
