import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';

import { AppText } from './app-text';

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Row({
  children,
  gap = Spacing.sm,
  wrap = false,
  style,
}: {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, { gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.xl, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
