import { Switch as NativeSwitch } from 'react-native';

import { useTheme } from '@/theme';

/** Lime switch from the reference settings list. */
export function Switch({
  value,
  onValueChange,
  label,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <NativeSwitch
      accessibilityLabel={label}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.accent }}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.border}
    />
  );
}
