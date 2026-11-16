import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { subscribeToActionFeedback, type ActionFeedbackEvent, type FeedbackKind } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { elevation, iconStroke, palette, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';

type ToastContextValue = {
  showToast: (options: ActionFeedbackEvent) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Ink toast at the top with a coloured status icon and an optional inline action (Undo). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ActionFeedbackEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((options: ActionFeedbackEvent) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(options);
    timer.current = setTimeout(() => setToast(null), options.duration ?? (options.action ? 6000 : 3500));
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => subscribeToActionFeedback(showToast), [showToast]);

  const value = useMemo(() => ({ showToast, hideToast }), [hideToast, showToast]);
  const kind: FeedbackKind = toast?.kind ?? 'info';
  const iconColor = { error: colors.danger, warning: colors.warning, success: palette.lime, info: palette.white }[kind];
  const Icon = kind === 'error' || kind === 'warning' ? AlertCircle : kind === 'success' ? CheckCircle2 : Info;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing[2] }]}>
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[styles.toast, elevation.floating, { backgroundColor: palette.ink, shadowColor: colors.shadow }]}
          >
            <Icon size={sizes.icon} color={iconColor} strokeWidth={iconStroke} />
            <AppText variant="body" weight="medium" style={[styles.message, { color: palette.white }]}>
              {toast.message}
            </AppText>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                hitSlop={12}
                onPress={() => {
                  toast.action?.onPress();
                  hideToast();
                }}
              >
                <AppText variant="body" weight="bold" style={{ color: palette.lime }}>
                  {toast.action.label}
                </AppText>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={12} onPress={hideToast}>
                <X size={sizes.iconSm} color={palette.white} strokeWidth={iconStroke} />
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', start: screenPadding, end: screenPadding, zIndex: 1000, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 560,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
  },
  message: { flex: 1 },
});
