import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ShoppingBag } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  EmptyState,
  ErrorState,
  ListFooter,
  Screen,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useTranslation } from '@/localization';
import { formatPriceMinor } from '@/domain/store';
import { useTopBags } from '@/services/store/use-store';
import { motion, radii, screenPadding, spacing, useTheme } from '@/theme';

export default function AllBagsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const bags = useTopBags(100);
  const { colors } = useTheme();
  const showSkeleton = useDelayedLoading(bags.status === 'loading');

  return (
    <Screen scroll={false} header={<AdminHeader title={t('dashboard.links.allBags')} />}>
      {bags.status === 'loading' && showSkeleton ? (
        <View style={styles.pad}>
          <SkeletonList />
        </View>
      ) : bags.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={bags.refresh} />
      ) : (
        <FlashList
          data={bags.items ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surface },
                pressed && { transform: [{ scale: motion.pressScale }] },
              ]}
              onPress={() => router.push({ pathname: '/bags/[id]', params: { id: item.id } })}
            >
              <View style={styles.flex}>
                <AppText variant="body" weight="semibold" numberOfLines={1}>{item.name}</AppText>
                <AppText variant="caption" tone="secondary">
                  {formatPriceMinor(item.totalMinor, item.currency, locale)} · {item.itemsCount} items
                </AppText>
              </View>
              <View style={styles.badges}>
                <Badge label={item.isPublic ? t('bags.public') : t('bags.private')} tone={item.isPublic ? 'success' : 'neutral'} />
                {item.donationsCount > 0 ? (
                  <Badge label={`♥ ${item.donationsCount}`} tone="lime" />
                ) : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon={ShoppingBag} title={t('bags.empty')} hint={t('bags.emptyHint')} />}
          ListFooterComponent={
            (bags.items?.length ?? 0) > 0 ? (
              <ListFooter
                loadingMore={bags.loadingMore}
                error={bags.moreError ? t('states.pageFailed') : null}
                done={bags.done}
                onRetry={bags.loadMore}
              />
            ) : null
          }
          onEndReached={bags.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={bags.refreshing}
          onRefresh={bags.refresh}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: 80 },
  row: {
    padding: spacing[4],
    borderRadius: radii.xl,
    marginBottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', gap: spacing[2] },
});
