import { router, useLocalSearchParams } from 'expo-router';
import { ShieldCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  GroupedList,
  InlineBanner,
  ListRow,
  LoadingState,
  Screen,
} from '@/components/ui';
import type { WorkspaceRole } from '@/domain/types';
import { PermissionsEditor } from '@/features/members/permissions-editor';
import { roleLabel, useWorkspaceRoles } from '@/features/members/roles';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission, useWorkspaceKeys } from '@/providers/workspace-provider';
import {
  assignableKeys,
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MEMBER_ROLE,
} from '@/services/permissions/catalog';
import { OfflineError } from '@/services/sync/connectivity';
import { deleteWorkspaceRole, saveWorkspaceRole } from '@/services/workspaces/api';
import { spacing } from '@/theme';

const WORKSPACE_KEYS = assignableKeys('workspace');
const NAME_MAX = 40;

export default function RoleScreen() {
  const { roleId } = useLocalSearchParams<{ roleId: string }>();
  const isNew = roleId === 'new';
  const canView = usePermission('workspace-roles.view');
  const canCreate = usePermission('workspace-roles.create');
  return (
    <PermissionGate allowed={isNew ? canCreate : canView} fallback="/roles">
      <RoleLoader roleId={roleId} isNew={isNew} />
    </PermissionGate>
  );
}

function RoleLoader({ roleId, isNew }: { roleId: string; isNew: boolean }) {
  const { t } = useTranslation();
  const { wid } = useActiveWorkspace();
  const { roles, error, retry, byId } = useWorkspaceRoles(wid);
  const role = isNew ? null : byId.get(roleId);

  if (!isNew && !role) {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('roles.title')} back />}>
        {error ? (
          <ErrorState message={t('states.loadFailed')} onRetry={retry} />
        ) : roles === null ? (
          <LoadingState />
        ) : (
          <EmptyState icon={ShieldCheck} title={t('common.empty')} />
        )}
      </Screen>
    );
  }
  return <RoleEditor key={role?.id ?? 'new'} role={role ?? null} />;
}

function RoleEditor({ role }: { role: WorkspaceRole | null }) {
  const { t } = useTranslation();
  const { wid, actor } = useActiveWorkspace();
  const canEdit = usePermission('workspace-roles.edit');
  const canDelete = usePermission('workspace-roles.delete');
  const myKeys = useWorkspaceKeys(WORKSPACE_KEYS);
  const isAdminRole = role?.id === WORKSPACE_ADMIN_ROLE;
  const isNew = role === null;
  const label = role ? roleLabel(t, role.id, role) : '';
  const [name, setName] = useState(isNew ? '' : label);
  const [keys, setKeys] = useState<string[]>(isAdminRole ? [...WORKSPACE_KEYS] : [...(role?.permissions ?? [])]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  // A role holding keys the editor lacks is out of reach (rules: hasAll on the existing keys too).
  const outOfReach = !!role && role.permissions.some((key) => !myKeys.includes(key));
  const editable = !isAdminRole && (isNew || (canEdit && !outOfReach));
  const deletable =
    !!role && !role.isLocked && role.id !== WORKSPACE_MEMBER_ROLE && canDelete && !outOfReach;
  const trimmed = name.trim();
  const nameError = trimmed.length === 0 ? t('roles.nameRequired') : undefined;

  const report = (error: unknown) =>
    emitActionFeedback({
      message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
      kind: 'error',
    });

  const save = async () => {
    if (nameError) return;
    setSaving(true);
    try {
      await saveWorkspaceRole(wid, role?.id ?? null, { name: trimmed, permissions: keys }, actor);
      emitActionFeedback({ message: t('roles.saved'), kind: 'success' });
      router.back();
    } catch (error) {
      report(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!role) return;
    setConfirm(false);
    try {
      const result = await deleteWorkspaceRole(wid, role, actor);
      if (result === 'in-use') {
        emitActionFeedback({ message: t('roles.inUse'), kind: 'error' });
        return;
      }
      emitActionFeedback({ message: t('roles.deleted'), kind: 'success' });
      router.back();
    } catch (error) {
      report(error);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={isNew ? t('roles.create') : label} back />}
      contentStyle={styles.content}
      footer={
        editable ? (
          <Button
            title={t('common.save')}
            loading={saving}
            disabled={saving || !!nameError}
            onPress={save}
          />
        ) : undefined
      }
    >
      {isAdminRole ? <InlineBanner tone="info" message={t('roles.adminLocked')} /> : null}
      {!isAdminRole && outOfReach ? <InlineBanner tone="info" message={t('roles.outOfReach')} /> : null}
      {editable && role?.id === WORKSPACE_MEMBER_ROLE ? (
        <InlineBanner tone="info" message={t('roles.memberDefault')} />
      ) : null}

      <Card>
        <Field
          label={t('roles.name')}
          value={name}
          editable={editable && role?.id !== WORKSPACE_MEMBER_ROLE}
          maxLength={NAME_MAX}
          onChangeText={setName}
          error={editable && name.length > 0 ? nameError : undefined}
        />
      </Card>

      <View>
        <PermissionsEditor
          scope="workspace"
          value={keys}
          onChange={editable ? setKeys : undefined}
          grantable={myKeys}
          readOnly={!editable}
        />
      </View>

      {deletable ? (
        <GroupedList>
          <ListRow icon={Trash2} label={t('roles.delete')} destructive onPress={() => setConfirm(true)} />
        </GroupedList>
      ) : null}

      <ConfirmDialog
        visible={confirm}
        title={t('roles.delete')}
        message={t('roles.deleteConfirm', { name: label })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
});
