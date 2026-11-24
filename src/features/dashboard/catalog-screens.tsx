import { router } from 'expo-router';
import { Layers, Plus, Shield, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Button, ConfirmDialog, EmptyState, ErrorState, GroupedList, ListRow, LoadingState, Screen } from '@/components/ui';
import { bilingualName } from '@/domain/dashboard';
import { CatalogForm } from '@/features/dashboard/catalog-form';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useLocalizedText } from '@/features/members/permissions-editor';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { deletePreset, deleteSystemRole, savePreset, saveSystemRole } from '@/services/admin/admin-writes';
import { usePresetList, useSystemRoleList, type NamedPermissionDoc } from '@/services/admin/use-admin';
import { isOwnerUser } from '@/services/permissions/can';
import { assignableKeys, sanitizeKeys, type PermissionScope } from '@/services/permissions/catalog';
import { spacing } from '@/theme';

export function RoleList() {
  const { t } = useTranslation();
  const text = useLocalizedText();
  const { can } = useCurrentUser();
  const { items, error, retry } = useSystemRoleList();
  return (
    <CatalogList
      title={t('dashboard.rolesTitle')}
      empty={t('dashboard.rolesEmpty')}
      icon={Shield}
      items={items}
      error={error}
      retry={retry}
      canCreate={can('roles.create')}
      onCreate={() => router.push('/dashboard/roles/new')}
      onOpen={(id) => router.push(`/dashboard/roles/${id}`)}
      label={(item) => text(item.name)}
      hint={(item) => t('dashboard.keyCount', { count: item.permissions.length })}
    />
  );
}

export function PresetList() {
  const { t } = useTranslation();
  const text = useLocalizedText();
  const { can } = useCurrentUser();
  const { items, error, retry } = usePresetList();
  return (
    <CatalogList
      title={t('dashboard.presetsTitle')}
      empty={t('dashboard.presetsEmpty')}
      icon={Layers}
      items={items}
      error={error}
      retry={retry}
      canCreate={can('presets.create')}
      onCreate={() => router.push('/dashboard/presets/new')}
      onOpen={(id) => router.push(`/dashboard/presets/${id}`)}
      label={(item) => text(item.name)}
      hint={(item) => t(`dashboard.scope${item.scope === 'workspace' ? 'Workspace' : 'System'}`)}
    />
  );
}

function CatalogList({
  title,
  empty,
  icon,
  items,
  error,
  retry,
  canCreate,
  onCreate,
  onOpen,
  label,
  hint,
}: {
  title: string;
  empty: string;
  icon: typeof Shield;
  items: NamedPermissionDoc[] | null;
  error: boolean;
  retry: () => void;
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  label: (item: NamedPermissionDoc) => string;
  hint: (item: NamedPermissionDoc) => string;
}) {
  const { t } = useTranslation();
  return (
    <Screen
      header={<ScreenHeader title={title} back />}
      contentStyle={styles.content}
      footer={canCreate ? <Button title={t('dashboard.create')} icon={<Plus />} onPress={onCreate} /> : undefined}
    >
      {error ? (
        <ErrorState message={t('states.loadFailed')} onRetry={retry} />
      ) : items === null ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState icon={icon} title={empty} />
      ) : (
        <GroupedList>
          {items.map((item) => (
            <ListRow
              key={item.id}
              icon={icon}
              label={label(item)}
              hint={item.isLocked ? t('dashboard.locked') : hint(item)}
              chevron
              onPress={() => onOpen(item.id)}
            />
          ))}
        </GroupedList>
      )}
    </Screen>
  );
}

export function RoleEditor({ roleId }: { roleId: string }) {
  const isNew = roleId === 'new';
  const { items, error, retry, byId } = useSystemRoleList();
  const role = isNew ? null : byId.get(roleId);
  if (!isNew && !role) return <Wait error={error} retry={retry} loading={items === null} titleKey="dashboard.rolesTitle" />;
  return <Editor kind="role" doc={role ?? null} />;
}

