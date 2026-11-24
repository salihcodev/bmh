import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Newspaper, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  Fab,
  ListFooter,
  Screen,
  SkeletonList,
  Switch,
  useDelayedLoading,
} from '@/components/ui';
import { pick, type Language, type NewsItem } from '@/domain/marketing';
import { AdminHeader } from '@/features/admin/admin-header';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { LANGUAGE_NAMES, useTranslation } from '@/localization';
import { setNewsPublished } from '@/services/admin/content-writes';
import { useAdminNews } from '@/services/admin/use-admin';
import { motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

export default function ManageNews() {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState<Language>(i18n.language === 'en' ? 'en' : 'ar');
  const news = useAdminNews();
  const { can } = useCurrentUser();
  const { run } = useAdminAction();
  const showSkeleton = useDelayedLoading(news.status === 'loading');
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (item: NewsItem, published: boolean) => {
    setBusy(item.id);
    await run((a) => setNewsPublished(a, item.id, published), published ? t('manage.news.published') : t('manage.news.draft'));
    setBusy(null);
  };

  const header = (
    <View style={styles.filters}>
      {(['ar', 'en'] as const).map((l) => (
        <Chip key={l} label={LANGUAGE_NAMES[l]} selected={language === l} onPress={() => setLanguage(l)} />
      ))}
    </View>
  );

  return (
    <Screen scroll={false} header={<AdminHeader title={t('manage.news.title')} />}>
      {news.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : news.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={news.refresh} />
      ) : (
        <FlashList
          data={news.items ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ItemSeparatorComponent={Separator}
          onEndReached={news.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={news.refreshing}
          onRefresh={news.refresh}
          renderItem={({ item }) => (
            <NewsRow item={item} language={language} busy={busy === item.id} canPublish={can('news.publish')} onToggle={(v) => toggle(item, v)} />
          )}
          ListEmptyComponent={<EmptyState icon={Newspaper} title={t('manage.news.empty')} hint={t('manage.news.emptyHint')} />}
          ListFooterComponent={
            news.items?.length ? (
              <ListFooter loadingMore={news.loadingMore} error={news.moreError ? t('states.pageFailed') : null} done={news.done} onRetry={news.loadMore} />
            ) : null
          }
        />
      )}
      {can('news.create') ? (
        <Fab label={t('manage.news.add')} icon={<Plus />} extended onPress={() => router.push({ pathname: '/manage/news/[id]', params: { id: 'new' } })} />
      ) : null}
    </Screen>
  );
}

function NewsRow({
  item,
  language,
  busy,
  canPublish,
  onToggle,
}: {
  item: NewsItem;
  language: Language;
  busy: boolean;
  canPublish: boolean;
  onToggle: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pick(item.title, language)}
      onPress={() => router.push({ pathname: '/manage/news/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface }, pressed && { transform: [{ scale: motion.pressScale }] }]}
    >
      <AppText variant="body" weight="semibold" numberOfLines={2}>
        {pick(item.title, language)}
      </AppText>
      <AppText variant="bodySm" tone="secondary" numberOfLines={2}>
        {pick(item.summary, language)}
      </AppText>
      <View style={styles.meta}>
        <View style={styles.tags}>
          <Badge label={item.isPublished ? t('manage.news.published') : t('manage.news.draft')} tone={item.isPublished ? 'success' : 'neutral'} />
          <Badge label={t(`manage.news.categories.${item.category}`, { defaultValue: item.category })} tone="neutral" />
          {item.isPinned ? <Badge label={t('manage.news.pinned')} tone="lime" /> : null}
        </View>
        {canPublish ? <Switch label={t('manage.news.isPublished')} value={item.isPublished} disabled={busy} onValueChange={onToggle} /> : null}
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  filters: { flexDirection: 'row', gap: spacing[2], paddingBottom: spacing[3] },
  list: { paddingHorizontal: screenPadding, paddingBottom: sizes.fab + spacing[10] },
  separator: { height: spacing[3] },
  row: { padding: spacing[4], borderRadius: radii.xl, gap: spacing[2] },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  tags: { flexDirection: 'row', gap: spacing[2], flexShrink: 1, flexWrap: 'wrap' },
});
