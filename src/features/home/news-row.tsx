import { Image } from "expo-image";
import { router } from "expo-router";
import { Newspaper, Pin } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText, Tag } from "@/components/ui";
import { pick, type Language, type NewsItem } from "@/domain/marketing";
import { usePressScale } from "@/hooks/use-press-scale";
import { useTranslation } from "@/localization";
import { cloudinaryUrl } from "@/services/media/cloudinary";
import { iconStroke, radii, sizes, spacing, useTheme } from "@/theme";
import { formatDate } from "@/utils/format";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const THUMB = sizes.avatarMd;

export function NewsRow({
  item,
  language,
}: {
  item: NewsItem;
  language: Language;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cover = cloudinaryUrl(item.coverImagePublicId?.[language] ?? null, {
    width: THUMB * 3,
    height: THUMB * 3,
    crop: "fill",
  });
  const title = pick(item.title, language);
  const date = item.publishedAt ? formatDate(new Date(item.publishedAt)) : "";
  const press = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={[title, date].filter(Boolean).join(", ")}
      onPress={() =>
        router.push({ pathname: "/news/[id]", params: { id: item.id } })
      }
      {...press.handlers}
      style={[styles.row, { backgroundColor: colors.surface }, press.style]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="disk"
            accessible={false}
          />
        ) : (
          <Newspaper
            color={colors.textSecondary}
            size={sizes.icon}
            strokeWidth={iconStroke}
          />
        )}
      </View>
      <View style={styles.body}>
        <AppText variant="body" weight="semibold" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="bodySm" tone="secondary" numberOfLines={2}>
          {pick(item.summary, language)}
        </AppText>
        <View style={styles.meta}>
          {item.isPinned ? (
            <View style={styles.pinned}>
              <Pin
                color={colors.textSecondary}
                size={sizes.iconSm}
                strokeWidth={iconStroke}
              />
              <Tag label={t("news.pinned")} tone="lime" />
            </View>
          ) : null}
          {date ? (
            <AppText variant="caption" tone="tertiary">
              {date}
            </AppText>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    alignItems: "flex-start",
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: spacing[1] },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[1],
  },
  pinned: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
});
