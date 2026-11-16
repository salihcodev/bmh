import { router, type Href } from 'expo-router';
import {
  ChevronDown,
  ClipboardList,
  FileDown,
  FileUp,
  History,
  MapPin,
  MapPinned,
  Play,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { SyncPill } from '@/components/layout/sync-pill';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Fab,
  GroupedList,
  InlineBanner,
  ListRow,
  PressableCard,
  ProgressBar,
  Screen,
  SectionHeader,
  SkeletonListRow,
  StatCard,
  useDelayedLoading,
} from '@/components/ui';
import { EventRow } from '@/features/history/event-row';
import { useRecentActivity } from '@/features/history/use-recent-activity';
import { usePlaces } from '@/features/places/use-places';
import { useMyActiveSessions } from '@/features/sessions/use-sessions';
import { NoWorkspaceScreen } from '@/features/workspaces/no-workspace';
import { WorkspaceSwitcherSheet } from '@/features/workspaces/workspace-switcher';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan, useWorkspace } from '@/providers/workspace-provider';
import { iconStroke, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';
import { formatNumber } from '@/utils/format';

const AREA_PREVIEW = 6;

function ActivitiesContent() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { wid, workspace, member, actor } = useActiveWorkspace();
  const { memberships } = useWorkspace();
  const places = usePlaces(wid);
  const active = useMyActiveSessions(wid, actor.uid);
  const canHistory = useCan('history_view');
  const canCreate = useCan('beneficiaries_create');
  const canStart = useCan('sessions_create');
  const canImport = useCan('beneficiaries_import');
  const canExport = useCan('beneficiaries_export');
  const canMembers = useCan('members_manage');
  const canSessionHistory = useCan('sessions_view_history');
  const recent = useRecentActivity(wid, canHistory);
  const [switcher, setSwitcher] = useState(false);
  const session = active[0];
  const tile = (Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3]) / 2;
  const areas = places.areas.filter((a) => a.isActive);
  const showAreaSkeleton = useDelayedLoading(places.loading);
  const showActivitySkeleton = useDelayedLoading(recent.events === null && !recent.error);

  const stats = [
    { key: 'beneficiaries', value: workspace?.beneficiaryCount ?? 0, icon: Users, href: '/beneficiaries' as Href },
    { key: 'sessions', value: workspace?.sessionCount ?? 0, icon: ClipboardList, href: '/sessions' as Href },
    { key: 'areas', value: workspace?.areaCount ?? 0, icon: MapPinned, href: '/cities' as Href },
    { key: 'cities', value: workspace?.cityCount ?? 0, icon: MapPin, href: '/cities' as Href },
  ];

  const actions: { key: string; label: string; icon: LucideIcon; href: Href; show: boolean }[] = [
    { key: 'add', label: t('home.addBeneficiary'), icon: UserPlus, href: '/beneficiaries/new', show: canCreate },
    { key: 'all', label: t('home.allBeneficiaries'), icon: Users, href: '/beneficiaries', show: true },
    { key: 'members', label: t('workspace.members'), icon: Users, href: '/members', show: canMembers },
    { key: 'history', label: t('home.sessionsHistory'), icon: History, href: '/sessions', show: canSessionHistory },
    { key: 'import', label: t('home.import'), icon: FileUp, href: '/import', show: canImport },
    { key: 'export', label: t('home.export'), icon: FileDown, href: '/export', show: canExport },
  ];

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${workspace?.name ?? ''}. ${t('activities.switchHint')}`}
        onPress={() => setSwitcher(true)}
        style={styles.titleButton}
      >
        <View style={styles.titleLine}>
          <AppText variant="h1" numberOfLines={1} style={styles.shrink}>
            {workspace?.name ?? t('tabs.activities')}
          </AppText>
          {memberships.length > 0 ? <ChevronDown color={colors.textPrimary} size={sizes.iconLg} strokeWidth={iconStroke} /> : null}
        </View>
        {member ? <Badge label={t(`workspace.role.${member.role}`)} tone="neutral" /> : null}
      </Pressable>
      <SyncPill compact />
    </View>
  );

  return (
    <>
      <Screen header={header} contentStyle={styles.content}>
        <View style={styles.grid}>
          {stats.map((s, i) => (
            <View key={s.key} style={{ width: tile }}>
              <StatCard
                value={formatNumber(s.value)}
                label={t(`home.${s.key}`)}
                icon={s.icon}
                tone={i === 0 ? 'lime' : 'surface'}
                onPress={() => router.push(s.href)}
              />
            </View>
          ))}
        </View>

        {session ? (
          <Card tone="ink" style={styles.sessionCard}>
            <AppText variant="label" tone="onPrimary">
              {t('activities.activeTitle')}
            </AppText>
            <AppText variant="h3" tone="onPrimary" numberOfLines={2}>
              {session.name}
            </AppText>
            <ProgressBar
              value={session.beneficiaryCount ? (session.checkedCount + session.ignoredCount) / session.beneficiaryCount : 0}
              label={t('sessions.progress', { done: session.checkedCount + session.ignoredCount, total: session.beneficiaryCount })}
            />
            <AppText variant="bodySm" tone="onPrimary">
              {t('sessions.progress', { done: session.checkedCount + session.ignoredCount, total: session.beneficiaryCount })}
            </AppText>
            <Button title={t('home.resume')} variant="lime" icon={<Play />} onPress={() => router.push(`/sessions/${session.id}`)} />
          </Card>
        ) : canStart ? (
          <PressableCard tone="lime" accessibilityRole="button" onPress={() => router.push('/sessions/new')} style={styles.startCard}>
            <View style={[styles.startIcon, { backgroundColor: colors.primary }]}>
              <Play color={colors.onPrimary} size={sizes.icon} strokeWidth={iconStroke} />
            </View>
            <View style={styles.flex}>
              <AppText variant="h3" tone="onAccent">
                {t('activities.startTitle')}
              </AppText>
              <AppText variant="bodySm" tone="onAccent">
                {t('activities.startHint')}
              </AppText>
            </View>
          </PressableCard>
        ) : null}

        <View>
          <SectionHeader title={t('activities.actionsTitle')} />
          <GroupedList variant="tiles">
            {actions
              .filter((a) => a.show)
              .map((a) => (
                <ListRow key={a.key} icon={a.icon} label={a.label} chevron onPress={() => router.push(a.href)} />
              ))}
          </GroupedList>
        </View>

        <View>
          <SectionHeader title={t('home.areasTitle')} actionLabel={t('home.manageAreas')} onAction={() => router.push('/cities')} />
          {places.loading ? (
            showAreaSkeleton ? (
              <View style={styles.stack}>
                <SkeletonListRow />
                <SkeletonListRow />
              </View>
            ) : null
          ) : areas.length === 0 ? (
            <EmptyState
              icon={MapPinned}
              title={t('home.noAreas')}
              hint={t('activities.areasHint')}
              actionLabel={canStart || canMembers ? t('home.manageAreas') : undefined}
              onAction={() => router.push('/cities')}
            />
          ) : (
            <GroupedList>
              {areas.slice(0, AREA_PREVIEW).map((area) => (
                <ListRow
                  key={area.id}
                  icon={MapPinned}
                  label={area.name}
                  hint={`${area.cityName} · ${t('cities.beneficiaryCount', { count: area.beneficiaryCount ?? 0 })}`}
                  chevron
                  onPress={() => router.push(`/areas/${area.id}`)}
                />
              ))}
            </GroupedList>
          )}
        </View>

        {canHistory ? (
          <View>
            <SectionHeader title={t('home.recentActivity')} />
            {recent.error ? (
              <InlineBanner tone="danger" message={t('activities.activityFailed')} actionLabel={t('common.retry')} onAction={recent.retry} />
            ) : recent.events === null ? (
              showActivitySkeleton ? <SkeletonListRow /> : null
            ) : recent.events.length === 0 ? (
              <Card>
                <AppText variant="bodySm" tone="secondary" center>
                  {t('home.noActivity')}
                </AppText>
              </Card>
            ) : (
              <Card>
                {recent.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </Card>
            )}
          </View>
        ) : null}
      </Screen>
      {canCreate ? <Fab label={t('activities.addFab')} icon={<UserPlus />} onPress={() => router.push('/beneficiaries/new')} /> : null}
      <WorkspaceSwitcherSheet visible={switcher} onClose={() => setSwitcher(false)} />
    </>
  );
}

export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const { workspaceId, member } = useWorkspace();
  if (!workspaceId || !member) return <NoWorkspaceScreen title={t('tabs.activities')} />;
  return <ActivitiesContent />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: screenPadding,
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  titleButton: { flex: 1, gap: spacing[1], alignItems: 'flex-start' },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], maxWidth: '100%' },
  shrink: { flexShrink: 1 },
  content: { gap: spacing[6] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sessionCard: { gap: spacing[2] },
  startCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  startIcon: { width: sizes.iconButton, height: sizes.iconButton, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  stack: { gap: spacing[2] },
});
