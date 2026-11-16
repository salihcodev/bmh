import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { BottomSheet } from './sheet';

export type SelectOption = { value: string; label: string; hint?: string };

/** Looks like a TextField; opens a bottom sheet with tile options and a check on the selected one. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  disabled = false,
}: {
  label: string;
  value: string | null | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? `${label}, ${selected.label}` : label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: error ? colors.danger : colors.surfaceMuted,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <AppText variant="bodyLg" weight="regular" tone={selected ? 'primary' : 'tertiary'} style={styles.value} numberOfLines={1}>
          {selected?.label ?? placeholder ?? ''}
        </AppText>
        <ChevronDown size={sizes.icon} color={colors.textSecondary} strokeWidth={iconStroke} />
      </Pressable>
      {error ? (
        <AppText variant="bodySm" tone="danger">
          {error}
        </AppText>
      ) : null}
      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: isSelected ? colors.textPrimary : colors.surfaceMuted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={styles.value}>
                <AppText variant="bodyLg">{option.label}</AppText>
                {option.hint ? (
                  <AppText variant="bodySm" muted>
                    {option.hint}
                  </AppText>
                ) : null}
              </View>
              {isSelected ? <Check size={sizes.icon} color={colors.textPrimary} strokeWidth={iconStroke} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>
    </View>
  );
}

/** Legacy name. */
export const Select = SelectField;

const styles = StyleSheet.create({
  wrap: { gap: spacing[1], marginBottom: spacing[4] },
  field: {
    minHeight: sizes.input,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  value: { flex: 1 },
  option: {
    minHeight: sizes.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
});
