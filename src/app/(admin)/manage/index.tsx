import { router, type Href } from 'expo-router';
import {
  BarChart3,
  Image as ImageIcon,
  LayoutTemplate,
  MessageSquare,
  Newspaper,
  ScrollText,
  Settings2,
  Sparkles,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Badge, GroupedList, ListRow, Screen, SectionHeader, SkeletonStatCard, StatCard } from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useTranslation } from '@/localization';
import { usePlatformCounts } from '@/services/admin/use-admin';
import { screenPadding, sizes, spacing } from '@/theme';
import { formatNumber } from '@/utils/format';

type Row = { key: string; icon: LucideIcon; href: Href; count?: number };

export default function ManageHub() {
  const { t } = useTranslation();
  const counts = usePlatformCounts();
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3] * 2) / 3;
  const c = counts.data;

  const sections: { key: string; rows: Row[] }[] = [
    {
      key: 'users',
      rows: [
        { key: 'allUsers', icon: Users, href: '/manage/users', count: c?.users },
        { key: 'suspended', icon: UserX, href: '/manage/users?status=suspended', count: c?.suspended },
      ],
    },
    {
      key: 'content',
      rows: [
        { key: 'banners', icon: LayoutTemplate, href: '/manage/banners', count: c?.banners },
        { key: 'news', icon: Newspaper, href: '/manage/soon/news' },
        { key: 'cards', icon: Sparkles, href: '/manage/soon/cards' },
      ],
    },
    { key: 'media', rows: [{ key: 'media', icon: ImageIcon, href: '/manage/media', count: c?.media }] },
    {
      key: 'reports',
      rows: [
        { key: 'overview', icon: BarChart3, href: '/manage/overview' },
        { key: 'audit', icon: ScrollText, href: '/manage/audit' },
        { key: 'feedback', icon: MessageSquare, href: '/manage/soon/feedback' },
      ],
    },
    {
      key: 'system',
      rows: [
        { key: 'support', icon: Wallet, href: '/manage/soon/support' },
        { key: 'config', icon: Settings2, href: '/manage/soon/config' },
      ],
    },
  ];

  return (
    <Screen header={<AdminHeader title={t('manage.title')} />} contentStyle={styles.content} refreshing={false} onRefresh={counts.retry}>
      <View style={styles.stats}>
        {[
          { k: 'users', v: c?.users },
          { k: 'workspaces', v: c?.workspaces },
          { k: 'banners', v: c?.activeBanners },
        ].map((s, i) => (
          <View key={s.k} style={{ width: tile }}>
            {counts.loading ? (
              <SkeletonStatCard />
            ) : (
              <StatCard
                value={s.v != null ? formatNumber(s.v) : '–'}
                label={t(`manage.stats.${s.k}`)}
                tone={i === 0 ? 'lime' : 'surface'}
              />
            )}
          </View>
        ))}
      </View>

      {sections.map((section) => (
        <View key={section.key}>
          <SectionHeader title={t(`manage.sections.${section.key}`)} />
          <GroupedList>
            {section.rows.map((row) => (
              <ListRow
                key={row.key}
                icon={row.icon}
                label={t(`manage.rows.${row.key}`)}
                hint={t(`manage.rows.${row.key}Hint`)}
                right={row.count != null ? <Badge label={formatNumber(row.count)} tone="neutral" /> : undefined}
                chevron
                onPress={() => router.push(row.href)}
              />
            ))}
          </GroupedList>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  stats: { flexDirection: 'row', gap: spacing[3] },
});
