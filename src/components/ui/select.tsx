import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './app-text';
import { Sheet } from './sheet';

export type SelectOption = { value: string; label: string; hint?: string };

export function Select({
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
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <AppText style={styles.value} muted={!selected} numberOfLines={1}>
          {selected?.label ?? placeholder ?? ''}
        </AppText>
        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            style={({ pressed }) => [
              styles.option,
              { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.value}>
              <AppText>{option.label}</AppText>
              {option.hint ? (
                <AppText variant="caption" muted>
                  {option.hint}
                </AppText>
              ) : null}
            </View>
            {option.value === value ? <Check size={20} color={colors.primary} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, marginBottom: Spacing.lg },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  value: { flex: 1 },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
