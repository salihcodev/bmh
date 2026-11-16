import { AlertTriangle, CheckCircle2, CloudOff, Info, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { BottomSheet } from './sheet';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success' | 'offline';

/** Inline notice strip (offline, sync problem, permission note). Not a marketing banner. */
export function InlineBanner({
  tone = 'info',
  message,
  actionLabel,
  onAction,
}: {
  tone?: BannerTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const map: Record<BannerTone, { bg: string; fg: string; Icon: LucideIcon }> = {
    info: { bg: colors.infoTint, fg: colors.info, Icon: Info },
    warning: { bg: colors.warningTint, fg: colors.warning, Icon: AlertTriangle },
    danger: { bg: colors.dangerTint, fg: colors.danger, Icon: AlertTriangle },
    success: { bg: colors.successTint, fg: colors.success, Icon: CheckCircle2 },
    offline: { bg: colors.surfaceMuted, fg: colors.textSecondary, Icon: CloudOff },
  };
  const { bg, fg, Icon } = map[tone];
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: bg }]}>
      <Icon size={sizes.icon} color={fg} strokeWidth={iconStroke} />
      <AppText variant="bodySm" style={[styles.flex, { color: colors.textPrimary }]}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={12}>
          <AppText variant="bodySm" weight="bold">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Confirmation in a bottom sheet: title, body, primary (or destructive) confirm and cancel. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button title={confirmLabel} variant={destructive ? 'destructive' : 'primary'} onPress={onConfirm} />
          <Button title={cancelLabel} variant="ghost" onPress={onCancel} />
        </>
      }
    >
      {message ? (
        <AppText variant="body" muted center>
          {message}
        </AppText>
      ) : null}
      {children}
    </BottomSheet>
  );
}

/** Thin progress bar (uploads, onboarding steps). `value` is 0..1. */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    marginBottom: spacing[3],
  },
  track: { height: 6, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
});
