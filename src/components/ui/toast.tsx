import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDirection } from '@/hooks/use-direction';
import { subscribeToActionFeedback, type ActionFeedbackEvent, type FeedbackKind } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';

type ToastContextValue = {
  showToast: (options: ActionFeedbackEvent) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  const { writingDirection } = useDirection();
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
    timer.current = setTimeout(() => setToast(null), options.duration ?? 3500);
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
  const color = { error: colors.danger, warning: colors.warning, success: colors.success, info: colors.primary }[kind];
  const Icon = kind === 'error' ? AlertCircle : kind === 'success' ? CheckCircle2 : Info;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { top: insets.top + Spacing.sm }]}>
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[styles.toast, Shadows, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          >
            <View style={[styles.icon, { backgroundColor: `${color}1A` }]}>
              <Icon size={20} color={color} />
            </View>
            <Text style={[styles.message, { color: colors.text, writingDirection }]}>{toast.message}</Text>
            <Pressable accessibilityLabel={t('common.close')} hitSlop={12} onPress={hideToast}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
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
  host: { position: 'absolute', start: Spacing.lg, end: Spacing.lg, zIndex: 1000, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 560,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, borderRadius: Radii.round, alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1, fontFamily: Fonts.medium, fontSize: 14, lineHeight: 22 },
});
