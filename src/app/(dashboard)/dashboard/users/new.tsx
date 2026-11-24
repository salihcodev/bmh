import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Button, Card, Field, Screen, SelectField } from '@/components/ui';
import { userTypeForRole, validateStaffDraft, type StaffUserType } from '@/domain/dashboard';
import { useLocalizedText } from '@/features/members/permissions-editor';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { createSystemUser } from '@/services/admin/admin-writes';
import { provisionAuthUser } from '@/services/admin/provision-user';
import { useSystemRoleList } from '@/services/admin/use-admin';
import { spacing } from '@/theme';

export default function NewUserScreen() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('users.create')} fallback="/dashboard/users">
      <NewUserForm />
    </PermissionGate>
  );
}

function NewUserForm() {
  const { t } = useTranslation();
  const text = useLocalizedText();
  const { run } = useAdminAction();
  const roles = useSystemRoleList();
  const choices = (roles.items ?? []).filter((role) => !role.isLocked);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [userType, setUserType] = useState<StaffUserType>('custom');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const draft = { displayName, email, password, userType, systemRoleId: roleId };
    const problem = validateStaffDraft(draft);
    if (problem) {
      setError(t(`dashboard.staffError.${problem}`));
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await run(async (actor) => {
      const uid = await provisionAuthUser(draft.email, draft.password);
      await createSystemUser(actor, uid, {
        displayName: draft.displayName.trim(),
        email: draft.email.trim().toLowerCase(),
        userType: draft.userType,
        systemRoleId: draft.systemRoleId,
      });
    }, t('dashboard.userCreated'));
    setSaving(false);
    if (ok) router.back();
  };

  return (
    <Screen
      header={<ScreenHeader title={t('dashboard.createUser')} back />}
      contentStyle={styles.form}
      footer={<Button title={t('dashboard.createUser')} loading={saving} onPress={save} />}
    >
      <Card style={styles.card}>
        <Field label={t('dashboard.displayName')} value={displayName} onChangeText={setDisplayName} error={error ?? undefined} />
        <Field label={t('dashboard.email')} value={email} onChangeText={setEmail} ltr autoCapitalize="none" keyboardType="email-address" />
        <Field label={t('dashboard.password')} value={password} onChangeText={setPassword} ltr secureTextEntry hint={t('dashboard.passwordHint')} />
      </Card>
      <Card style={styles.card}>
        <SelectField
          label={t('dashboard.systemRole')}
          value={roleId}
          placeholder={t('dashboard.pickRole')}
          options={choices.map((role) => ({ value: role.id, label: text(role.name) }))}
          onChange={(id) => {
            setRoleId(id);
            setUserType(userTypeForRole(id));
          }}
        />
        <SelectField
          label={t('dashboard.userType')}
          value={userType}
          options={(['support', 'moderator', 'custom'] as const).map((type) => ({
            value: type,
            label: t(`dashboard.userFilter.${type}`),
            hint: type === 'moderator' ? t('dashboard.moderatorSwitchHint') : undefined,
          }))}
          onChange={(value) => setUserType(value as StaffUserType)}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  card: { paddingBottom: spacing[1], marginBottom: 0 },
});
