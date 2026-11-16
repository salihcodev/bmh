import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <AppText variant="title" style={styles.center}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="subtitle" muted style={styles.center}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Card style={styles.card}>{children}</Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', maxWidth: 460, gap: Spacing.xl },
  brand: { alignItems: 'center', gap: Spacing.xs },
  center: { textAlign: 'center' },
  card: { padding: Spacing.xl, gap: Spacing.sm, marginBottom: 0 },
});
