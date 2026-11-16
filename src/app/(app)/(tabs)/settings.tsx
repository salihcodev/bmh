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
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Badge, Card, NavRow, PressableCard, Screen, Section } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useCan, useWorkspace } from '@/providers/workspace-provider';
import { isOwner, isOwnerOrAdmin } from '@/services/permissions/can';
import { OfflineError } from '@/services/sync/connectivity';
import { leaveWorkspace } from '@/services/workspaces/api';
import { iconStroke, sizes, spacing } from '@/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { signOut } = useSignOut();
  const { memberships, workspaces, workspaceId, workspace, member, actor, switchWorkspace } = useWorkspace();
  const canManageMembers = useCan('members_manage');
  const canManageAreas = useCan('areas_manage');
  const canImport = useCan('beneficiaries_import');
  const canExport = useCan('beneficiaries_export');
  const canHistory = useCan('sessions_view_history');
  const iconColor = colors.primary;
  const { isSuperAdmin } = useCurrentUser();

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
    <Screen header={<AppHeader title={t('tabs.settings')} subtitle={workspace?.name} />}>
      {isSuperAdmin ? <ManageCard /> : null}
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
            onPress={() => router.push('/members')}
          />
          <NavRow
            icon={<MapPinned size={20} color={iconColor} />}
            label={t('workspace.cities')}
            hint={canManageAreas ? undefined : t('common.viewDetails')}
            onPress={() => router.push('/cities')}
          />
          {canHistory ? (
            <NavRow
              icon={<History size={20} color={iconColor} />}
              label={t('home.sessionsHistory')}
              onPress={() => router.push('/sessions')}
            />
          ) : null}
          {canImport ? (
            <NavRow
              icon={<FileUp size={20} color={iconColor} />}
              label={t('import.title')}
              onPress={() => router.push('/import')}
            />
          ) : null}
          {canExport ? (
            <NavRow
              icon={<FileDown size={20} color={iconColor} />}
              label={t('export.title')}
              onPress={() => router.push('/export')}
            />
          ) : null}
          {isOwnerOrAdmin(member) || canManageMembers ? (
            <NavRow
              icon={<ScrollText size={20} color={iconColor} />}
              label={t('workspace.auditLog')}
              onPress={() => router.push('/audit')}
            />
          ) : null}
          {isOwnerOrAdmin(member) ? (
            <NavRow
              icon={<Building2 size={20} color={iconColor} />}
              label={t('workspace.settings')}
              onPress={() => router.push('/workspace')}
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
            onPress={() => router.push('/appearance')}
          />
          <NavRow icon={<LogOut size={20} color={colors.danger} />} label={t('auth.signOut')} danger onPress={signOut} />
        </Card>
      </Section>
    </Screen>
  );
}

/** Super admin entry to /manage, first in Settings. The (admin) guard and the rules enforce access. */
function ManageCard() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <PressableCard
      tone="ink"
      accessibilityRole="button"
      accessibilityLabel={t('manage.entryTitle')}
      onPress={() => router.push('/manage')}
      style={styles.manage}
    >
      <ShieldCheck size={sizes.iconLg} color={colors.onPrimary} strokeWidth={iconStroke} />
      <View style={styles.manageBody}>
        <View style={styles.manageTitle}>
          <AppText variant="h3" tone="onPrimary">
            {t('manage.entryTitle')}
          </AppText>
          <Badge label={t('manage.tag')} tone="lime" />
        </View>
        <AppText variant="bodySm" tone="onPrimary">
          {t('manage.entryHint')}
        </AppText>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  manage: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] },
  manageBody: { flex: 1, gap: spacing[1] },
  manageTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
});
