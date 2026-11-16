import { router } from 'expo-router';
import { Link2, Trash2, UserPlus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Avatar,
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Fab,
  GroupedList,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { useMemberList, usePendingInvites } from '@/features/members/use-members';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { OfflineError } from '@/services/sync/connectivity';
import { revokeInvite } from '@/services/workspaces/api';
import { sizes, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

export default function MembersScreen() {
  const { t } = useTranslation();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('members_manage');
  const { members, error, retry } = useMemberList(wid);
  const invites = usePendingInvites(wid, canManage);
  const showSkeleton = useDelayedLoading(members === null && !error);
  const [revoking, setRevoking] = useState<string | null>(null);

  const revoke = (code: string) => {
    setRevoking(null);
    revokeInvite(wid, code, actor)
      .then(() => emitActionFeedback({ message: t('members.revoked'), kind: 'success' }))
      .catch((e: unknown) =>
        emitActionFeedback({
          message: e instanceof OfflineError ? t('errors.offline') : errorMessage(e),
          kind: 'error',
        }),
      );
  };

  return (
    <Screen header={<AppHeader title={t('members.title')} back />} contentStyle={styles.content}>
      <View>
        <SectionHeader title={t('members.title')} />
        {error ? (
          <ErrorState message={t('states.loadFailed')} onRetry={retry} />
        ) : members === null ? (
          showSkeleton ? <SkeletonList /> : null
        ) : members.length === 0 ? (
          <EmptyState icon={Users} title={t('common.empty')} />
        ) : (
          <GroupedList>
            {members.map((m) => (
              <ListRow
                key={m.id}
                icon={<Avatar name={m.displayName} size={sizes.avatarSm} />}
                tile="none"
                label={`${m.displayName}${m.id === actor.uid ? ` ${t('members.you')}` : ''}`}
                hint={m.email}
                right={
                  <View style={styles.badges}>
                    <Badge label={t(`workspace.role.${m.role}`)} tone={m.role === 'member' ? 'neutral' : 'ink'} />
                    {m.status === 'disabled' ? <Badge label={t('members.disabled')} tone="danger" /> : null}
                  </View>
                }
                onPress={canManage || m.id === actor.uid ? () => router.push(`/members/${m.id}`) : undefined}
              />
            ))}
          </GroupedList>
        )}
      </View>

      {canManage ? (
        <View>
          <SectionHeader title={t('members.pendingInvites')} />
          {invites.length === 0 ? (
            <Card>
              <AppText variant="bodySm" tone="secondary" center>
                {t('members.noInvites')}
              </AppText>
            </Card>
          ) : (
            <GroupedList>
              {invites.map((invite) => (
                <ListRow
                  key={invite.id}
                  icon={Link2}
                  label={t(`workspace.role.${invite.role}`)}
                  hint={t('members.inviteExpires', { date: formatDate(invite.expiresAt.toDate()) })}
                  right={
                    <IconButton icon={Trash2} variant="ghost" label={t('members.revoke')} onPress={() => setRevoking(invite.id)} />
                  }
                />
              ))}
            </GroupedList>
          )}
        </View>
      ) : null}

      {canManage ? <Fab label={t('members.invite')} icon={<UserPlus />} onPress={() => router.push('/members/invite')} /> : null}

      <ConfirmDialog
        visible={revoking !== null}
        title={t('members.revoke')}
        confirmLabel={t('members.revoke')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) revoke(revoking);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  badges: { alignItems: 'flex-end', gap: spacing[1] },
});
