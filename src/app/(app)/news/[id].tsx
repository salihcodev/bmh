import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Newspaper } from 'lucide-react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText, EmptyState, ErrorState, LoadingState, Screen, Tag } from '@/components/ui';
import { pick, type Language } from '@/domain/marketing';
import { useTranslation } from '@/localization';
import { useNewsItem } from '@/services/marketing/use-marketing';
import { blurPlaceholderUrl, cloudinaryUrl, deliveryWidth } from '@/services/media/cloudinary';
import { radii, screenPadding, sizes, spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

const COVER_ASPECT = 16 / 9;

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const language: Language = i18n.language === 'en' ? 'en' : 'ar';
  const item = useNewsItem(id);
  const coverWidth = Math.min(width, sizes.maxContent) - screenPadding * 2;

  if (item.status === 'loading') {
    return (
      <Screen scroll={false} header={<ScreenHeader back title={t('news.title')} />}>
        <LoadingState />
      </Screen>
    );
  }
  if (item.status === 'error' || item.data === false || !item.data) {
    return (
      <Screen scroll={false} header={<ScreenHeader back title={t('news.title')} />}>
        {item.status === 'error' ? (
          <ErrorState message={t('marketingHome.newsLoadFailed')} onRetry={item.retry} />
        ) : (
          <EmptyState icon={Newspaper} title={t('news.notFound')} />
        )}
      </Screen>
    );
  }

  const news = item.data;
  const coverId = news.coverImagePublicId?.[language] ?? null;
  const cover = cloudinaryUrl(coverId, { width: deliveryWidth(coverWidth) });
  const placeholder = blurPlaceholderUrl(coverId);
  const body = pick(news.body, language);

  return (
    <Screen surface="white" header={<ScreenHeader back title={t('news.title')} />} contentStyle={styles.content}>
      {cover ? (
        <Image
          source={{ uri: cover }}
          placeholder={placeholder ? { uri: placeholder } : undefined}
          contentFit="cover"
          cachePolicy="disk"
          style={[styles.cover, { width: coverWidth, height: coverWidth / COVER_ASPECT, backgroundColor: colors.surfaceMuted }]}
          accessible={false}
        />
      ) : null}
      <View style={styles.meta}>
        {news.isPinned ? <Tag label={t('news.pinned')} tone="lime" /> : null}
        {news.publishedAt ? (
          <AppText variant="caption" tone="tertiary">
            {formatDate(new Date(news.publishedAt))}
          </AppText>
        ) : null}
      </View>
      <AppText variant="h1">{pick(news.title, language)}</AppText>
      <AppText variant="body" tone="secondary">
        {pick(news.summary, language)}
      </AppText>
      {/* Body is stored as markdown; rendered as paragraphs until a markdown renderer is added. */}
      {body
        .split(/\n{2,}/)
        .map((p) => p.replace(/^#+\s*|[*_`]/g, '').trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <AppText key={index} variant="body">
            {paragraph}
          </AppText>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  cover: { borderRadius: radii.xl },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
