import { StyleSheet, View } from 'react-native';

import { Card, Field, SelectField } from '@/components/ui';
import { PermissionsEditor } from '@/features/members/permissions-editor';
import { useTranslation } from '@/localization';
import type { PermissionScope } from '@/services/permissions/catalog';
import { spacing } from '@/theme';

export function CatalogForm({
  scope,
  scopeLocked = false,
  onScope,
  nameAr,
  nameEn,
  onNameAr,
  onNameEn,
  keys,
  onKeys,
  grantable,
  readOnly,
}: {
  scope: PermissionScope;
  scopeLocked?: boolean;
  onScope?: (scope: PermissionScope) => void;
  nameAr: string;
  nameEn: string;
  onNameAr: (value: string) => void;
  onNameEn: (value: string) => void;
  keys: string[];
  onKeys: (keys: string[]) => void;
  grantable?: readonly string[];
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.form}>
      <Card style={styles.card}>
        <Field label={t('dashboard.nameAr')} value={nameAr} onChangeText={onNameAr} editable={!readOnly} maxLength={60} />
        <Field label={t('dashboard.nameEn')} value={nameEn} onChangeText={onNameEn} editable={!readOnly} maxLength={60} ltr />
        {onScope ? (
          <SelectField
            label={t('dashboard.scope')}
            value={scope}
            disabled={readOnly || scopeLocked}
            options={[
              { value: 'system', label: t('dashboard.scopeSystem') },
              { value: 'workspace', label: t('dashboard.scopeWorkspace') },
            ]}
            onChange={(value) => onScope(value === 'workspace' ? 'workspace' : 'system')}
          />
        ) : null}
      </Card>
      <PermissionsEditor
        scope={scope}
        value={keys}
        onChange={readOnly ? undefined : onKeys}
        grantable={grantable}
        readOnly={readOnly}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[6] },
  card: { paddingBottom: spacing[1], marginBottom: 0 },
});
