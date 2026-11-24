import { SlidersHorizontal } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { useTranslation } from "@/localization";
import { iconStroke, radii, sizes, spacing, useTheme } from "@/theme";
import { enter, exit } from "@/theme/motion";

import { AppText } from "./app-text";
import { Button } from "./button";
import { BottomSheet } from "./sheet";

/**
 * Compact list filter: one 48pt button beside the search bar that opens a sheet with the filter
 * controls. Filters apply live; the badge counts the active ones.
 */
export function FilterButton({
  activeCount,
  onReset,
  title,
  children,
}: {
  activeCount: number;
  onReset: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const active = activeCount > 0;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          active
            ? t("common.filtersActive", { count: activeCount })
            : t("common.filters")
        }
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: active ? colors.primary : colors.surface,
            borderColor: active ? colors.primary : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <SlidersHorizontal
          size={sizes.icon}
          color={active ? colors.onPrimary : colors.textPrimary}
          strokeWidth={iconStroke}
        />
        {active ? (
          <Animated.View
            entering={enter.fade()}
            exiting={exit.fade()}
            style={[
              styles.badge,
              {
                backgroundColor: colors.accent,
                borderColor: colors.background,
              },
            ]}
          >
            <AppText
              variant="caption"
              weight="bold"
              style={{ color: colors.onAccent }}
            >
              {activeCount}
            </AppText>
          </Animated.View>
        ) : null}
      </Pressable>
      <BottomSheet
        visible={open}
        title={title ?? t("common.filters")}
        onClose={() => setOpen(false)}
        footer={
          <View style={styles.footer}>
            <Button
              title={t("common.resetFilters")}
              variant="secondary"
              disabled={!active}
              onPress={onReset}
              style={styles.flex}
            />
            <Button
              title={t("common.showResults")}
              onPress={() => setOpen(false)}
              style={styles.flex}
            />
          </View>
        }
      >
        <View style={styles.body}>{children}</View>
      </BottomSheet>
    </>
  );
}

/** Labeled group of chips inside a FilterButton sheet. */
export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    end: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { width: "100%", gap: spacing[5] },
  group: { width: "100%", alignItems: "flex-start", gap: spacing[2] },
  chips: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: spacing[2],
  },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  flex: { flex: 1 },
});
