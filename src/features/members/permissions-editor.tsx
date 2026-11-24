import { StyleSheet, View } from 'react-native';

import { AppText, Chip, GroupedList, SectionHeader, Switch } from '@/components/ui';
import { useTranslation } from '@/localization';
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PRESET_SEEDS,
  type Bilingual,
  type PermissionDef,
  type PermissionScope,
} from '@/services/permissions/catalog';
import { spacing, useTheme } from '@/theme';

export function useLocalizedText() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  return (value: Bilingual) => value[lang];
}

function groupsFor(scope: PermissionScope) {
  return PERMISSION_GROUPS.map((group) => ({
    group,
    keys: PERMISSION_CATALOG.filter((d) => d.group === group.id && d.scope === scope && !d.baseline),
  })).filter((entry) => entry.keys.length > 0);
}

/**
 * Permission picker grouped as in the catalog. Keys outside `grantable` stay disabled so nobody
 * composes a role with more than they hold (rules enforce the same with hasAll).
 */
export function PermissionsEditor({
  scope,
  value,
  onChange,
  grantable,
  readOnly = false,
}: {
  scope: PermissionScope;
  value: readonly string[];
  onChange?: (next: string[]) => void;
  grantable?: readonly string[];
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const text = useLocalizedText();
  const selected = new Set(value);
  const allowed = grantable ? new Set(grantable) : null;
  const canToggle = (def: PermissionDef) => !readOnly && !!onChange && (!allowed || allowed.has(def.key));

  const set = (keys: readonly string[], on: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (allowed && !allowed.has(key)) continue;
      if (on) next.add(key);
      else next.delete(key);
    }
    onChange?.(PERMISSION_CATALOG.filter((d) => next.has(d.key)).map((d) => d.key));
  };

  const presets = PRESET_SEEDS.filter((p) => p.scope === scope);

  return (
    <View style={styles.root}>
      {!readOnly && onChange && presets.length > 0 ? (
        <View>
          <SectionHeader title={t('roles.presets')} />
          <AppText variant="caption" tone="secondary" style={styles.hint}>
            {t('roles.presetsHint')}
          </AppText>
          <View style={styles.chips}>
            {presets.map((preset) => (
              <Chip key={preset.id} label={text(preset.name)} onPress={() => set(preset.permissions, true)} />
            ))}
          </View>
        </View>
      ) : null}

      {groupsFor(scope).map(({ group, keys }) => {
        const toggleable = keys.filter(canToggle);
        const allOn = toggleable.length > 0 && toggleable.every((d) => selected.has(d.key));
        return (
          <View key={group.id}>
            <SectionHeader
              title={text(group.name)}
              action={
                toggleable.length > 0 ? (
                  <Chip
                    label={allOn ? t('roles.clearGroup') : t('roles.selectGroup')}
                    selected={allOn}
                    onPress={() => set(toggleable.map((d) => d.key), !allOn)}
                  />
                ) : undefined
              }
            />
            <GroupedList>
              {keys.map((def, index) => (
                <View
                  key={def.key}
                  style={[
                    styles.row,
                    index > 0 && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={styles.label}>
                    <AppText variant="body">{text(def.label)}</AppText>
                    <AppText variant="caption" tone="secondary">
                      {text(def.description)}
                    </AppText>
                  </View>
                  <Switch
                    label={text(def.label)}
                    disabled={!canToggle(def)}
                    value={selected.has(def.key)}
                    onValueChange={(on) => set([def.key], on)}
                  />
                </View>
              ))}
            </GroupedList>
          </View>
        );
      })}
    </View>
  );
}

export function permissionCount(scope: PermissionScope): number {
  return PERMISSION_CATALOG.filter((d) => d.scope === scope && !d.baseline).length;
}

const styles = StyleSheet.create({
  root: { gap: spacing[6] },
  hint: { marginBottom: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  label: { flex: 1, gap: spacing[1] },
});
