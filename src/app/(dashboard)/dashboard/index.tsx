import { Building2, UserX, Users, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Screen, SkeletonStatCard, StatCard } from '@/components/ui';
import { DashboardLinks, DASHBOARD_WIDE } from '@/features/dashboard/links';
import { useTranslation } from '@/localization';
import { usePlatformCounts } from '@/services/admin/use-admin';
import { spacing } from '@/theme';
import { formatNumber } from '@/utils/format';

export default function DashboardHome() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= DASHBOARD_WIDE;
  const counts = usePlatformCounts();
  const c = counts.data;
  const stats: { key: string; value: number | null | undefined; icon: LucideIcon }[] = [
    { key: 'users', value: c?.users, icon: Users },
    { key: 'workspaces', value: c?.workspaces, icon: Building2 },
    { key: 'suspended', value: c?.suspended, icon: UserX },
  ];

  return (
    <Screen
      header={<ScreenHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />}
      contentStyle={styles.content}
      refreshing={counts.loading}
      onRefresh={counts.retry}
    >
      <View style={styles.stats}>
        {stats.map((stat, index) => (
          <View key={stat.key} style={styles.tile}>
            {counts.loading ? (
              <SkeletonStatCard />
            ) : (
              <StatCard
                value={stat.value != null ? formatNumber(stat.value) : '–'}
                label={t(`dashboard.stats.${stat.key}`)}
                icon={stat.icon}
                tone={index === 0 ? 'lime' : 'surface'}
              />
            )}
          </View>
        ))}
      </View>
      {wide ? null : <DashboardLinks />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  stats: { flexDirection: 'row', gap: spacing[2] },
  tile: { flex: 1, minWidth: 0 },
});
