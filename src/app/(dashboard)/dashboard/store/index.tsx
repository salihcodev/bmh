import { router } from 'expo-router';
import { Layers, Package } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen, SectionHeader } from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useTranslation } from '@/localization';
import { useStoreConfig } from '@/services/store/use-store';
import { spacing } from '@/theme';

export default function StoreConfigScreen() {
  const { t } = useTranslation();
  const config = useStoreConfig();

  return (
    <Screen header={<AdminHeader title={t('dashboard.links.storeConfig')} />} contentStyle={styles.content}>
      <SectionHeader title={t('dashboard.links.storeConfig')} />
      <Card style={styles.stats}>
        <StatRow icon={<Layers />} label={t('dashboard.links.storeCategories')} value={String(config.popularItemsCount)} />
        <StatRow icon={<Package />} label={t('store.popularItems')} value={String(config.popularItemsCount)} />
        <StatRow icon={<Package />} label={t('store.popularSuppliers')} value={String(config.popularSuppliersCount)} />
        <StatRow icon={<Package />} label={t('store.topBags')} value={String(config.topBagsCount)} />
      </Card>
      <View style={styles.links}>
        <Button
          title={t('dashboard.links.storeCategories')}
          variant="secondary"
          icon={<Layers />}
          onPress={() => router.push('/dashboard/store/categories')}
        />
        <Button
          title={t('dashboard.links.storeItems')}
          variant="secondary"
          icon={<Package />}
          onPress={() => router.push('/dashboard/store/items')}
        />
      </View>
    </Screen>
  );
}

function StatRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      {icon}
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
      </View>
      <AppText variant="body" weight="semibold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  stats: { gap: spacing[3] },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  links: { gap: spacing[3] },
});
