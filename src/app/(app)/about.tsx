import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Globe, HandHeart, Info, ShieldCheck } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand/brand-mark';
import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText, Card, GroupedList, ListRow, Screen } from '@/components/ui';
import { developerView } from '@/domain/marketing';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useDeveloperInfo } from '@/services/marketing/use-marketing';
import { sizes, spacing, useTheme } from '@/theme';

export default function AboutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const developer = useDeveloperInfo();
  const view = developerView(developer.data);
  const version = Constants.expoConfig?.version ?? '';
  const build = Constants.expoConfig?.ios?.buildNumber ?? (Constants.expoConfig?.android?.versionCode?.toString() || '');

  const open = (url: string) =>
    Linking.openURL(url).catch(() => emitActionFeedback({ message: t('support.openFailed'), kind: 'error' }));

  return (
    <Screen header={<ScreenHeader title={t('about.title')} back />} contentStyle={styles.content}>
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
        <AppText variant="bodySm" tone="secondary">
          {t('about.mapAttribution')}
        </AppText>
      </Card>

      <GroupedList>
        <ListRow icon={HandHeart} tile="lime" label={t('about.support')} onPress={() => router.push('/support')} />
        {view.website ? (
          <ListRow
            icon={Globe}
            label={t('about.website')}
            hint={view.name ? t('about.madeBy', { name: view.name }) : undefined}
            onPress={() => open(view.website!)}
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
