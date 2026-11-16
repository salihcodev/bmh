import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontSizes } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDirection } from '@/hooks/use-direction';

type Variant = 'body' | 'title' | 'subtitle' | 'label' | 'caption' | 'heading';

export function AppText({
  style,
  variant = 'body',
  muted = false,
  ltr = false,
  ...props
}: TextProps & { variant?: Variant; muted?: boolean; ltr?: boolean }) {
  const { colors } = useAppTheme();
  const { writingDirection } = useDirection();
  return (
    <Text
      {...props}
      style={[
        styles.base,
        styles[variant],
        { color: muted ? colors.textSecondary : colors.text, writingDirection: ltr ? 'ltr' : writingDirection },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { fontFamily: Fonts.sans, fontSize: FontSizes.md },
  body: { lineHeight: 24 },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.xxl, lineHeight: 40 },
  heading: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, lineHeight: 28 },
  subtitle: { fontSize: FontSizes.sm, lineHeight: 22 },
  label: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 22 },
  caption: { fontSize: FontSizes.xs, lineHeight: 18 },
});
