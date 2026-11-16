import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Badge, Button, Card, Chip, LoadingState, Row, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { Member } from '@/domain/types';
import { PermissionsEditor } from '@/features/members/permissions-editor';
import { useMembers } from '@/features/members/use-members';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { isOwner } from '@/services/permissions/can';
import { defaultPermissionsFor, type PermissionMap } from '@/services/permissions/matrix';
import { OfflineError } from '@/services/sync/connectivity';
import { removeMember, transferOwnership, updateMember } from '@/services/workspaces/api';

export default function MemberScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { wid, member: me } = useActiveWorkspace();
  const members = useMembers(wid);
  const target = members?.find((m) => m.id === memberId);
  const { t } = useTranslation();

  return (
    <Screen header={<AppHeader title={target?.displayName ?? t('members.title')} back />}>
      {members === null ? (
        <LoadingState />
      ) : !target ? (
        <AppText muted>{t('common.empty')}</AppText>
      ) : (
        <MemberEditor key={`${target.id}-${target.role}`} target={target} me={me} />
      )}
    </Screen>
  );
}

function MemberEditor({ target, me }: { target: Member; me: Member | null }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('members_manage');
  const [role, setRole] = useState<'admin' | 'member'>(target.role === 'admin' ? 'admin' : 'member');
  const [permissions, setPermissions] = useState<PermissionMap>(target.permissions ?? {});
  const [active, setActive] = useState(target.status === 'active');

  const isSelf = target.id === actor.uid;
  const isTargetOwner = target.role === 'owner';
  const editable = canManage && !isSelf && !isTargetOwner;

  const report = (error: unknown) =>
    emitActionFeedback({
      message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
      kind: 'error',
    });

  const save = async () => {
    try {
      await updateMember(wid, target, { role, permissions, status: active ? 'active' : 'disabled' }, actor);
      emitActionFeedback({ message: t('members.saved'), kind: 'success' });
    } catch (error) {
      report(error);
    }
  };

  const remove = () =>
    Alert.alert(t('members.remove'), t('members.removeConfirm', { name: target.displayName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('members.remove'),
        style: 'destructive',
        onPress: () => {
          removeMember(wid, target, actor)
            .then(() => {
              emitActionFeedback({ message: t('members.removed'), kind: 'success' });
              router.back();
            })
            .catch(report);
        },
      },
    ]);

  const transfer = () =>
    Alert.alert(t('workspace.transfer'), t('workspace.transferConfirm', { name: target.displayName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          transferOwnership(wid, target, actor)
            .then(() => emitActionFeedback({ message: t('workspace.transferred'), kind: 'success' }))
            .catch(report);
        },
      },
    ]);

  return (
    <View>
      <Card style={{ gap: Spacing.xs }}>
        <AppText variant="heading">{target.displayName}</AppText>
        <AppText muted ltr>
          {target.email}
        </AppText>
        <Row>
          <Badge label={t(`workspace.role.${target.role}`)} tone="primary" />
          <Badge label={t(active ? 'members.active' : 'members.disabled')} tone={active ? 'success' : 'danger'} />
        </Row>
      </Card>

      {isSelf ? <AppText muted>{t('members.cannotEditSelf')}</AppText> : null}
      {isTargetOwner ? <AppText muted>{t('members.ownerLocked')}</AppText> : null}

      {editable ? (
        <>
          <Section title={t('members.role')}>
            <Row>
              {(['member', 'admin'] as const).map((option) => (
                <Chip
                  key={option}
                  label={t(`workspace.role.${option}`)}
                  selected={role === option}
                  onPress={() => {
                    setRole(option);
                    if (option === 'member' && role === 'admin') setPermissions(defaultPermissionsFor('member'));
                  }}
                />
              ))}
            </Row>
            <Row>
              <AppText style={{ flex: 1 }}>{t('members.active')}</AppText>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary, false: colors.border }} />
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
          <Button title={t('members.saveChanges')} loadingTitle={t('common.saving')} onPress={save} />
          <Button title={t('members.remove')} variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} />
        </>
      ) : (
        <Section title={t('members.permissions')}>
          <Card>
            {target.role !== 'member' ? (
              <AppText muted>{t('members.fullAccess')}</AppText>
            ) : (
              <PermissionsEditor value={target.permissions ?? {}} onChange={() => undefined} disabled />
            )}
          </Card>
        </Section>
      )}

      {isOwner(me) && !isSelf && target.status === 'active' ? (
        <Button
          title={t('workspace.transfer')}
          variant="secondary"
          onPress={transfer}
          style={{ marginTop: Spacing.md }}
        />
      ) : null}
    </View>
  );
}
