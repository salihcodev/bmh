import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Copy, ExternalLink, HandHeart, ShieldCheck } from "lucide-react-native";
import { Linking, StyleSheet, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { ScreenHeader } from "@/components/layout/screen-header";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  InlineBanner,
  Screen,
  SkeletonCard,
  useDelayedLoading,
} from "@/components/ui";
import { pick } from "@/domain/marketing";
import type { SupportMethod } from "@/domain/support-method";
import { emitActionFeedback } from "@/lib/action-feedback";
import { isLanguage, useTranslation } from "@/localization";
import { cld } from "@/services/media/cloudinary";
import { SystemMessage } from "@/services/content/system-message";
import { useSupportMethods } from "@/services/marketing/use-marketing";
import {
  iconStroke,
  motion,
  radii,
  screenPadding,
  sizes,
  spacing,
  useTheme,
} from "@/theme";

/**
 * Ways to support the project, from supportMethods (edited in the dashboard). The intro text is the
 * `support_intro` system message when one is published, the app's own text otherwise.
 */
export default function SupportScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const methods = useSupportMethods();
  const showSkeleton = useDelayedLoading(methods.status === "loading");
  const language = isLanguage(i18n.language) ? i18n.language : "ar";

  return (
    <Screen
      header={<ScreenHeader title={t("support.title")} back />}
      contentStyle={styles.content}
    >
      <Card tone="ink" style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.accent }]}>
          <HandHeart size={sizes.iconLg} color={colors.onAccent} strokeWidth={iconStroke} />
        </View>
        <AppText variant="h2" tone="onPrimary">
          {t("support.heroTitle")}
        </AppText>
        <SystemMessage
          messageKey="support_intro"
          fallback={t("support.heroBody")}
          tone="onPrimary"
          plain
        />
      </Card>

      {methods.status === "loading" ? (
        showSkeleton ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null
      ) : methods.status === "error" ? (
        <ErrorState message={t("support.loadFailed")} onRetry={methods.retry} />
      ) : methods.data && methods.data.length > 0 ? (
        <View style={styles.list}>
          {methods.data.map((method) => (
            <MethodCard key={method.id} method={method} language={language} />
          ))}
          <InlineBanner tone="info" message={t("support.directNote")} />
        </View>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={t("support.unavailableTitle")}
          hint={t("support.unavailableHint")}
        />
      )}
    </Screen>
  );
}

function MethodCard({
  method,
  language,
}: {
  method: SupportMethod;
  language: "ar" | "en";
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const qrSize = Math.min(width - screenPadding * 2 - spacing[10] * 2, 220);
  const image = cld(method.imagePublicId, "card");
  const description = pick(method.description, language);
  const label = method.copyLabel ? pick(method.copyLabel, language) : t("support.copyValue");

  const open = (url: string) =>
    Linking.openURL(url).catch(() =>
      emitActionFeedback({ message: t("support.openFailed"), kind: "error" }),
    );
  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    emitActionFeedback({ message: t("support.copied"), kind: "success" });
  };

  return (
    <Card style={styles.method}>
      <AppText variant="h3">{pick(method.title, language)}</AppText>
      {description ? (
        <AppText variant="bodySm" tone="secondary">
          {description}
        </AppText>
      ) : null}
      {image ? (
        <Image
          source={{ uri: image }}
          contentFit="cover"
          cachePolicy="disk"
          transition={motion.base}
          accessibilityLabel={pick(method.title, language)}
          style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
        />
      ) : method.linkUrl ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t("support.qrLabel")}
          style={[styles.qr, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <QRCode
            value={method.linkUrl}
            size={qrSize}
            color={colors.textPrimary}
            backgroundColor={colors.surface}
            ecl="M"
          />
        </View>
      ) : null}
      {method.copyValue ? (
        <View style={[styles.copyRow, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.flex}>
            <AppText variant="caption" tone="secondary">
              {label}
            </AppText>
            <AppText variant="bodyLg" weight="semibold" ltr selectable>
              {method.copyValue}
            </AppText>
          </View>
          <IconButton
            icon={Copy}
            label={t("support.copy")}
            onPress={() => void copy(method.copyValue!)}
          />
        </View>
      ) : null}
      {method.linkUrl ? (
        <Button
          variant="lime"
          title={t("support.open", { name: pick(method.title, language) })}
          icon={<ExternalLink />}
          onPress={() => open(method.linkUrl!)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  flex: { flex: 1 },
  list: { gap: spacing[4] },
  hero: { gap: spacing[3], paddingVertical: spacing[6] },
  heroIcon: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  method: { gap: spacing[3] },
  image: { width: "100%", aspectRatio: 3 / 2, borderRadius: radii.md },
  qr: {
    alignSelf: "center",
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.md,
  },
});
