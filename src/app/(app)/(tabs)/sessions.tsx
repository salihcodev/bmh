import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { useMemo } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { Button, EmptyState, Fab, LoadingState, Screen } from '@/components/ui';
import { useMembers } from '@/features/members/use-members';
import { SessionCard } from '@/features/sessions/session-card';
import { useSessions } from '@/features/sessions/use-sessions';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';

export default function SessionsTab() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, actor, workspace } = useActiveWorkspace();
  const canCreate = useCan('sessions_create');
  const canHistory = useCan('sessions_view_history');
  const canRun = useCan('sessions_run');
  const { sessions, done, loadMore } = useSessions(wid, actor.uid, canHistory || canRun);
  const members = useMembers(wid);
  const names = useMemo(() => new Map((members ?? []).map((m) => [m.id, m.displayName])), [members]);

  return (
    <Screen header={<AppHeader title={t('sessions.title')} subtitle={workspace?.name} />}>
      {sessions === null ? (
        <LoadingState />
      ) : sessions.length === 0 ? (
        <EmptyState title={t('sessions.empty')} />
      ) : (
        <>
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              operatorName={names.get(session.operatorId)}
              onPress={() => router.push(`/(app)/sessions/${session.id}`)}
            />
          ))}
          {!done ? <Button title={t('common.loadMore')} variant="ghost" onPress={loadMore} /> : null}
        </>
      )}
      {canCreate ? (
        <Fab
          label={t('sessions.start')}
          icon={<Play size={20} color={colors.onPrimary} />}
          onPress={() => router.push('/(app)/sessions/new')}
        />
      ) : null}
    </Screen>
  );
}
