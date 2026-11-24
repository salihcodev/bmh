import { router } from 'expo-router';
import { Lock, Plus, ShieldCheck } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  GroupedList,
  ListRow,
  Screen,
  SkeletonListRow,
  useDelayedLoading,
} from '@/components/ui';
import { permissionCount } from '@/features/members/permissions-editor';
import { roleLabel, useWorkspaceRoles } from '@/features/members/roles';
import { useMemberList } from '@/features/members/use-members';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission } from '@/providers/workspace-provider';
import { WORKSPACE_ADMIN_ROLE } from '@/services/permissions/catalog';
import { spacing } from '@/theme';

export default function RolesScreen() {
  const canView = usePermission('workspace-roles.view');
  return (
    <PermissionGate allowed={canView}>
      <RolesList />
    </PermissionGate>
  );
}

function RolesList() {
  const { t } = useTranslation();
  const { wid } = useActiveWorkspace();
  const canCreate = usePermission('workspace-roles.create');
  const { roles, error, retry } = useWorkspaceRoles(wid);
  const { members } = useMemberList(wid);
  const showSkeleton = useDelayedLoading(roles === null && !error);
  const total = permissionCount('workspace');

  const holders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members ?? []) counts.set(m.roleId, (counts.get(m.roleId) ?? 0) + 1);
    return counts;
  }, [members]);

  return (
    <Screen
      header={<ScreenHeader title={t('roles.title')} subtitle={t('roles.subtitle')} back />}
      contentStyle={styles.content}
      footer={
        canCreate ? (
          <Button title={t('roles.create')} icon={<Plus />} onPress={() => router.push('/roles/new')} />
        ) : undefined
      }
    >
      {error ? (
        <ErrorState message={t('states.loadFailed')} onRetry={retry} />
      ) : roles === null ? (
        showSkeleton ? (
          <GroupedList>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </GroupedList>
        ) : null
      ) : roles.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('roles.empty')} />
      ) : (
        <View style={styles.content}>
          <AppText variant="caption" tone="secondary">
            {t('roles.hint')}
          </AppText>
          <GroupedList>
            {roles.map((role) => {
              const count = role.id === WORKSPACE_ADMIN_ROLE ? total : role.permissions.length;
              return (
                <ListRow
                  key={role.id}
                  icon={role.isLocked ? Lock : ShieldCheck}
                  label={roleLabel(t, role.id, role)}
                  hint={`${t('roles.permissionCount', { count, total })} · ${t('roles.holders', {
                    count: holders.get(role.id) ?? 0,
                  })}`}
                  right={role.isLocked ? <Badge label={t('roles.locked')} tone="neutral" /> : undefined}
                  chevron
                  onPress={() => router.push(`/roles/${role.id}`)}
                />
              );
            })}
          </GroupedList>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
});
