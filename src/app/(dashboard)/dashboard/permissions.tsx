import { StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText, Screen } from '@/components/ui';
import { PermissionsEditor } from '@/features/members/permissions-editor';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { PERMISSION_KEYS } from '@/services/permissions/catalog';
import { spacing } from '@/theme';

export default function PermissionsRoute() {
  const { can } = useCurrentUser();
  const { t } = useTranslation();
  return (
    <PermissionGate allowed={can('permissions.view')} fallback="/dashboard">
      <Screen header={<ScreenHeader title={t('dashboard.permissionsTitle')} subtitle={t('dashboard.permissionsSubtitle')} back />} contentStyle={styles.content}>
        <AppText variant="body" tone="secondary">
          {t('dashboard.permissionsNote')}
        </AppText>
        <PermissionsEditor scope="system" value={PERMISSION_KEYS} readOnly />
        <PermissionsEditor scope="workspace" value={PERMISSION_KEYS} readOnly />
      </Screen>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
});
