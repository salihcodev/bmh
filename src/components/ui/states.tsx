import { AlertCircle, Hourglass, Inbox, Lock, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/localization';
import { iconStroke, radii, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';

function StateLayout({
  icon: Icon,
  tone = 'muted',
  title,
  hint,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon: LucideIcon;
  tone?: 'muted' | 'danger' | 'lime';
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { colors } = useTheme();
  const tile = { muted: colors.surface, danger: colors.dangerTint, lime: colors.accent }[tone];
  const fg = { muted: colors.textPrimary, danger: colors.danger, lime: colors.onAccent }[tone];
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.tile, { backgroundColor: tile }]}>
        <Icon size={28} color={fg} strokeWidth={iconStroke} />
      </View>
      <AppText variant="h3" center>
        {title}
      </AppText>
      {hint ? (
        <AppText variant="body" muted center>
          {hint}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} fullWidth={false} compact style={styles.action} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button title={secondaryLabel} onPress={onSecondary} variant="ghost" fullWidth={false} compact />
      ) : null}
    </View>
  );
}

/** Empty list or screen: icon tile, one-line title, hint, and the next useful action. */
export function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
  icon = Inbox,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}) {
  return <StateLayout icon={icon} title={title} hint={hint} actionLabel={actionLabel} onAction={onAction} />;
}

/** Load failure with retry. `message` is the plain-language explanation. */
export function ErrorState({
  message,
  title,
  retryLabel,
  onRetry,
}: {
  message: string;
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <StateLayout
      icon={AlertCircle}
      tone="danger"
      title={title ?? t('states.errorTitle')}
      hint={message}
      actionLabel={onRetry ? (retryLabel ?? t('common.retry')) : undefined}
      onAction={onRetry}
    />
  );
}

export function NoPermissionState({ hint }: { hint?: string }) {
  const { t } = useTranslation();
  return <StateLayout icon={Lock} title={t('states.noPermissionTitle')} hint={hint ?? t('states.noPermissionHint')} />;
}

export function ComingSoon({ title, hint }: { title?: string; hint?: string }) {
  const { t } = useTranslation();
  return <StateLayout icon={Hourglass} tone="lime" title={title ?? t('states.comingSoonTitle')} hint={hint ?? t('states.comingSoonHint')} />;
}

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.textPrimary} size="large" />
    </View>
  );
}

/** List footer: spinner while fetching the next page, a retry row on failure, or the end marker. */
export function ListFooter({
  loadingMore,
  error,
  done,
  onRetry,
}: {
  loadingMore: boolean;
  error?: string | null;
  done: boolean;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (loadingMore) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.footer}>
        <AppText variant="bodySm" tone="danger" center>
          {t('states.pageFailed')}
        </AppText>
        <Button title={t('common.retry')} variant="secondary" compact fullWidth={false} onPress={onRetry} />
      </View>
    );
  }
  if (done) {
    return (
      <View style={styles.footer}>
        <AppText variant="caption" tone="tertiary" center>
          {t('states.endOfList')}
        </AppText>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    minHeight: 220,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  tile: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  action: { marginTop: spacing[3] },
  footer: { paddingVertical: spacing[6], alignItems: 'center', gap: spacing[2] },
});
