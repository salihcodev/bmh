import { router, useLocalSearchParams } from 'expo-router';
import { Crown, UserMinus, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  GroupedList,
  InlineBanner,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  Switch,
} from '@/components/ui';
import type { Member } from '@/domain/types';
import { PermissionsSheet } from '@/features/members/permissions-editor';
import { useMemberList } from '@/features/members/use-members';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { isOwner } from '@/services/permissions/can';
import { defaultPermissionsFor, type PermissionMap } from '@/services/permissions/matrix';
import { OfflineError } from '@/services/sync/connectivity';
import { removeMember, transferOwnership, updateMember } from '@/services/workspaces/api';
import { sizes, spacing } from '@/theme';

export default function MemberScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { wid, member: me } = useActiveWorkspace();
  const { members, error, retry } = useMemberList(wid);
  const target = members?.find((m) => m.id === memberId);
  const { t } = useTranslation();

  if (!target) {
    return (
      <Screen scroll={false} header={<AppHeader title={t('members.title')} back />}>
        {error ? (
          <ErrorState message={t('states.loadFailed')} onRetry={retry} />
        ) : members === null ? (
          <LoadingState />
        ) : (
          <EmptyState icon={UserX} title={t('common.empty')} />
        )}
      </Screen>
    );
  }
  return <MemberEditor key={`${target.id}-${target.role}`} target={target} me={me} />;
}

function MemberEditor({ target, me }: { target: Member; me: Member | null }) {
  const { t } = useTranslation();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('members_manage');
  const [role, setRole] = useState<'admin' | 'member'>(target.role === 'admin' ? 'admin' : 'member');
  const [permissions, setPermissions] = useState<PermissionMap>(target.permissions ?? {});
  const [active, setActive] = useState(target.status === 'active');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<'remove' | 'transfer' | null>(null);

  const isSelf = target.id === actor.uid;
  const isTargetOwner = target.role === 'owner';
  const editable = canManage && !isSelf && !isTargetOwner;
  const canTransfer = isOwner(me) && !isSelf && target.status === 'active';

  const report = (error: unknown) =>
    emitActionFeedback({
      message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
      kind: 'error',
    });

  const save = async () => {
    setSaving(true);
    try {
      await updateMember(wid, target, { role, permissions, status: active ? 'active' : 'disabled' }, actor);
      emitActionFeedback({ message: t('members.saved'), kind: 'success' });
    } catch (error) {
      report(error);
    } finally {
      setSaving(false);
    }
  };

  const onConfirm = () => {
    const action = confirm;
    setConfirm(null);
    if (action === 'remove') {
      removeMember(wid, target, actor)
        .then(() => {
          emitActionFeedback({ message: t('members.removed'), kind: 'success' });
          router.back();
        })
        .catch(report);
    } else if (action === 'transfer') {
      transferOwnership(wid, target, actor)
        .then(() => emitActionFeedback({ message: t('workspace.transferred'), kind: 'success' }))
        .catch(report);
    }
  };

  return (
    <Screen
      header={<AppHeader title={t('members.title')} back />}
      contentStyle={styles.content}
      footer={
        editable ? (
          <Button title={t('members.saveChanges')} loading={saving} disabled={saving} onPress={save} />
        ) : undefined
      }
    >
      <Card style={styles.identity}>
        <Avatar name={target.displayName} size={sizes.avatarMd} />
        <AppText variant="h2" center>
          {target.displayName}
        </AppText>
        <AppText variant="bodySm" tone="secondary" ltr center>
          {target.email}
        </AppText>
        <View style={styles.tags}>
          <Badge label={t(`workspace.role.${target.role}`)} tone={target.role === 'member' ? 'neutral' : 'ink'} />
          <Badge label={t(active ? 'members.active' : 'members.disabled')} tone={active ? 'success' : 'danger'} />
        </View>
      </Card>

      {isSelf ? <InlineBanner tone="info" message={t('members.cannotEditSelf')} /> : null}
      {isTargetOwner ? <InlineBanner tone="info" message={t('members.ownerLocked')} /> : null}

      {editable ? (
        <View>
          <SectionHeader title={t('members.role')} />
          <View style={styles.chips}>
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
          </View>
        </View>
      ) : null}

      <GroupedList>
        {editable ? (
          <ListRow
            label={t('members.active')}
            right={<Switch label={t('members.active')} value={active} onValueChange={setActive} />}
          />
        ) : null}
        <PermissionsSheet
          value={editable ? permissions : (target.permissions ?? {})}
          onChange={editable ? setPermissions : undefined}
          fullAccess={(editable ? role : target.role) !== 'member'}
        />
      </GroupedList>

      {editable || canTransfer ? (
        <GroupedList>
          {canTransfer ? (
            <ListRow icon={Crown} label={t('workspace.transfer')} onPress={() => setConfirm('transfer')} />
          ) : null}
          {editable ? (
            <ListRow icon={UserMinus} label={t('members.remove')} destructive onPress={() => setConfirm('remove')} />
          ) : null}
        </GroupedList>
      ) : null}

      <ConfirmDialog
        visible={confirm !== null}
        title={confirm === 'transfer' ? t('workspace.transfer') : t('members.remove')}
        message={
          confirm === 'transfer'
            ? t('workspace.transferConfirm', { name: target.displayName })
            : t('members.removeConfirm', { name: target.displayName })
        }
        confirmLabel={confirm === 'transfer' ? t('common.confirm') : t('members.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  identity: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[5] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
