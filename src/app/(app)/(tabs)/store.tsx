import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Package, ShoppingBag, ShoppingCart, Store } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Avatar,
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  GroupedList,
  IconButton,
  ListRow,
  PressableCard,
  Screen,
  SearchBar,
  Section,
  SkeletonListRow,
  useDelayedLoading,
} from '@/components/ui';
import { formatPriceMinor, localizedName, type StoreItem } from '@/domain/store';
import { supplierRating, type SupplierProfile } from '@/domain/supplier-profile';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { cld } from '@/services/media/cloudinary';
import { useCartStore } from '@/services/store/cart-store';
import {
  usePopularItems,
  usePopularSuppliers,
  useStoreCategories,
  useStoreConfig,
  useStoreItems,
  useTopBags,
} from '@/services/store/use-store';
import { motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

export default function StoreScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { profile } = useAuth();
  const isTab = profile?.userType === 'supplier';
  const config = useStoreConfig();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { totals } = useCartStore();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const browsing = browseAll || query.trim().length > 0 || categoryId != null;

  const popularItems = usePopularItems(browsing ? 0 : config.popularItemsCount);
  const popularSuppliers = usePopularSuppliers(browsing ? 0 : config.popularSuppliersCount);
  const topBags = useTopBags(browsing ? 0 : config.topBagsCount);
  const categories = useStoreCategories();
  const catalog = useStoreItems({
    enabled: browsing,
    search: query,
    categoryId: categoryId && !query.trim() ? categoryId : null,
  });

  const roots = useMemo(
    () => (categories.items ?? []).filter((c) => c.level === 1 && c.isActive),
    [categories.items],
  );

  const cardWidth = Math.min(
    168,
    Math.floor((Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3]) / 2),
  );

  const loadingBrowse =
    popularItems.status === 'loading' ||
    popularSuppliers.status === 'loading' ||
    topBags.status === 'loading';
  const showSkeleton = useDelayedLoading(browsing ? catalog.status === 'loading' : loadingBrowse);

  const cartAction = (
    <View style={styles.cartWrap}>
      <IconButton
        icon={ShoppingCart}
        label={t('store.cartAction')}
        onPress={() => router.push('/cart')}
        variant="outline"
      />
      {totals.lineCount > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.cartBadge, { backgroundColor: colors.accent }]}
        >
          <AppText variant="caption" weight="bold" style={{ color: colors.onAccent }} ltr>
            {totals.lineCount > 99 ? '99+' : String(totals.lineCount)}
          </AppText>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen
      header={
        <ScreenHeader title={t('store.title')} back={!isTab} actions={cartAction} />
      }
      contentStyle={styles.content}
    >
      <SearchBar
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          if (text.trim()) setBrowseAll(true);
        }}
        placeholder={t('store.search')}
      />

      {roots.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('store.allCategories')}
            selected={categoryId === null && !browseAll}
            onPress={() => {
              setCategoryId(null);
              setBrowseAll(false);
              setQuery('');
            }}
          />
          {roots.map((c) => (
            <Chip
              key={c.id}
              label={localizedName(c.name, locale)}
              selected={categoryId === c.id}
              onPress={() => {
                setCategoryId(categoryId === c.id ? null : c.id);
                setBrowseAll(false);
              }}
              onClear={
                categoryId === c.id
                  ? () => {
                      setCategoryId(null);
                    }
                  : undefined
              }
            />
          ))}
        </ScrollView>
      ) : null}

      {browsing ? (
        <BrowseResults
          status={catalog.status}
          items={catalog.items ?? []}
          locale={locale}
          cardWidth={cardWidth}
          showSkeleton={showSkeleton}
          onRetry={catalog.refresh}
          emptyTitle={t('store.emptyItems')}
          emptyHint={t('store.emptyItemsHint')}
          failed={t('store.loadFailed')}
        />
      ) : (
        <>
          <Section
            title={t('store.popularItems')}
            actionLabel={t('store.viewAll')}
            onAction={() => setBrowseAll(true)}
          >
            {popularItems.status === 'loading' && showSkeleton ? (
              <View style={styles.block}>
                <SkeletonListRow />
              </View>
            ) : popularItems.status === 'error' ? (
              <ErrorState message={t('store.loadFailed')} onRetry={popularItems.refresh} />
            ) : (popularItems.items ?? []).length === 0 ? (
              <EmptyState
                icon={Package}
                title={t('store.emptyItems')}
                hint={t('store.emptyItemsHint')}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {(popularItems.items ?? []).map((item) => (
                  <ItemCard key={item.id} item={item} locale={locale} width={cardWidth} />
                ))}
              </ScrollView>
            )}
          </Section>

          <Section title={t('store.popularSuppliers')}>
            {popularSuppliers.status === 'loading' && showSkeleton ? (
              <View style={styles.block}>
                <SkeletonListRow />
                <SkeletonListRow />
              </View>
            ) : popularSuppliers.status === 'error' ? (
              <ErrorState message={t('store.loadFailed')} onRetry={popularSuppliers.refresh} />
            ) : (popularSuppliers.items ?? []).length === 0 ? (
              <EmptyState
                icon={Store}
                title={t('store.emptySuppliers')}
                hint={t('store.emptySuppliersHint')}
              />
            ) : (
              <GroupedList>
                {(popularSuppliers.items ?? []).map((s) => (
                  <SupplierListRow key={s.id} supplier={s} />
                ))}
              </GroupedList>
            )}
          </Section>

          <Section title={t('store.topBags')}>
            {topBags.status === 'loading' && showSkeleton ? (
              <View style={styles.block}>
                <SkeletonListRow />
              </View>
            ) : (topBags.items ?? []).length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title={t('store.emptyBags')}
                hint={t('store.emptyBagsHint')}
              />
            ) : (
              <GroupedList>
                {(topBags.items ?? []).map((b) => (
                  <ListRow
                    key={b.id}
                    icon={ShoppingBag}
                    label={b.name}
                    hint={t('store.bagHint', {
                      price: formatPriceMinor(b.totalMinor, b.currency, locale),
                      items: b.itemsCount,
                    })}
                    value={b.donationsCount > 0 ? String(b.donationsCount) : undefined}
                    onPress={() => router.push({ pathname: '/bags/[id]', params: { id: b.id } })}
                  />
                ))}
              </GroupedList>
            )}
          </Section>

          {profile?.userType === 'supplier' ? (
            <ListRow
              icon={Store}
              label={t('store.manageStore')}
              hint={t('store.manageStoreHint')}
              onPress={() =>
                router.push({
                  pathname: '/store/supplier/edit',
                  params: { id: profile.id },
                })
              }
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function BrowseResults({
  status,
  items,
  locale,
  cardWidth,
  showSkeleton,
  onRetry,
  emptyTitle,
  emptyHint,
  failed,
}: {
  status: string;
  items: StoreItem[];
  locale: string;
  cardWidth: number;
  showSkeleton: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyHint: string;
  failed: string;
}) {
  if (status === 'loading' || status === 'empty') {
    return showSkeleton ? (
      <View style={styles.block}>
        <SkeletonListRow />
        <SkeletonListRow />
        <SkeletonListRow />
      </View>
    ) : null;
  }
  if (status === 'error') {
    return <ErrorState message={failed} onRetry={onRetry} />;
  }
  if (items.length === 0) {
    return <EmptyState icon={Package} title={emptyTitle} hint={emptyHint} />;
  }
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <ItemCard key={item.id} item={item} locale={locale} width={cardWidth} />
      ))}
    </View>
  );
}

