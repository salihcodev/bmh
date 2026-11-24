import type { ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/localization";
import { elevation, radii, screenPadding, spacing, useTheme } from "@/theme";

import { AppText } from "./app-text";
import { Glass } from "./glass";
import { SurfaceProvider } from "./surface";

/** Bottom sheet: frosted panel, drag handle, radius 28 top corners, dimmed backdrop that closes it. */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content (primary action). */
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            elevation.sheet,
            {
              shadowColor: colors.shadow,
              paddingBottom: insets.bottom + spacing[4],
              backgroundColor:
                Platform.OS === "android" ? colors.glassFallback : undefined,
            },
          ]}
        >
          <Glass pointerEvents="none" solid style={styles.glass} />
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title ? (
            <AppText
              variant="h3"
              accessibilityRole="header"
              center
              style={styles.title}
            >
              {title}
            </AppText>
          ) : null}
          <SurfaceProvider value="raised">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </SurfaceProvider>
        </View>
      </View>
    </Modal>
  );
}

/** Legacy name. */
export const Sheet = BottomSheet;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    marginTop: "auto",
    maxHeight: "88%",
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing[2],
  },
  glass: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: radii.pill,
    marginBottom: spacing[3],
  },
  title: { paddingHorizontal: screenPadding, marginBottom: spacing[3] },
  content: {
    paddingHorizontal: screenPadding,
    gap: spacing[2],
    paddingBottom: spacing[2],
  },
  footer: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing[3],
    gap: spacing[2],
  },
});
