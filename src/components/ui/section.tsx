import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { spacing } from "@/theme";

import { AppText } from "./app-text";

/** Bold title on the start side, small action link ("See all", "Edit") on the end side. Carries its own bottom spacing. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  action,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.header, style]}>
      <AppText
        variant="h2"
        accessibilityRole="header"
        style={styles.title}
        numberOfLines={2}
      >
        {title}
      </AppText>
      {action}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={12}
          style={styles.link}
        >
          <AppText variant="bodySm" weight="bold">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Section({
  title,
  action,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        action={action}
        actionLabel={actionLabel}
        onAction={onAction}
        style={styles.flush}
      />
      {children}
    </View>
  );
}

export function Row({
  children,
  gap = spacing[2],
  wrap = false,
  style,
}: {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.row, { gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing[6], gap: spacing[3] },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  flush: { marginBottom: 0 },
  title: { flexShrink: 1 },
  link: { minHeight: 32, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center" },
});
