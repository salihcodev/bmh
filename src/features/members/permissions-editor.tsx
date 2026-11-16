import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, ListRow, Switch } from '@/components/ui';
import { useTranslation } from '@/localization';
import { PERMISSIONS, type PermissionMap } from '@/services/permissions/matrix';
import { spacing, useTheme } from '@/theme';

export function PermissionsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View>
      {PERMISSIONS.map((key, index) => (
        <View
          key={key}
          style={[styles.row, index > 0 && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth }]}
        >
          <AppText variant="body" style={styles.label}>
            {t(`permissions.${key}`)}
          </AppText>
          <Switch
            label={t(`permissions.${key}`)}
            disabled={disabled}
            value={value[key] === true}
            onValueChange={(on) => {
              const next = { ...value };
              if (on) next[key] = true;
              else delete next[key];
              onChange(next);
            }}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Summary row ("6 of 15 allowed") that opens the full permission list in a bottom sheet.
 * Admins and owners have every permission, so the row is informational for them.
 */
export function PermissionsSheet({
  value,
  onChange,
  fullAccess,
  disabled = false,
}: {
  value: PermissionMap;
  onChange?: (next: PermissionMap) => void;
  fullAccess: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const on = PERMISSIONS.filter((key) => value[key] === true).length;
  return (
    <>
      <ListRow
        icon={ShieldCheck}
        label={t('members.permissions')}
        value={fullAccess ? t('members.fullAccess') : t('members.permissionSummary', { on, total: PERMISSIONS.length })}
        onPress={fullAccess ? undefined : () => setOpen(true)}
      />
      <BottomSheet
        visible={open}
        title={t('members.permissions')}
        onClose={() => setOpen(false)}
        footer={<Button title={t('common.done')} onPress={() => setOpen(false)} />}
      >
        <PermissionsEditor value={value} onChange={onChange ?? (() => undefined)} disabled={disabled || !onChange} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  label: { flex: 1 },
});
