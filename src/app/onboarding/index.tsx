import { router } from 'expo-router';
import { Building2, LogIn } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useConnectivity } from '@/services/sync/connectivity';
import { useTranslation } from '@/localization';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useWorkspace } from '@/providers/workspace-provider';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { signOut } = useSignOut();
  const { workspaceId, fromCache } = useWorkspace();
  const isOnline = useConnectivity((state) => state.isOnline);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <AppText variant="title" style={styles.center}>
          {t('onboarding.title')}
        </AppText>
        <AppText muted style={styles.center}>
          {t('onboarding.subtitle')}
        </AppText>
      </View>
      {!isOnline ? (
        <AppText style={[styles.center, { color: colors.warning }]}>
          {fromCache ? t('common.mayBeOutdated') : t('auth.needsConnection')}
        </AppText>
      ) : null}
      <Card style={styles.card}>
        <Building2 size={28} color={colors.primary} />
        <AppText variant="heading">{t('onboarding.createTitle')}</AppText>
        <AppText muted>{t('onboarding.createHint')}</AppText>
        <Button title={t('onboarding.create')} onPress={() => router.push('/onboarding/create')} />
      </Card>
      <Card style={styles.card}>
        <LogIn size={28} color={colors.primary} />
        <AppText variant="heading">{t('onboarding.joinTitle')}</AppText>
        <AppText muted>{t('onboarding.joinHint')}</AppText>
        <Button title={t('onboarding.join')} variant="secondary" onPress={() => router.push('/join')} />
      </Card>
      {workspaceId ? (
        <Button title={t('common.back')} variant="ghost" onPress={() => router.replace('/(app)')} />
      ) : (
        <Button title={t('auth.signOut')} variant="ghost" onPress={signOut} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', maxWidth: 520, gap: Spacing.lg },
  brand: { gap: Spacing.xs },
  center: { textAlign: 'center' },
  card: { gap: Spacing.sm, marginBottom: 0 },
});