function ItemCard({
  item,
  locale,
  width,
}: {
  item: StoreItem;
  locale: string;
  width: number;
}) {
  const { colors } = useTheme();
  const uri = cld(item.imagePublicIds[0], 'card');
  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={localizedName(item.name, locale)}
      onPress={() => router.push({ pathname: '/store/item/[id]', params: { id: item.id } })}
      style={[styles.itemCard, { width }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="disk"
            transition={motion.base}
          />
        ) : (
          <Package size={sizes.icon} color={colors.textTertiary} />
        )}
      </View>
      <AppText variant="body" weight="semibold" numberOfLines={2}>
        {localizedName(item.name, locale)}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {item.supplierName}
      </AppText>
      <AppText variant="body" weight="bold" ltr>
        {formatPriceMinor(item.priceMinor, item.currency, locale)}
      </AppText>
    </PressableCard>
  );
}

function SupplierListRow({ supplier }: { supplier: SupplierProfile }) {
  const { t } = useTranslation();
  const rating = supplierRating(supplier);
  const hint =
    rating != null
      ? t('store.supplier.stats', { items: supplier.itemsCount, rating })
      : t('store.supplier.statsNoRating', { items: supplier.itemsCount });
  return (
    <ListRow
      icon={
        <Avatar name={supplier.name} publicId={supplier.logoPublicId} size={sizes.avatarSm} />
      }
      label={supplier.name}
      hint={hint}
      right={
        supplier.isVerified ? (
          <Badge label={t('store.supplier.verified')} tone="success" />
        ) : undefined
      }
      onPress={() => router.push({ pathname: '/store/supplier/[id]', params: { id: supplier.id } })}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
    paddingBottom: sizes.tabBar + spacing[8],
  },
  chips: {
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  rail: {
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  itemCard: {
    gap: spacing[2],
    padding: spacing[3],
    marginBottom: 0,
  },
  thumb: {
    height: 96,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  block: { gap: spacing[3] },
  cartWrap: { position: 'relative' },
  cartBadge: {
    position: 'absolute',
    top: -2,
    end: -2,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
  },
});
