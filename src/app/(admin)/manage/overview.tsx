import { Image as ImageIcon, LayoutGrid, LayoutTemplate, UserX, Users } from 'lucide-react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ErrorState, InlineBanner, Screen, SkeletonStatCard, StatCard } from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useTranslation } from '@/localization';
import { usePlatformCounts } from '@/services/admin/use-admin';
import { screenPadding, sizes, spacing } from '@/theme';
import { formatNumber } from '@/utils/format';

export default function ManageOverview() {
  const { t } = useTranslation();
  const counts = usePlatformCounts();
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3]) / 2;
  const c = counts.data;
  const items = [
    { k: 'users', v: c?.users, icon: Users },
    { k: 'suspended', v: c?.suspended, icon: UserX },
    { k: 'workspaces', v: c?.workspaces, icon: LayoutGrid },
    { k: 'banners', v: c?.banners, icon: LayoutTemplate },
    { k: 'media', v: c?.media, icon: ImageIcon },
  ];
  return (
    <Screen header={<AdminHeader title={t('manage.overview.title')} />} contentStyle={styles.content} refreshing={false} onRefresh={counts.retry}>
      {counts.error && !c ? (
        <ErrorState message={t('manage.overview.failed')} onRetry={counts.retry} />
      ) : (
        <View style={styles.grid}>
          {items.map((s, i) => (
            <View key={s.k} style={{ width: tile }}>
              {counts.loading ? (
                <SkeletonStatCard />
              ) : (
                <StatCard
                  value={s.v != null ? formatNumber(s.v) : '–'}
                  label={t(`manage.overview.${s.k}`)}
                  icon={s.icon}
                  tone={i === 0 ? 'lime' : 'surface'}
                />
              )}
            </View>
          ))}
        </View>
      )}
      <InlineBanner tone="info" message={t('manage.overview.note')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
});
