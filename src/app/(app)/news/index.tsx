import { FlashList } from '@shopify/flash-list';
import { Newspaper } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, Header, ListFooter, Screen, SkeletonList, useDelayedLoading } from '@/components/ui';
import type { Language } from '@/domain/marketing';
import { NewsRow } from '@/features/home/news-row';
import { useTranslation } from '@/localization';
import { useNewsFeed } from '@/services/marketing/use-marketing';
import { screenPadding, sizes, spacing } from '@/theme';

export default function NewsScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'en' ? 'en' : 'ar';
  const feed = useNewsFeed();
  const showSkeleton = useDelayedLoading(feed.status === 'loading');

  return (
    <Screen scroll={false} header={<Header back title={t('news.title')} />}>
      {feed.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : feed.status === 'error' ? (
        <ErrorState message={t('marketingHome.newsLoadFailed')} onRetry={feed.refresh} />
      ) : (
        <FlashList
          data={feed.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NewsRow item={item} language={language} />}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.list}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={feed.refreshing}
          onRefresh={feed.refresh}
          ListEmptyComponent={
            <EmptyState icon={Newspaper} title={t('marketingHome.newsEmpty')} hint={t('marketingHome.newsEmptyHint')} />
          }
          ListFooterComponent={
            feed.items?.length ? (
              <ListFooter loadingMore={feed.loadingMore} error={feed.moreError ? t('states.pageFailed') : null} done={feed.done} onRetry={feed.loadMore} />
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingTop: spacing[2], paddingBottom: sizes.tabBar + spacing[6] },
  separator: { height: spacing[3] },
});
