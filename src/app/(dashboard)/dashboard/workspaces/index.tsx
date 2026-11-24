import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Building2, ListChecks, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  ListFooter,
  Screen,
  SearchBar,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { setWorkspaceArchived } from '@/services/admin/admin-writes';
import { useDashboardWorkspaces, type DashboardWorkspace } from '@/services/admin/use-admin';
import { radii, screenPadding, spacing, useTheme } from '@/theme';
import { formatNumber } from '@/utils/format';

type Filter = 'active' | 'archived' | 'deleted';

export default function WorkspacesRoute() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('workspaces.view')} fallback="/dashboard">
      <WorkspacesScreen />
    </PermissionGate>
  );
}

function WorkspacesScreen() {
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const { run } = useAdminAction();
  const page = useDashboardWorkspaces();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const showSkeleton = useDelayedLoading(page.status === 'loading');
  const canArchive = can('workspaces.archive');
  const needle = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (page.items ?? []).filter((item) => {
        if (filter === 'deleted') return item.isDeleted;
        if (item.isDeleted) return false;
        if (filter === 'archived' && !item.isArchived) return false;
        if (filter === 'active' && item.isArchived) return false;
        return !needle || item.name.toLowerCase().includes(needle);
      }),
    [filter, needle, page.items],
  );

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title={t('dashboard.workspacesTitle')}
          back
          actions={
            canArchive ? (
              <IconButton
                icon={selecting ? X : ListChecks}
                variant={selecting ? 'ink' : 'outline'}
                label={selecting ? t('dashboard.doneSelecting') : t('dashboard.select')}
                onPress={() => {
                  setSelecting((value) => !value);
                  setPicked([]);
                }}
              />
            ) : undefined
          }
        />
      }
      footer={
        selecting && picked.length > 0 ? (
          <Button title={t('dashboard.bulkArchive', { count: picked.length })} onPress={() => setConfirm(true)} />
        ) : undefined
      }
    >
      <View style={styles.tools}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('dashboard.workspaceSearch')} />
        <View style={styles.chips}>
          {(['active', 'archived', 'deleted'] as const).map((item) => (
            <Chip key={item} label={t(`dashboard.workspaceFilter.${item}`)} selected={filter === item} onPress={() => setFilter(item)} />
          ))}
        </View>
      </View>
      {page.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : page.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={page.refresh} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={page.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={page.refreshing}
          onRefresh={page.refresh}
          renderItem={({ item }) => (
            <WorkspaceRow
              item={item}
              selected={picked.includes(item.id)}
              selecting={selecting && !item.isDeleted}
              onPress={() => {
                if (selecting && !item.isDeleted) {
                  setPicked((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]));
                  return;
                }
                router.push(`/dashboard/workspaces/${item.id}`);
              }}
            />
          )}
          ListEmptyComponent={<EmptyState icon={Building2} title={t('dashboard.workspacesEmpty')} />}
          ListFooterComponent={
            page.items?.length ? (
              <ListFooter loadingMore={page.loadingMore} error={page.moreError ? t('states.pageFailed') : null} done={page.done} onRetry={page.loadMore} />
            ) : null
          }
        />
      )}
      <ConfirmDialog
        visible={confirm}
        title={t('dashboard.bulkArchiveTitle', { count: picked.length })}
        message={t('dashboard.archiveBody')}
        confirmLabel={t('dashboard.archive')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const ids = picked;
          setConfirm(false);
          for (const id of ids) {
            const label = (page.items ?? []).find((item) => item.id === id)?.name;
            const ok = await run((actor) => setWorkspaceArchived(actor, id, true, label), undefined);
            if (!ok) return;
          }
          setPicked([]);
          setSelecting(false);
        }}
      />
    </Screen>
  );
}

function WorkspaceRow({
  item,
  selected,
  selecting,
  onPress,
}: {
  item: DashboardWorkspace;
  selected: boolean;
  selecting: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border }]}>
      <View style={styles.body}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {t('dashboard.workspaceCounts', {
            beneficiaries: formatNumber(item.beneficiaryCount),
            sessions: formatNumber(item.sessionCount),
          })}
        </AppText>
      </View>
      {item.isDeleted ? <Badge label={t('dashboard.deleted')} tone="danger" /> : null}
      {item.isArchived && !item.isDeleted ? <Badge label={t('dashboard.workspaceFilter.archived')} tone="warning" /> : null}
      {selecting ? <Badge label={selected ? t('dashboard.selected') : t('dashboard.select')} tone={selected ? 'lime' : 'neutral'} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tools: { gap: spacing[3], paddingHorizontal: screenPadding, paddingBottom: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[10], gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: spacing[1] },
});
