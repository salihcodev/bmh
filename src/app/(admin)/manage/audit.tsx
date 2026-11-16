import { FlashList } from '@shopify/flash-list';
import { Image as ImageIcon, LayoutTemplate, ScrollText, UserCog, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ErrorState, ListFooter, Screen, SkeletonList, useDelayedLoading } from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useTranslation } from '@/localization';
import { useAdminAudit, type AuditEntry } from '@/services/admin/use-admin';
import { iconStroke, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

const ICONS: Record<string, LucideIcon> = { media: ImageIcon, banner: LayoutTemplate, user: UserCog };
const KNOWN = new Set([
  'media_uploaded',
  'media_undone',
  'media_archived',
  'media_restored',
  'banner_created',
  'banner_updated',
  'banner_activated',
  'banner_deactivated',
  'user_suspended',
  'user_reactivated',
]);

export default function ManageAudit() {
  const { t } = useTranslation();
  const audit = useAdminAudit();
  const showSkeleton = useDelayedLoading(audit.status === 'loading');
  return (
    <Screen scroll={false} header={<AdminHeader title={t('manage.audit.title')} />}>
      {audit.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : audit.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={audit.refresh} />
      ) : (
        <FlashList
          data={audit.items ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          onEndReached={audit.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={audit.refreshing}
          onRefresh={audit.refresh}
          renderItem={({ item }) => <AuditRow entry={item} />}
          ListEmptyComponent={<EmptyState icon={ScrollText} title={t('manage.audit.empty')} />}
          ListFooterComponent={
            audit.items?.length ? (
              <ListFooter
                loadingMore={audit.loadingMore}
                error={audit.moreError ? t('states.pageFailed') : null}
                done={audit.done}
                onRetry={audit.loadMore}
              />
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const Icon = ICONS[entry.targetType] ?? ScrollText;
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <View style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
        <Icon color={colors.textPrimary} size={sizes.icon} strokeWidth={iconStroke} />
      </View>
      <View style={styles.body}>
        <AppText variant="body" weight="semibold">
          {t(`manage.audit.actions.${KNOWN.has(entry.action) ? entry.action : 'unknown'}`)}
        </AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {[t('manage.audit.by', { name: entry.actorName || entry.actorId }), entry.createdAt ? formatDateTime(new Date(entry.createdAt)) : '']
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <AppText variant="caption" tone="tertiary" ltr numberOfLines={1}>
          {`${entry.targetType}/${entry.targetId}`}
        </AppText>
      </View>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[10] },
  separator: { height: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg, alignItems: 'center' },
  tile: { width: sizes.iconTile, height: sizes.iconTile, borderRadius: radii.iconButton, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: spacing[1] },
});
