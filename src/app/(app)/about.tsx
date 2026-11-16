import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Globe, HandHeart, Info, ShieldCheck } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand/brand-mark';
import { AppHeader } from '@/components/layout/app-header';
import { AppText, Card, GroupedList, ListRow, Screen } from '@/components/ui';
import { supportView } from '@/domain/marketing';
import { emitActionFeedback } from '@/lib/action-feedback';
import { isLanguage, useTranslation } from '@/localization';
import { useSupportConfig } from '@/services/marketing/use-marketing';
import { sizes, spacing, useTheme } from '@/theme';

export default function AboutScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const config = useSupportConfig();
  const language = isLanguage(i18n.language) ? i18n.language : 'ar';
  const view = supportView(config.data, language);
  const version = Constants.expoConfig?.version ?? '';
  const build = Constants.expoConfig?.ios?.buildNumber ?? (Constants.expoConfig?.android?.versionCode?.toString() || '');

  const open = (url: string) =>
    Linking.openURL(url).catch(() => emitActionFeedback({ message: t('support.openFailed'), kind: 'error' }));

  return (
    <Screen header={<AppHeader title={t('about.title')} back />} contentStyle={styles.content}>
      <View style={styles.identity}>
        <BrandMark size={sizes.avatarLg + spacing[6]} tile on={colors.accent} color={colors.onAccent} />
        <AppText variant="h1" center>
          {t('app.name')}
        </AppText>
        <AppText variant="body" tone="secondary" center>
          {t('about.tagline')}
        </AppText>
      </View>

      <GroupedList>
        <ListRow icon={Info} label={t('about.version')} value={version} />
        {build ? <ListRow icon={Info} label={t('about.build')} value={build} /> : null}
      </GroupedList>

      <Card style={styles.privacy}>
        <View style={styles.privacyHead}>
          <ShieldCheck size={sizes.icon} color={colors.textPrimary} />
          <AppText variant="h3">{t('about.privacyTitle')}</AppText>
        </View>
        <AppText variant="bodySm" tone="secondary">
          {t('about.privacyBody')}
        </AppText>
      </Card>

      <GroupedList>
        <ListRow icon={HandHeart} tile="lime" label={t('about.support')} onPress={() => router.push('/support')} />
        {view.developerWebsite ? (
          <ListRow
            icon={Globe}
            label={t('about.website')}
            hint={view.developerName ? t('about.madeBy', { name: view.developerName }) : undefined}
            onPress={() => open(view.developerWebsite!)}
          />
        ) : null}
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  identity: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  privacy: { gap: spacing[2] },
  privacyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
