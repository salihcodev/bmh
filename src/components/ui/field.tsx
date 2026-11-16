import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { detectScript, radii, resolveFontFamily, sizes, spacing, typography, useTheme } from '@/theme';

import { AppText } from './app-text';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Phone numbers, emails, codes and coordinates stay LTR in Arabic. */
  ltr?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

/** Filled grey input (radius 16, 56pt) with the label above and helper/error below. */
export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, error, hint, ltr = false, multiline, style, onFocus, onBlur, leading, trailing, ...props },
  ref,
) {
  const { colors } = useTheme();
  const { writingDirection, textAlign } = useDirection();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.textPrimary : colors.surfaceMuted;
  const script = ltr ? 'latin' : detectScript(props.value || props.placeholder || '');
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          { backgroundColor: colors.surfaceMuted, borderColor },
        ]}
      >
        {leading}
        <TextInput
          ref={ref}
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          multiline={multiline}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          textAlign={ltr ? 'left' : textAlign}
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
            multiline && styles.multilineInput,
            {
              writingDirection: ltr ? 'ltr' : writingDirection,
              color: colors.textPrimary,
              fontFamily: resolveFontFamily('regular', script),
            },
            style,
          ]}
        />
        {trailing}
      </View>
      {error ? (
        <AppText variant="bodySm" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="bodySm" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

/** Legacy name. */
export const Field = TextField;

/** Phone input: always LTR, phone keypad, with a fixed country prefix shown at the start. */
export const PhoneField = forwardRef<TextInput, Omit<FieldProps, 'ltr' | 'keyboardType'> & { prefix?: string }>(
  function PhoneField({ prefix, ...props }, ref) {
    return (
      <TextField
        ref={ref}
        {...props}
        ltr
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        leading={
          prefix ? (
            <AppText variant="bodyLg" ltr muted>
              {prefix}
            </AppText>
          ) : undefined
        }
      />
    );
  },
);

const styles = StyleSheet.create({
  wrap: { gap: spacing[1], marginBottom: spacing[4] },
  box: {
    minHeight: sizes.input,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  input: { flex: 1, fontSize: typography.bodyLg.size, minHeight: sizes.input - 4 },
  multiline: { alignItems: 'flex-start' },
  multilineInput: { minHeight: 110, paddingTop: spacing[4], textAlignVertical: 'top' },
});
