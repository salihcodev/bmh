import { Phone } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText, Avatar, Badge } from "@/components/ui";
import { formatPhone } from "@/domain/phone";
import type { Beneficiary } from "@/domain/types";
import { usePressScale } from "@/hooks/use-press-scale";
import { useTranslation } from "@/localization";
import { iconStroke, radii, sizes, spacing, useTheme } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BeneficiaryRow({
  item,
  onPress,
}: {
  item: Beneficiary;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const meta = [
    item.areaName,
    item.cityName,
    t("beneficiaries.household", { count: item.householdCount }),
  ]
    .filter(Boolean)
    .join(" · ");
  const press = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${item.fullName}, ${meta}`}
      onPress={onPress}
      {...press.handlers}
      style={[styles.row, { backgroundColor: colors.surface }, press.style]}
    >
      <Avatar name={item.fullName} size={sizes.avatarSm} />
      <View style={styles.main}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {item.fullName}
        </AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {meta}
        </AppText>
        {item.primaryPhone ? (
          <View style={styles.phone}>
            <Phone
              size={sizes.iconSm - 4}
              color={colors.textTertiary}
              strokeWidth={iconStroke}
            />
            <AppText variant="caption" tone="tertiary" ltr>
              {formatPhone(item.primaryPhone)}
            </AppText>
          </View>
        ) : null}
      </View>
      {item.isArchived ? (
        <Badge label={t("beneficiaries.archived")} tone="warning" />
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    borderRadius: radii.lg,
    padding: spacing[3],
    minHeight: sizes.button + spacing[3],
  },
  main: { flex: 1, gap: spacing[1] / 2 },
  phone: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
});
