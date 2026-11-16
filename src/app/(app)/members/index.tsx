import { router } from 'expo-router';
import { Link2, Trash2, UserPlus } from 'lucide-react-native';
import { Alert, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Badge, Button, Card, EmptyState, LoadingState, NavRow, Screen, Section } from '@/components/ui';
import { useMembers, usePendingInvites } from '@/features/members/use-members';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { OfflineError } from '@/services/sync/connectivity';
import { revokeInvite } from '@/services/workspaces/api';
import { formatDate } from '@/utils/format';

export default function MembersScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('members_manage');
  const members = useMembers(wid);
  const invites = usePendingInvites(wid, canManage);

  const revoke = (code: string) =>
    Alert.alert(t('members.revoke'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('members.revoke'),
        style: 'destructive',
        onPress: () => {
          revokeInvite(wid, code, actor)
            .then(() => emitActionFeedback({ message: t('members.revoked'), kind: 'success' }))
            .catch((error: unknown) =>
              emitActionFeedback({
                message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
                kind: 'error',
              }),
            );
        },
      },
    ]);

  return (
    <Screen header={<AppHeader title={t('members.title')} back />}>
      {canManage ? (
        <Button
          title={t('members.invite')}
          icon={<UserPlus size={18} />}
          onPress={() => router.push('/(app)/members/invite')}
        />
      ) : null}
      <Section title={t('members.title')}>
        {members === null ? (
          <LoadingState />
        ) : members.length === 0 ? (
          <EmptyState title={t('common.empty')} />
        ) : (
          <Card>
            {members.map((m) => (
              <NavRow
                key={m.id}
                label={`${m.displayName}${m.id === actor.uid ? ` ${t('members.you')}` : ''}`}
                hint={m.email}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={t(`workspace.role.${m.role}`)} tone={m.role === 'member' ? 'neutral' : 'primary'} />
                    {m.status === 'disabled' ? <Badge label={t('members.disabled')} tone="danger" /> : null}
                  </View>
                }
                onPress={canManage || m.id === actor.uid ? () => router.push(`/(app)/members/${m.id}`) : undefined}
              />
            ))}
          </Card>
        )}
      </Section>
      {canManage ? (
        <Section title={t('members.pendingInvites')}>
          {invites.length === 0 ? (
            <AppText muted>{t('members.noInvites')}</AppText>
          ) : (
            <Card>
              {invites.map((invite) => (
                <NavRow
                  key={invite.id}
                  icon={<Link2 size={20} color={colors.primary} />}
                  label={t(`workspace.role.${invite.role}`)}
                  hint={t('members.inviteExpires', { date: formatDate(invite.expiresAt.toDate()) })}
                  right={
                    <Button
                      compact
                      variant="danger"
                      title={t('members.revoke')}
                      icon={<Trash2 size={16} />}
                      onPress={() => revoke(invite.id)}
                    />
                  }
                />
              ))}
            </Card>
          )}
        </Section>
      ) : null}
    </Screen>
  );
}
