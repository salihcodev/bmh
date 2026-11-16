import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radii, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';

import { AppText } from './app-text';

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border, paddingBottom: insets.bottom + Spacing.lg },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title ? (
            <AppText variant="heading" style={styles.title}>
              {title}
            </AppText>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: Spacing.sm },
  title: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
});
