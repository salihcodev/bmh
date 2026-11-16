import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './app-text';

export function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {hint ? (
        <AppText variant="subtitle" muted style={styles.center}>
          {hint}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12}>
          <AppText style={[styles.action, { color: colors.primary }]}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingState() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <AppText style={[styles.center, { color: colors.danger }]}>{message}</AppText>
      {retryLabel && onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={12}>
          <AppText style={[styles.action, { color: colors.primary }]}>{retryLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    minHeight: 180,
    paddingVertical: Spacing.huge,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  center: { textAlign: 'center' },
  action: { fontFamily: Fonts.bold, textDecorationLine: 'underline' },
});
