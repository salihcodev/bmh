import { router } from 'expo-router';
import {
  Building2,
  Check,
  FileDown,
  FileUp,
  History,
  LogOut,
  MapPinned,
  Plus,
  ScrollText,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { Alert } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { Badge, Card, NavRow, Screen, Section } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useCan, useWorkspace } from '@/providers/workspace-provider';
import { isOwner, isOwnerOrAdmin } from '@/services/permissions/can';
import { OfflineError } from '@/services/sync/connectivity';
import { leaveWorkspace } from '@/services/workspaces/api';

export default function MoreScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { signOutUser } = useAuth();
  const { memberships, workspaces, workspaceId, workspace, member, actor, switchWorkspace } = useWorkspace();
  const canManageMembers = useCan('members_manage');
  const canManageAreas = useCan('areas_manage');
  const canImport = useCan('beneficiaries_import');
  const canExport = useCan('beneficiaries_export');
  const canHistory = useCan('sessions_view_history');
  const iconColor = colors.primary;

  const leave = () => {
    if (!workspaceId || !actor) return;
    if (isOwner(member)) {
      emitActionFeedback({ message: t('workspace.ownerCannotLeave'), kind: 'warning' });
      return;
    }
    Alert.alert(t('workspace.leave'), t('workspace.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workspace.leave'),
        style: 'destructive',
        onPress: () => {
          leaveWorkspace(workspaceId, actor)
            .then(() => emitActionFeedback({ message: t('workspace.left'), kind: 'success' }))
            .catch((error: unknown) =>
              emitActionFeedback({
                message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
                kind: 'error',
              }),
            );
        },
      },
    ]);
  };

  return (
    <Screen header={<AppHeader title={t('tabs.more')} subtitle={workspace?.name} />}>
      <Section title={t('workspace.mine')}>
        <Card>
          {memberships.map(({ workspaceId: wid, member: m }) => (
            <NavRow
              key={wid}
              icon={<Building2 size={20} color={iconColor} />}
              label={workspaces[wid]?.name ?? '…'}
              hint={t(`workspace.role.${m.role}`)}
              right={wid === workspaceId ? <Check size={20} color={colors.success} /> : undefined}
              onPress={wid === workspaceId ? undefined : () => switchWorkspace(wid)}
            />
          ))}
          <NavRow
            icon={<Plus size={20} color={iconColor} />}
            label={t('workspace.create')}
            onPress={() => router.push('/onboarding/create')}
          />
          <NavRow
            icon={<UserPlus size={20} color={iconColor} />}
            label={t('workspace.join')}
            onPress={() => router.push('/join')}
          />
        </Card>
      </Section>

      <Section title={workspace?.name ?? ''} action={member ? <Badge label={t(`workspace.role.${member.role}`)} tone="primary" /> : null}>
        <Card>
          <NavRow
            icon={<Users size={20} color={iconColor} />}
            label={t('workspace.members')}
            onPress={() => router.push('/(app)/members')}
          />
          <NavRow
            icon={<MapPinned size={20} color={iconColor} />}
            label={t('workspace.cities')}
            hint={canManageAreas ? undefined : t('common.viewDetails')}
            onPress={() => router.push('/(app)/cities')}
          />
          {canHistory ? (
            <NavRow
              icon={<History size={20} color={iconColor} />}
              label={t('home.sessionsHistory')}
              onPress={() => router.push('/(app)/(tabs)/sessions')}
            />
          ) : null}
          {canImport ? (
            <NavRow
              icon={<FileUp size={20} color={iconColor} />}
              label={t('import.title')}
              onPress={() => router.push('/(app)/import')}
            />
          ) : null}
          {canExport ? (
            <NavRow
              icon={<FileDown size={20} color={iconColor} />}
              label={t('export.title')}
              onPress={() => router.push('/(app)/export')}
            />
          ) : null}
          {isOwnerOrAdmin(member) || canManageMembers ? (
            <NavRow
              icon={<ScrollText size={20} color={iconColor} />}
              label={t('workspace.auditLog')}
              onPress={() => router.push('/(app)/audit')}
            />
          ) : null}
          {isOwnerOrAdmin(member) ? (
            <NavRow
              icon={<Building2 size={20} color={iconColor} />}
              label={t('workspace.settings')}
              onPress={() => router.push('/(app)/workspace')}
            />
          ) : null}
          {!isOwner(member) ? (
            <NavRow icon={<LogOut size={20} color={colors.danger} />} label={t('workspace.leave')} danger onPress={leave} />
          ) : null}
        </Card>
      </Section>

      <Section title={t('settings.account')}>
        <Card>
          <NavRow
            icon={<Settings size={20} color={iconColor} />}
            label={t('settings.title')}
            hint={actor?.email}
            onPress={() => router.push('/(app)/settings')}
          />
          <NavRow icon={<LogOut size={20} color={colors.danger} />} label={t('auth.signOut')} danger onPress={signOutUser} />
        </Card>
      </Section>
    </Screen>
  );
}
