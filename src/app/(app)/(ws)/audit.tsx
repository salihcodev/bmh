import { FlashList } from '@shopify/flash-list';
import { ScrollText } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { EmptyState, ErrorState, ListFooter, Screen, SkeletonList, useDelayedLoading } from '@/components/ui';
import { EventRow } from '@/features/history/event-row';
import { usePagedEvents } from '@/features/history/use-paged-events';
import { errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace } from '@/providers/workspace-provider';
import { refs } from '@/services/firebase/refs';
import { radii, screenPadding, spacing, useTheme } from '@/theme';

export default function AuditScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { wid } = useActiveWorkspace();
  const ref = useMemo(() => (wid ? refs.audit(wid) : null), [wid]);
  const feed = usePagedEvents(ref);
  const showSkeleton = useDelayedLoading(feed.status === 'loading');

  return (
    <Screen scroll={false} header={<ScreenHeader title={t('workspace.auditLog')} back />}>
      {feed.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : feed.status === 'error' ? (
        <ErrorState message={errorMessage(feed.error)} onRetry={feed.refresh} />
      ) : (
        <FlashList
          data={feed.items ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.item,
                { backgroundColor: colors.surface },
                index === 0 && styles.first,
                index === (feed.items?.length ?? 0) - 1 && styles.last,
              ]}
            >
              <EventRow event={item} />
            </View>
          )}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={feed.refreshing}
          onRefresh={feed.refresh}
          ListEmptyComponent={<EmptyState icon={ScrollText} title={t('home.noActivity')} />}
          ListFooterComponent={
            feed.items?.length ? (
              <ListFooter
                loadingMore={feed.loadingMore}
                error={feed.moreError ? t('states.pageFailed') : null}
                done={feed.done}
                onRetry={feed.loadMore}
              />
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[10] },
  item: { paddingHorizontal: spacing[4] },
  first: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, paddingTop: spacing[2] },
  last: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg, paddingBottom: spacing[2] },
});
