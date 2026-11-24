import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { CalendarClock, Play } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  Fab,
  InlineBanner,
  ListFooter,
  NoPermissionState,
  PressableCard,
  ProgressBar,
  Screen,
  SectionHeader,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { groupByDay, toRows, type DayGroup } from '@/domain/session-history';
import type { Session } from '@/domain/types';
import { useMembers } from '@/features/members/use-members';
import { SessionCard } from '@/features/sessions/session-card';
import { useMyActiveSessions, useSessions } from '@/features/sessions/use-sessions';
import { NoWorkspaceScreen } from '@/features/workspaces/no-workspace';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission, usePermissions, useWorkspace } from '@/providers/workspace-provider';
import { screenPadding, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

function SessionsContent() {
  const { t } = useTranslation();
  const { wid, actor, workspace } = useActiveWorkspace();
  const canCreate = usePermissions('sessions.create', 'sessions.start');
  const canHistory = usePermission('sessions.view');
  const canRun = usePermission('sessions.operate');
  const canSee = canHistory || canRun || canCreate;
  const list = useSessions(wid, actor.uid, canHistory || canRun);
  const active = useMyActiveSessions(wid, actor.uid);
  const members = useMembers(wid);
  const names = useMemo(() => new Map((members ?? []).map((m) => [m.id, m.displayName])), [members]);
  const showSkeleton = useDelayedLoading(list.status === 'loading');

  const rows = useMemo(
    () => toRows(groupByDay(list.items ?? [], (s: Session) => s.createdAt?.toDate() ?? s.clientAt?.toDate()), (s) => s.id),
    [list.items],
  );
  const dayLabel = (group: DayGroup<Session>) =>
    group.kind === 'today' ? t('sessions.today') : group.kind === 'yesterday' ? t('sessions.yesterday') : formatDate(group.date);

  const start = () => router.push('/sessions/new');
  const header = <ScreenHeader title={t('tabs.sessions')} subtitle={workspace?.name} />;

  if (!canSee) {
    return (
      <Screen scroll={false} header={header}>
        <NoPermissionState />
      </Screen>
    );
  }

  const top = (
    <View style={styles.top}>
      {list.fromCache ? <InlineBanner tone="offline" message={t('states.offline')} /> : null}
      {active.map((session) => {
        const done = (session.checkedCount ?? 0) + (session.ignoredCount ?? 0);
        return (
          <PressableCard key={session.id} tone="ink" onPress={() => router.push(`/sessions/${session.id}`)} style={styles.active}>
            <AppText variant="caption" tone="onPrimary">
              {t('sessions.inProgress')}
            </AppText>
            <AppText variant="h3" tone="onPrimary" numberOfLines={1}>
              {session.name}
            </AppText>
            <ProgressBar
              value={session.beneficiaryCount ? done / session.beneficiaryCount : 0}
              label={t('sessions.progress', { done, total: session.beneficiaryCount })}
            />
            <View style={styles.activeFoot}>
              <AppText variant="bodySm" tone="onPrimary" style={styles.flex}>
                {t('sessions.progress', { done, total: session.beneficiaryCount })}
              </AppText>
              <Button compact fullWidth={false} variant="lime" title={t('sessions.resume')} onPress={() => router.push(`/sessions/${session.id}`)} />
            </View>
          </PressableCard>
        );
      })}
      {list.items?.length ? <SectionHeader title={t('sessions.history')} /> : null}
    </View>
  );

  return (
    <Screen scroll={false} header={header}>
      {list.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : list.status === 'error' ? (
        <ErrorState message={t('sessions.historyFailed')} onRetry={list.refresh} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => row.id}
          getItemType={(row) => row.type}
          contentContainerStyle={styles.list}
          ListHeaderComponent={top}
          renderItem={({ item: row }) =>
            row.type === 'header' ? (
              <AppText variant="label" tone="secondary" style={styles.day}>
                {dayLabel(row.group)}
              </AppText>
            ) : (
              <View style={styles.item}>
                <SessionCard
                  session={row.item}
                  operatorName={names.get(row.item.operatorId)}
                  onPress={() => router.push(`/sessions/${row.item.id}`)}
                />
              </View>
            )
          }
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          ListEmptyComponent={
            <EmptyState
              icon={CalendarClock}
              title={t('sessions.empty')}
              hint={t('sessions.emptyHint')}
              actionLabel={canCreate ? t('sessions.start') : undefined}
              onAction={canCreate ? start : undefined}
            />
          }
          ListFooterComponent={
            list.items?.length ? (
              <ListFooter
                loadingMore={list.loadingMore}
                error={list.moreError ? t('states.pageFailed') : null}
                done={list.done}
                onRetry={list.loadMore}
              />
            ) : null
          }
        />
      )}
      {canCreate && list.items?.length ? <Fab label={t('sessions.start')} icon={<Play />} onPress={start} /> : null}
    </Screen>
  );
}

export default function SessionsTab() {
  const { t } = useTranslation();
  const { workspaceId, member } = useWorkspace();
  if (!workspaceId || !member) return <NoWorkspaceScreen title={t('tabs.sessions')} />;
  return <SessionsContent />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[12] * 3 },
  top: { gap: spacing[3], paddingTop: spacing[2] },
  active: { gap: spacing[2] },
  activeFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  day: { paddingTop: spacing[4], paddingBottom: spacing[2] },
  item: { paddingBottom: spacing[3] },
});
