import { Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, Chip, GroupedList, InlineBanner, NoPermissionState, Screen, SectionHeader } from '@/components/ui';
import { PermissionsSheet } from '@/features/members/permissions-editor';
import { errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { MEMBER_DEFAULT_PERMISSIONS, type PermissionMap } from '@/services/permissions/matrix';
import { OfflineError } from '@/services/sync/connectivity';
import { createInvite } from '@/services/workspaces/api';
import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';

export default function InviteScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { wid, workspace, actor } = useActiveWorkspace();
  const canManage = useCan('members_manage');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [permissions, setPermissions] = useState<PermissionMap>({ ...MEMBER_DEFAULT_PERMISSIONS });
  const [created, setCreated] = useState<{ link: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const workspaceName = workspace?.name ?? '';
  const header = <AppHeader title={t('members.invite')} back />;

  if (!canManage) {
    return (
      <Screen scroll={false} header={header}>
        <NoPermissionState />
      </Screen>
    );
  }

  const share = (invite: { link: string; token: string }) =>
    Share.share({
      message: t('members.shareMessage', { workspace: workspaceName, link: invite.link, code: invite.token }),
    });

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const invite = await createInvite({ id: wid, name: workspaceName }, role, permissions, actor);
      setCreated(invite);
      await share(invite);
    } catch (exc) {
      setError(exc instanceof OfflineError ? t('errors.offline') : errorMessage(exc));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <Screen
        header={header}
        contentStyle={styles.content}
        footer={
          <>
            <Button title={t('members.inviteShare')} onPress={() => share(created)} />
            <Button title={t('members.inviteCreate')} variant="secondary" onPress={() => setCreated(null)} />
          </>
        }
      >
        <Card style={styles.created}>
          <View style={[styles.tile, { backgroundColor: colors.accent }]}>
            <Link2 size={sizes.icon} color={colors.onAccent} strokeWidth={iconStroke} />
          </View>
          <AppText variant="h3" center>
            {t('members.inviteCreated')}
          </AppText>
          <AppText variant="label" tone="secondary">
            {t('members.inviteCode')}
          </AppText>
          <AppText variant="bodyLg" weight="semibold" ltr selectable center>
            {created.token}
          </AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      footer={<Button title={t('members.inviteCreate')} loading={busy} disabled={busy} onPress={submit} />}
    >
      <View>
        <SectionHeader title={t('members.inviteRole')} />
        <View style={styles.chips}>
          {(['member', 'admin'] as const).map((option) => (
            <Chip key={option} label={t(`workspace.role.${option}`)} selected={role === option} onPress={() => setRole(option)} />
          ))}
        </View>
      </View>
      <GroupedList>
        <PermissionsSheet value={permissions} onChange={setPermissions} fullAccess={role === 'admin'} />
      </GroupedList>
      {error ? <InlineBanner tone="danger" message={error} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: { width: sizes.avatarMd, height: sizes.avatarMd, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  created: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
});
