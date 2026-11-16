import { Phone } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { formatPhone } from '@/domain/phone';
import type { Beneficiary } from '@/domain/types';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';

export function BeneficiaryRow({ item, onPress }: { item: Beneficiary; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.main}>
        <AppText variant="label" numberOfLines={1}>
          {item.fullName}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {[item.areaName, item.cityName, t('beneficiaries.household', { count: item.householdCount })]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
      {item.isArchived ? <Badge label={t('beneficiaries.archived')} tone="warning" /> : null}
      {item.primaryPhone ? (
        <View style={styles.phone}>
          <Phone size={14} color={colors.textSecondary} />
          <AppText variant="caption" muted ltr>
            {formatPhone(item.primaryPhone)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    minHeight: 64,
  },
  main: { flex: 1, gap: 2 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
