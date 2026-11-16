import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDirection } from '@/hooks/use-direction';

import { AppText } from './app-text';

export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; error?: string; hint?: string; ltr?: boolean }
>(function Field({ label, error, hint, ltr = false, multiline, style, onFocus, onBlur, ...props }, ref) {
  const { colors } = useAppTheme();
  const { writingDirection, textAlign } = useDirection();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  // Phone numbers, emails and coordinates stay LTR even in Arabic.
  const direction = ltr ? 'ltr' : writingDirection;
  const align = ltr ? 'left' : textAlign;
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={ref}
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        multiline={multiline}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        textAlign={align}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          { writingDirection: direction, color: colors.text, backgroundColor: colors.surface, borderColor },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, marginBottom: Spacing.lg },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
  multiline: { minHeight: 110, paddingTop: Spacing.md, textAlignVertical: 'top' },
});
