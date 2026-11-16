import { router } from 'expo-router';
import {
  Building2,
  Check,
  FileDown,
  FileUp,
  HandHeart,
  History,
  Info,
  Languages,
  LogOut,
  MapPinned,
  Moon,
  Plus,
  ScrollText,
  ShieldCheck,
  SunMoon,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Badge, ConfirmDialog, GroupedList, ListRow, PressableCard, Screen, SectionHeader, Switch } from '@/components/ui';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useCurrentUser } from '@/hooks/use-current-user';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { isLanguage, LANGUAGE_NAMES, useTranslation } from '@/localization';
import { useCan, useWorkspace } from '@/providers/workspace-provider';
import { isOwner, isOwnerOrAdmin } from '@/services/permissions/can';
import { OfflineError } from '@/services/sync/connectivity';
import { leaveWorkspace } from '@/services/workspaces/api';
import { usePreferences } from '@/store/preferences';
import { iconStroke, sizes, spacing, useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, scheme, preference } = useTheme();
  const setTheme = usePreferences((state) => state.setTheme);
  const { signOut, busy, dialog } = useSignOut();
  const { memberships, workspaces, workspaceId, workspace, member, actor, switchWorkspace } = useWorkspace();
  const canManageMembers = useCan('members_manage');
  const canImport = useCan('beneficiaries_import');
  const canExport = useCan('beneficiaries_export');
  const canHistory = useCan('sessions_view_history');
  const { isSuperAdmin } = useCurrentUser();
  const [leaving, setLeaving] = useState(false);
  const language = isLanguage(i18n.language) ? i18n.language : 'ar';
  const followSystem = preference === 'system';

  const leave = () => {
    setLeaving(false);
    if (!workspaceId || !actor) return;
    leaveWorkspace(workspaceId, actor)
      .then(() => emitActionFeedback({ message: t('workspace.left'), kind: 'success' }))
      .catch((error: unknown) =>
        emitActionFeedback({
          message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
          kind: 'error',
        }),
      );
  };

  return (
    <Screen header={<AppHeader title={t('tabs.settings')} subtitle={actor?.email} />} contentStyle={styles.content}>
      {isSuperAdmin ? <ManageCard /> : null}

      {workspaceId && member ? (
        <View>
          <SectionHeader title={workspace?.name ?? t('preferences.workspace')} action={<Badge label={t(`workspace.role.${member.role}`)} tone="ink" />} />
          <GroupedList>
            <ListRow icon={Users} label={t('workspace.members')} onPress={() => router.push('/members')} />
            <ListRow icon={MapPinned} label={t('workspace.cities')} onPress={() => router.push('/cities')} />
            {canHistory ? <ListRow icon={History} label={t('home.sessionsHistory')} onPress={() => router.push('/sessions')} /> : null}
            {canImport ? <ListRow icon={FileUp} label={t('import.title')} onPress={() => router.push('/import')} /> : null}
            {canExport ? <ListRow icon={FileDown} label={t('export.title')} onPress={() => router.push('/export')} /> : null}
            {isOwnerOrAdmin(member) || canManageMembers ? (
              <ListRow icon={ScrollText} label={t('workspace.auditLog')} onPress={() => router.push('/audit')} />
            ) : null}
            {isOwnerOrAdmin(member) ? (
              <ListRow icon={Building2} label={t('workspace.settings')} onPress={() => router.push('/workspace')} />
            ) : null}
            {!isOwner(member) ? <ListRow icon={LogOut} label={t('workspace.leave')} destructive onPress={() => setLeaving(true)} /> : null}
          </GroupedList>
        </View>
      ) : null}

      <View>
        <SectionHeader title={t('preferences.workspaces')} />
        <GroupedList>
          {memberships.map(({ workspaceId: wid, member: m }) => (
            <ListRow
              key={wid}
              icon={Building2}
              label={workspaces[wid]?.name ?? '…'}
              hint={t(`workspace.role.${m.role}`)}
              right={wid === workspaceId ? <Check size={sizes.icon} color={colors.success} strokeWidth={iconStroke} /> : undefined}
              chevron={wid !== workspaceId}
              onPress={wid === workspaceId ? undefined : () => switchWorkspace(wid)}
            />
          ))}
          <ListRow icon={Plus} label={t('workspace.create')} onPress={() => router.push('/onboarding/create')} />
          <ListRow icon={UserPlus} label={t('workspace.join')} onPress={() => router.push('/join')} />
        </GroupedList>
      </View>

      <View>
        <SectionHeader title={t('preferences.appearance')} />
        <GroupedList>
          <ListRow
            icon={SunMoon}
            label={t('preferences.followSystem')}
            right={
              <Switch
                label={t('preferences.followSystem')}
                value={followSystem}
                onValueChange={(on) => setTheme(on ? 'system' : scheme)}
              />
            }
          />
          <ListRow
            icon={Moon}
            label={t('preferences.darkMode')}
            disabled={followSystem}
            right={
              <Switch
                label={t('preferences.darkMode')}
                value={scheme === 'dark'}
                disabled={followSystem}
                onValueChange={(on) => setTheme(on ? 'dark' : 'light')}
              />
            }
          />
          <ListRow icon={Languages} label={t('preferences.language')} value={LANGUAGE_NAMES[language]} onPress={() => router.push('/appearance')} />
        </GroupedList>
      </View>

      <View>
        <SectionHeader title={t('preferences.help')} />
        <GroupedList>
          <ListRow icon={HandHeart} tile="lime" label={t('profile.support')} onPress={() => router.push('/support')} />
          <ListRow icon={Info} label={t('profile.about')} onPress={() => router.push('/about')} />
        </GroupedList>
      </View>

      <View>
        <SectionHeader title={t('preferences.account')} />
        <GroupedList>
          <ListRow
            icon={LogOut}
            label={busy ? t('preferences.signingOut') : t('auth.signOut')}
            destructive
            disabled={busy}
            chevron={false}
            onPress={signOut}
          />
        </GroupedList>
      </View>

      <ConfirmDialog
        visible={leaving}
        title={t('workspace.leave')}
        message={t('workspace.leaveConfirm')}
        confirmLabel={t('workspace.leave')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setLeaving(false)}
        onConfirm={leave}
      />
      {dialog}
    </Screen>
  );
}

/** Super admin entry to /manage, first in Settings. The (admin) guard and the rules enforce access. */
function ManageCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
  content: { gap: spacing[5] },
  manage: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  manageBody: { flex: 1, gap: spacing[1] },
  manageTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
});
