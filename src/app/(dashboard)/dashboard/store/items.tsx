import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Package } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  EmptyState,
  ErrorState,
  ListFooter,
  Screen,
  SearchBar,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useTranslation } from '@/localization';
import { useStoreItems } from '@/services/store/use-store';
import { formatPriceMinor, localizedName } from '@/domain/store';
import { motion, radii, screenPadding, spacing, useTheme } from '@/theme';

export default function StoreItemsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [search, setSearch] = useState('');
  const items = useStoreItems({ search, staff: true });
  const { colors } = useTheme();
  const showSkeleton = useDelayedLoading(items.status === 'loading');

  return (
    <Screen scroll={false} header={<AdminHeader title={t('dashboard.links.storeItems')} />}>
      {items.status === 'loading' && showSkeleton ? (
        <View style={styles.pad}>
          <SkeletonList />
        </View>
      ) : items.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={items.refresh} />
      ) : (
        <FlashList
          data={items.items ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.searchWrap}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('store.search')}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surface },
                pressed && { transform: [{ scale: motion.pressScale }] },
              ]}
              onPress={() => router.push({ pathname: '/store/item/[id]', params: { id: item.id } })}
            >
              <View style={styles.flex}>
                <AppText variant="body" weight="semibold" numberOfLines={1}>
                  {localizedName(item.name, locale)}
                </AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>
                  {item.supplierName} · {formatPriceMinor(item.priceMinor, item.currency, locale)}
                </AppText>
              </View>
              <Badge
                label={item.status}
                tone={item.status === 'active' ? 'success' : item.status === 'hidden' ? 'warning' : 'neutral'}
              />
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState icon={Package} title={t('store.emptyItems')} hint={t('store.emptyItemsHint')} />
          }
          ListFooterComponent={
            (items.items?.length ?? 0) > 0 ? (
              <ListFooter
                loadingMore={items.loadingMore}
                error={items.moreError ? t('states.pageFailed') : null}
                done={items.done}
                onRetry={items.loadMore}
              />
            ) : null
          }
          onEndReached={items.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={items.refreshing}
          onRefresh={items.refresh}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: 80 },
  searchWrap: { marginBottom: spacing[3] },
  row: { padding: spacing[3], borderRadius: radii.xl, marginBottom: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
