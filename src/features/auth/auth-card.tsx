import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand/brand-mark';
import { AppText, Header, Screen } from '@/components/ui';
import { spacing } from '@/theme';

/** Auth layout: white focused screen, brand tile, large title and the form below it. */
export function AuthCard({
  title,
  subtitle,
  back = false,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: ReactNode;
}) {
  return (
    <Screen
      surface="white"
      header={back ? <Header title="" back onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} /> : undefined}
      contentStyle={styles.content}
    >
      <View style={styles.brand}>
        <BrandMark size={64} tile />
        <AppText variant="h1">{title}</AppText>
        {subtitle ? (
          <AppText variant="body" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.form}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', maxWidth: 480, gap: spacing[6], paddingTop: spacing[6] },
  brand: { gap: spacing[2] },
  form: { gap: spacing[2] },
});
