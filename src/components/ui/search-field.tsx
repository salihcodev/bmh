import { Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTranslation } from '@/localization';
import { detectScript, iconStroke, radii, resolveFontFamily, sizes, spacing, typography, useTheme } from '@/theme';

/** Pill search bar on a white surface, with a clear button once there is text. */
export function SearchBar({ onChangeText, value, ...props }: Omit<TextInputProps, 'style'>) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { writingDirection, textAlign } = useDirection();
  const script = detectScript(value || props.placeholder || '');
  return (
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Search size={sizes.icon} color={colors.textSecondary} strokeWidth={iconStroke} />
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        accessibilityRole="search"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={false}
        returnKeyType="search"
        textAlign={textAlign}
        style={[
          styles.input,
          { color: colors.textPrimary, writingDirection, fontFamily: resolveFontFamily('regular', script) },
        ]}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
          hitSlop={12}
          onPress={() => onChangeText?.('')}
        >
          <X size={sizes.iconSm} color={colors.textSecondary} strokeWidth={iconStroke} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Legacy name. */
export const SearchField = SearchBar;

const styles = StyleSheet.create({
  search: {
    minHeight: 48,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
  },
  input: { flex: 1, fontSize: typography.body.size, minHeight: 46 },
});
