import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, UserCheck, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  GroupedList,
  ListRow,
  LoadingState,
  Screen,
  SelectField,
} from '@/components/ui';
import { userTypeForRole, type StaffUserType } from '@/domain/dashboard';
import { isSystemUserType, type UserProfile } from '@/domain/user';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useLocalizedText } from '@/features/members/permissions-editor';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { assignSystemRole, deleteUser, setUserStatus } from '@/services/admin/admin-writes';
import { useDashboardUser, useSystemRoleList } from '@/services/admin/use-admin';
import { isOwnerUser } from '@/services/permissions/can';
import { sizes, spacing } from '@/theme';

export default function UserDetailScreen() {
  const { can } = useCurrentUser();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return (
    <PermissionGate allowed={can('users.view')} fallback="/dashboard/users">
      <UserDetail uid={uid} />
    </PermissionGate>
  );
}

function UserDetail({ uid }: { uid: string }) {
  const state = useDashboardUser(uid);
  if (state.error) return <Missing />;
  if (state.user === null) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (state.user === false) return <Missing />;
  return <UserEditor user={state.user} />;
}

function Missing() {
  const { t } = useTranslation();
  return (
    <Screen header={<ScreenHeader title={t('dashboard.usersTitle')} back />}>
      <ErrorState message={t('dashboard.userMissing')} onRetry={() => router.back()} />
    </Screen>
  );
}

function UserEditor({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const text = useLocalizedText();
  const { can, user: me } = useCurrentUser();
  const { run } = useAdminAction();
  const roles = useSystemRoleList();
  const locked = isOwnerUser(user) || user.id === me?.uid || user.isDeleted;
  const [roleId, setRoleId] = useState(user.systemRoleId ?? '');
  const [confirm, setConfirm] = useState<'suspend' | 'delete' | null>(null);
  const choices = (roles.items ?? []).filter((role) => !role.isLocked);
  const name = user.displayName || user.email || t('manage.users.noName');

  const before = { userType: user.userType, systemRoleId: user.systemRoleId ?? null };

  const saveRole = async () => {
    if (!roleId) {
      await run((actor) => assignSystemRole(actor, user.id, { userType: 'member', systemRoleId: null }, { name, before }), t('dashboard.roleAssigned'));
      return;
    }
    const userType: StaffUserType = userTypeForRole(roleId);
    await run((actor) => assignSystemRole(actor, user.id, { userType, systemRoleId: roleId }, { name, before }), t('dashboard.roleAssigned'));
  };

  const canSuspend = can('users.suspend') && !locked;
  const canDelete = can('users.delete') && !locked;

  return (
    <Screen header={<ScreenHeader title={t('dashboard.usersTitle')} back />} contentStyle={styles.body}>
      <Card style={styles.identity}>
        <Avatar name={name} publicId={user.avatarPublicId} size={sizes.avatarLg} />
        <AppText variant="h2" center numberOfLines={2}>
          {name}
        </AppText>
        {user.email ? (
          <AppText variant="bodySm" tone="secondary" ltr center numberOfLines={1}>
            {user.email}
          </AppText>
        ) : null}
        <View style={styles.tags}>
          <Badge label={t(`dashboard.userFilter.${user.userType}`)} tone={isSystemUserType(user.userType) ? 'lime' : 'neutral'} />
          <Badge
            label={user.isDeleted ? t('dashboard.deleted') : user.status === 'suspended' ? t('manage.users.statusSuspended') : t('manage.users.statusActive')}
            tone={user.isDeleted || user.status === 'suspended' ? 'danger' : 'success'}
          />
        </View>
      </Card>
      {can('roles.assign') && !locked ? (
        <Card style={styles.role}>
          <SelectField
            label={t('dashboard.systemRole')}
            value={roleId}
            placeholder={t('dashboard.noSystemRole')}
            options={[{ value: '', label: t('dashboard.noSystemRole') }, ...choices.map((role) => ({ value: role.id, label: text(role.name) }))]}
            onChange={setRoleId}
          />
          <Button
            title={t('dashboard.assignRole')}
            disabled={roleId === (user.systemRoleId ?? '')}
            onPress={saveRole}
          />
        </Card>
      ) : null}
      {canSuspend || canDelete ? (
        <GroupedList>
          {canSuspend ? (
            <ListRow
              icon={user.status === 'suspended' ? UserCheck : UserX}
              label={user.status === 'suspended' ? t('manage.users.reactivate') : t('manage.users.suspend')}
              chevron={false}
              onPress={() => setConfirm('suspend')}
            />
          ) : null}
          {canDelete ? (
            <ListRow icon={Trash2} label={t('dashboard.deleteUser')} destructive chevron={false} onPress={() => setConfirm('delete')} />
          ) : null}
        </GroupedList>
      ) : null}
      <ConfirmDialog
        visible={!!confirm}
        title={t(confirm === 'delete' ? 'dashboard.deleteUserTitle' : user.status === 'suspended' ? 'manage.users.reactivateConfirmTitle' : 'manage.users.suspendConfirmTitle', { name })}
        message={t(confirm === 'delete' ? 'dashboard.deleteUserBody' : user.status === 'suspended' ? 'manage.users.reactivateConfirmBody' : 'manage.users.suspendConfirmBody')}
        confirmLabel={t(confirm === 'delete' ? 'dashboard.deleteUser' : user.status === 'suspended' ? 'manage.users.reactivate' : 'manage.users.suspend')}
        cancelLabel={t('common.cancel')}
        destructive={confirm === 'delete' || user.status !== 'suspended'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm;
          setConfirm(null);
          if (action === 'delete') {
            const ok = await run((actor) => deleteUser(actor, user.id, name), t('dashboard.userDeleted'));
            if (ok) router.back();
          } else if (action === 'suspend') {
            await run(
              (actor) => setUserStatus(actor, user.id, user.status === 'suspended' ? 'active' : 'suspended', name),
              t(user.status === 'suspended' ? 'manage.users.reactivatedDone' : 'manage.users.suspendedDone'),
            );
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[6] },
  identity: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[5], marginBottom: 0 },
  role: { marginBottom: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2] },
});
