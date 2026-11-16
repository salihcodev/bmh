import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from 'react-native';

import { Radii, Shadows, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export function Card({ style, ...props }: ViewProps) {
  const { colors } = useAppTheme();
  return (
    <View
      {...props}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, Shadows, style]}
    />
  );
}

export function PressableCard({ style, ...props }: PressableProps & { style?: ViewProps['style'] }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        Shadows,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
