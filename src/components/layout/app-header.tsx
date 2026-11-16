import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDirection } from '@/hooks/use-direction';
import { useTranslation } from '@/localization';

import { SyncPill } from './sync-pill';

export function AppHeader({
  title,
  subtitle,
  back = false,
  right,
  onTitlePress,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  onTitlePress?: () => void;
}) {
  const { colors } = useAppTheme();
  const { isRTL } = useDirection();
  const { t } = useTranslation();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  return (
    <View style={[styles.bar, { backgroundColor: colors.topBar }]}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
          style={styles.back}
        >
          <BackIcon size={26} color="#FFFFFF" />
        </Pressable>
      ) : null}
      <Pressable
        disabled={!onTitlePress}
        onPress={onTitlePress}
        accessibilityRole={onTitlePress ? 'button' : 'header'}
        style={styles.titleWrap}
      >
        <AppText variant="heading" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </Pressable>
      {right}
      <SyncPill />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  back: { width: TouchTarget - 8, height: TouchTarget, justifyContent: 'center' },
  titleWrap: { flex: 1 },
  title: { color: '#FFFFFF' },
  subtitle: { color: 'rgba(255,255,255,0.75)' },
});
