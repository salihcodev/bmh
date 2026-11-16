import { Search } from 'lucide-react-native';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDirection } from '@/hooks/use-direction';

export function SearchField(props: Omit<TextInputProps, 'style'>) {
  const { colors } = useAppTheme();
  const { writingDirection, textAlign } = useDirection();
  return (
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Search size={20} color={colors.textSecondary} />
      <TextInput
        {...props}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={false}
        textAlign={textAlign}
        style={[styles.input, { color: colors.text, writingDirection }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 48,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  input: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, minHeight: 46 },
});
