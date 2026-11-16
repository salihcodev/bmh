import { router } from 'expo-router';
import { FileDown, FileUp, MapPinned, Play, UserPlus, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, NavRow, PressableCard, Row, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { EventRow } from '@/features/history/event-row';
import { useRecentActivity } from '@/features/history/use-recent-activity';
import { usePlaces } from '@/features/places/use-places';
import { ProgressBar } from '@/features/sessions/session-card';
import { useMyActiveSessions } from '@/features/sessions/use-sessions';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { NoWorkspaceScreen } from '@/features/workspaces/no-workspace';
import { useActiveWorkspace, useCan, useWorkspace } from '@/providers/workspace-provider';
import { formatNumber } from '@/utils/format';

function ActivitiesContent() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, workspace, actor } = useActiveWorkspace();
  const places = usePlaces(wid);
  const active = useMyActiveSessions(wid, actor.uid);
  const canHistory = useCan('history_view');
  const canCreate = useCan('beneficiaries_create');
  const canStart = useCan('sessions_create');
  const canImport = useCan('beneficiaries_import');
  const canExport = useCan('beneficiaries_export');
  const recent = useRecentActivity(wid, canHistory);
  const session = active[0];

  const stats = [
    { label: t('home.beneficiaries'), value: workspace?.beneficiaryCount ?? 0, onPress: () => router.push('/beneficiaries') },
    { label: t('home.areas'), value: workspace?.areaCount ?? 0, onPress: () => router.push('/cities') },
    { label: t('home.cities'), value: workspace?.cityCount ?? 0, onPress: () => router.push('/cities') },
    { label: t('home.sessions'), value: workspace?.sessionCount ?? 0, onPress: () => router.push('/sessions') },
  ];

  return (
    <Screen header={<AppHeader title={workspace?.name ?? t('app.name')} subtitle={t('home.welcome', { name: actor.name })} />}>
      <View style={styles.grid}>
        {stats.map((stat) => (
          <PressableCard key={stat.label} onPress={stat.onPress} style={styles.stat}>
            <AppText variant="title" style={{ color: colors.primary }}>
              {formatNumber(stat.value)}
            </AppText>
            <AppText variant="caption" muted>
              {stat.label}
            </AppText>
          </PressableCard>
        ))}
      </View>

      {session ? (
        <Card style={{ gap: Spacing.sm, borderColor: colors.primary }}>
          <AppText variant="heading">{t('home.activeSession', { name: session.name })}</AppText>
          <ProgressBar done={session.checkedCount + session.ignoredCount} total={session.beneficiaryCount} />
          <AppText variant="caption" muted>
            {t('sessions.progress', { done: session.checkedCount + session.ignoredCount, total: session.beneficiaryCount })}
          </AppText>
          <Button title={t('home.resume')} icon={<Play size={18} />} onPress={() => router.push(`/sessions/${session.id}`)} />
        </Card>
      ) : canStart ? (
        <Button title={t('home.startSession')} icon={<Play size={18} />} onPress={() => router.push('/sessions/new')} />
      ) : null}

      <Section title={t('common.more')}>
        <Row wrap>
          {canCreate ? (
            <Button compact variant="secondary" title={t('home.addBeneficiary')} icon={<UserPlus size={16} />} onPress={() => router.push('/beneficiaries/new')} />
          ) : null}
          <Button compact variant="secondary" title={t('home.allBeneficiaries')} icon={<Users size={16} />} onPress={() => router.push('/beneficiaries')} />
          {canImport ? (
            <Button compact variant="secondary" title={t('home.import')} icon={<FileUp size={16} />} onPress={() => router.push('/import')} />
          ) : null}
          {canExport ? (
            <Button compact variant="secondary" title={t('home.export')} icon={<FileDown size={16} />} onPress={() => router.push('/export')} />
          ) : null}
        </Row>
      </Section>

      <Section
        title={t('home.areasTitle')}
        action={<Button compact variant="ghost" title={t('home.manageAreas')} onPress={() => router.push('/cities')} />}
      >
        <Card>
          {places.areas.filter((a) => a.isActive).length === 0 ? <AppText muted>{t('home.noAreas')}</AppText> : null}
          {places.areas
            .filter((a) => a.isActive)
            .slice(0, 8)
            .map((area) => (
              <NavRow
                key={area.id}
                icon={<MapPinned size={20} color={colors.primary} />}
                label={area.name}
                hint={`${area.cityName} · ${t('cities.beneficiaryCount', { count: area.beneficiaryCount ?? 0 })}`}
                onPress={() => router.push(`/areas/${area.id}`)}
              />
            ))}
        </Card>
      </Section>

      {canHistory ? (
        <Section title={t('home.recentActivity')}>
          <Card>
            {recent.length === 0 ? <AppText muted>{t('home.noActivity')}</AppText> : null}
            {recent.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  stat: { flexBasis: '47%', flexGrow: 1, marginBottom: 0, gap: 2 },
});

export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const { workspaceId, member } = useWorkspace();
  if (!workspaceId || !member) return <NoWorkspaceScreen title={t('tabs.activities')} />;
  return <ActivitiesContent />;
}