export function PresetEditor({ presetId }: { presetId: string }) {
  const isNew = presetId === 'new';
  const { items, error, retry, byId } = usePresetList();
  const preset = isNew ? null : byId.get(presetId);
  if (!isNew && !preset) return <Wait error={error} retry={retry} loading={items === null} titleKey="dashboard.presetsTitle" />;
  return <Editor kind="preset" doc={preset ?? null} />;
}

function Wait({ error, retry, loading, titleKey }: { error: boolean; retry: () => void; loading: boolean; titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Screen scroll={false} header={<ScreenHeader title={t(titleKey)} back />}>
      {error ? <ErrorState message={t('states.loadFailed')} onRetry={retry} /> : loading ? <LoadingState /> : <EmptyState icon={Shield} title={t('common.empty')} />}
    </Screen>
  );
}

function Editor({ kind, doc }: { kind: 'role' | 'preset'; doc: NamedPermissionDoc | null }) {
  const { t } = useTranslation();
  const { can, profile, systemRole } = useCurrentUser();
  const { run } = useAdminAction();
  const isNew = doc === null;
  const scopeDefault: PermissionScope = doc?.scope === 'workspace' ? 'workspace' : 'system';
  const [scope, setScope] = useState<PermissionScope>(scopeDefault);
  const [nameAr, setNameAr] = useState(doc?.name.ar ?? '');
  const [nameEn, setNameEn] = useState(doc?.name.en ?? '');
  const [keys, setKeys] = useState<string[]>(doc?.permissions ?? []);
  const [confirm, setConfirm] = useState(false);
  const grantable = isOwnerUser(profile)
    ? assignableKeys(kind === 'preset' ? scope : 'system')
    : (systemRole?.permissions ?? []);
  const canEdit = kind === 'role' ? can(isNew ? 'roles.create' : 'roles.edit') : can(isNew ? 'presets.create' : 'presets.edit');
  const canDelete = kind === 'role' ? can('roles.delete') : can('presets.delete');
  const readOnly = !!doc?.isLocked || !canEdit;
  const name = bilingualName(nameAr, nameEn);
  const cleaned = sanitizeKeys(keys, kind === 'preset' ? scope : 'system');

  const save = async () => {
    if (!name) return;
    const ok = await run(async (actor) => {
      if (kind === 'role') await saveSystemRole(actor, doc?.id ?? null, { name, permissions: cleaned });
      else await savePreset(actor, doc?.id ?? null, { name, permissions: cleaned, scope });
    }, t('dashboard.saved'));
    if (ok) router.back();
  };

  const remove = async () => {
    if (!doc) return;
    const ok = await run(async (actor) => {
      if (kind === 'role') await deleteSystemRole(actor, doc.id, doc.name.en);
      else await deletePreset(actor, doc.id, doc.name.en);
    }, t('dashboard.deletedDone'));
    if (ok) router.back();
  };

  return (
    <Screen
      header={<ScreenHeader title={isNew ? t('dashboard.create') : nameEn || nameAr || t('dashboard.edit')} back />}
      contentStyle={styles.content}
      footer={
        readOnly ? undefined : (
          <Button title={t('common.save')} disabled={!name || cleaned.length === 0} onPress={save} />
        )
      }
    >
      <CatalogForm
        scope={kind === 'preset' ? scope : 'system'}
        scopeLocked={!isNew}
        onScope={
          kind === 'preset'
            ? (next) => {
                setScope(next);
                setKeys(sanitizeKeys(keys, next));
              }
            : undefined
        }
        nameAr={nameAr}
        nameEn={nameEn}
        onNameAr={setNameAr}
        onNameEn={setNameEn}
        keys={keys}
        onKeys={setKeys}
        grantable={grantable}
        readOnly={readOnly}
      />
      {!isNew && canDelete && !doc?.isLocked ? (
        <GroupedList>
          <ListRow icon={Trash2} label={t('dashboard.delete')} destructive chevron={false} onPress={() => setConfirm(true)} />
        </GroupedList>
      ) : null}
      <ConfirmDialog
        visible={confirm}
        title={t('dashboard.deleteTitle')}
        message={t('dashboard.deleteBody')}
        confirmLabel={t('dashboard.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await remove();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
});
