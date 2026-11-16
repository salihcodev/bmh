import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { PERMISSIONS, type PermissionMap } from '@/services/permissions/matrix';

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
  const { colors } = useAppTheme();
  return (
    <View>
      {PERMISSIONS.map((key) => (
        <View key={key} style={[styles.row, { borderBottomColor: colors.border }]}>
          <AppText style={styles.label}>{t(`permissions.${key}`)}</AppText>
          <Switch
            accessibilityLabel={t(`permissions.${key}`)}
            disabled={disabled}
            value={value[key] === true}
            trackColor={{ true: colors.primary, false: colors.border }}
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

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
});
