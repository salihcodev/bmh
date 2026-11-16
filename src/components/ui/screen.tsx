import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding, sizes, spacing, useTheme } from '@/theme';

/**
 * Grey canvas, safe-area top inset, optional header, 20pt side padding and a footer
 * pinned above the home indicator for the primary CTA.
 */
export function Screen({
  children,
  scroll = true,
  header,
  footer,
  contentStyle,
  refreshing,
  onRefresh,
  surface = 'canvas',
}: {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** `white` for focused form screens (auth, onboarding). */
  surface?: 'canvas' | 'white';
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const background = surface === 'white' ? colors.surface : colors.background;
  return (
    <View style={[styles.flex, { backgroundColor: background, paddingTop: insets.top }]}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.staticContent, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { backgroundColor: background, paddingBottom: insets.bottom + spacing[3] }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    width: '100%',
    maxWidth: sizes.maxContent,
    alignSelf: 'center',
    paddingHorizontal: screenPadding,
    paddingTop: spacing[2],
    paddingBottom: 120,
  },
  staticContent: {
    flex: 1,
    width: '100%',
    maxWidth: sizes.maxContent,
    alignSelf: 'center',
  },
  footer: {
    width: '100%',
    maxWidth: sizes.maxContent,
    alignSelf: 'center',
    paddingHorizontal: screenPadding,
    paddingTop: spacing[3],
    gap: spacing[2],
  },
});
