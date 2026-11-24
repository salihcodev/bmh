import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Layers, Plus } from 'lucide-react-native';
import { StyleSheet, View , Pressable } from 'react-native';

import {
  AppText,
  Badge,
  EmptyState,
  ErrorState,
  Fab,
  ListFooter,
  Screen,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { useStoreCategories } from '@/services/store/use-store';
import { type StoreCategory, localizedName } from '@/domain/store';
import { screenPadding, spacing, radii, motion, useTheme } from '@/theme';

export default function StoreCategoriesScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useCurrentUser();
  const categories = useStoreCategories();
  const { colors } = useTheme();
  const showSkeleton = useDelayedLoading(categories.status === 'loading');

  return (
    <Screen scroll={false} header={<AdminHeader title={t('dashboard.links.storeCategories')} />}>
      {categories.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : categories.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={categories.refresh} />
      ) : (
        <FlashList
          data={categories.items ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CategoryRow item={item} locale={locale} colors={colors} />}
          ListEmptyComponent={
            <EmptyState icon={Layers} title={t('store.emptyItems')} hint={t('store.emptyItemsHint')} />
          }
          ListFooterComponent={
            (categories.items?.length ?? 0) > 0 ? (
              <ListFooter
                loadingMore={categories.loadingMore}
                error={categories.moreError ? t('states.pageFailed') : null}
                done={categories.done}
                onRetry={categories.loadMore}
              />
            ) : null
          }
          onEndReached={categories.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={categories.refreshing}
          onRefresh={categories.refresh}
        />
      )}
      {can('store-categories.edit') ? (
        <Fab
          label={t('common.create')}
          icon={<Plus />}
          extended
          onPress={() => router.push({ pathname: '/dashboard/store/categories', params: { action: 'new' } })}
        />
      ) : null}
    </Screen>
  );
}

function CategoryRow({ item, locale, colors }: { item: StoreCategory; locale: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface },
        pressed && { transform: [{ scale: motion.pressScale }] },
      ]}
      onPress={() => {}}
    >
      <View style={styles.flex}>
        <AppText variant="body" weight="semibold">{localizedName(item.name, locale)}</AppText>
        <AppText variant="caption" tone="secondary">
          L{item.level} · {item.itemsCount} items
        </AppText>
      </View>
      <Badge label={item.isActive ? 'Active' : 'Hidden'} tone={item.isActive ? 'success' : 'neutral'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: 80 },
  row: { padding: spacing[4], borderRadius: radii.xl, marginBottom: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
