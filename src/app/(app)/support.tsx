import * as Clipboard from 'expo-clipboard';
import { Copy, ExternalLink, Globe, HandHeart, ShieldCheck } from 'lucide-react-native';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  GroupedList,
  IconButton,
  InlineBanner,
  ListRow,
  Screen,
  SectionHeader,
  SkeletonCard,
  useDelayedLoading,
} from '@/components/ui';
import { supportView } from '@/domain/marketing';
import { emitActionFeedback } from '@/lib/action-feedback';
import { isLanguage, useTranslation } from '@/localization';
import { useSupportConfig } from '@/services/marketing/use-marketing';
import { iconStroke, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

/** Donations via InstaPay. Every identifier comes from appConfig/support; placeholders count as missing. */
export default function SupportScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const config = useSupportConfig();
  const showSkeleton = useDelayedLoading(config.status === 'loading');
  const language = isLanguage(i18n.language) ? i18n.language : 'ar';
  const view = supportView(config.data, language);
  const qrSize = Math.min(width - screenPadding * 2 - spacing[10] * 2, 240);

  const open = (url: string) =>
    Linking.openURL(url).catch(() => emitActionFeedback({ message: t('support.openFailed'), kind: 'error' }));
  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    emitActionFeedback({ message: t('support.copied'), kind: 'success' });
  };

  return (
    <Screen header={<AppHeader title={t('support.title')} back />} contentStyle={styles.content}>
      {config.status === 'loading' ? (
        showSkeleton ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null
      ) : config.status === 'error' ? (
        <ErrorState message={t('support.loadFailed')} onRetry={config.retry} />
      ) : (
        <>
          <Card tone="ink" style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: colors.accent }]}>
              <HandHeart size={sizes.iconLg} color={colors.onAccent} strokeWidth={iconStroke} />
            </View>
            <AppText variant="h2" tone="onPrimary">
              {t('support.heroTitle')}
            </AppText>
            {view.message ? (
              <AppText variant="body" tone="onPrimary">
                {view.message}
              </AppText>
            ) : null}
          </Card>

          {view.canDonate ? (
            <View>
              <SectionHeader title={t('support.instapayTitle')} />
              <Card style={styles.pay}>
                {view.instapayLink ? (
                  <>
                    <View
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={t('support.qrLabel')}
                      style={[styles.qr, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <QRCode value={view.instapayLink} size={qrSize} color={colors.textPrimary} backgroundColor={colors.surface} ecl="M" />
                    </View>
                    <AppText variant="bodySm" tone="secondary" center>
                      {t('support.scanHint')}
                    </AppText>
                    <Button variant="lime" title={t('support.openInstapay')} icon={<ExternalLink />} onPress={() => open(view.instapayLink!)} />
                  </>
                ) : null}
                {view.instapayAddress ? (
                  <View style={[styles.address, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={styles.flex}>
                      <AppText variant="caption" tone="secondary">
                        {t('support.address')}
                      </AppText>
                      <AppText variant="bodyLg" weight="semibold" ltr selectable>
                        {view.instapayAddress}
                      </AppText>
                    </View>
                    <IconButton icon={Copy} label={t('support.copy')} onPress={() => void copy(view.instapayAddress!)} />
                  </View>
                ) : null}
              </Card>
              <View style={styles.note}>
                <InlineBanner tone="info" message={t('support.directNote')} />
              </View>
            </View>
          ) : (
            <EmptyState icon={ShieldCheck} title={t('support.unavailableTitle')} hint={t('support.unavailableHint')} />
          )}

          {view.developerWebsite ? (
            <View>
              <SectionHeader title={t('support.developerTitle')} />
              <GroupedList>
                <ListRow
                  icon={Globe}
                  label={view.developerName ?? t('support.website')}
                  hint={view.developerWebsite.replace(/^https:\/\//, '')}
                  onPress={() => open(view.developerWebsite!)}
                />
              </GroupedList>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  flex: { flex: 1 },
  hero: { gap: spacing[3], paddingVertical: spacing[6] },
  heroIcon: { width: sizes.avatarMd, height: sizes.avatarMd, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  pay: { alignItems: 'stretch', gap: spacing[4] },
  qr: { alignSelf: 'center', padding: spacing[4], borderRadius: radii.lg, borderWidth: 1 },
  address: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.md },
  note: { marginTop: spacing[3] },
});
