import { useState } from 'react';
import { Share } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, Chip, Row, Screen, Section } from '@/components/ui';
import { PermissionsEditor } from '@/features/members/permissions-editor';
import { useAppTheme } from '@/hooks/use-app-theme';
import { errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace } from '@/providers/workspace-provider';
import { MEMBER_DEFAULT_PERMISSIONS, type PermissionMap } from '@/services/permissions/matrix';
import { OfflineError } from '@/services/sync/connectivity';
import { createInvite } from '@/services/workspaces/api';

export default function InviteScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, workspace, actor } = useActiveWorkspace();
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [permissions, setPermissions] = useState<PermissionMap>({ ...MEMBER_DEFAULT_PERMISSIONS });
  const [created, setCreated] = useState<{ link: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaceName = workspace?.name ?? '';

  const share = (invite: { link: string; token: string }) =>
    Share.share({
      message: t('members.shareMessage', { workspace: workspaceName, link: invite.link, code: invite.token }),
    });

  const submit = async () => {
    setError(null);
    try {
      const invite = await createInvite({ id: wid, name: workspaceName }, role, permissions, actor);
      setCreated(invite);
      await share(invite);
    } catch (exc) {
      setError(exc instanceof OfflineError ? t('errors.offline') : errorMessage(exc));
    }
  };

  return (
    <Screen header={<AppHeader title={t('members.invite')} back />}>
      {created ? (
        <Card style={{ gap: 12 }}>
          <AppText style={{ color: colors.success }}>{t('members.inviteCreated')}</AppText>
          <AppText variant="label">{t('members.inviteCode')}</AppText>
          <AppText ltr selectable variant="caption">
            {created.token}
          </AppText>
          <Button title={t('members.inviteShare')} onPress={() => share(created)} />
          <Button title={t('members.inviteCreate')} variant="secondary" onPress={() => setCreated(null)} />
        </Card>
      ) : (
        <>
          <Section title={t('members.inviteRole')}>
            <Row gap={8}>
              {(['member', 'admin'] as const).map((option) => (
                <Chip
                  key={option}
                  label={t(`workspace.role.${option}`)}
                  selected={role === option}
                  onPress={() => setRole(option)}
                />
              ))}
            </Row>
          </Section>
          <Section title={t('members.permissions')}>
            <Card>
              {role === 'admin' ? (
                <AppText muted>{t('members.fullAccess')}</AppText>
              ) : (
                <PermissionsEditor value={permissions} onChange={setPermissions} />
              )}
            </Card>
          </Section>
          {error ? <AppText style={{ color: colors.danger, marginVertical: 12 }}>{error}</AppText> : null}
          <Button title={t('members.inviteCreate')} loadingTitle={t('common.saving')} onPress={submit} />
        </>
      )}
    </Screen>
  );
}
