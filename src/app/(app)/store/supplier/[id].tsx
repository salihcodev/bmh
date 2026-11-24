import { router, useLocalSearchParams } from 'expo-router';
import { Package, Pencil, ShoppingBag, Star, Store } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  GroupedList,
  IconButton,
  InlineBanner,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  SkeletonListRow,
  TextField,
  useDelayedLoading,
} from '@/components/ui';
import { canReviewSupplier, clampRating } from '@/domain/review';
import { formatPriceMinor, localizedName } from '@/domain/store';
import { supplierRating } from '@/domain/supplier-profile';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useStoreItems, useSupplierProfile, useSupplierReviews } from '@/services/store/use-store';
import { saveReview } from '@/services/store/writes';
import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';

export default function SupplierProfileScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { profile: supplier, status } = useSupplierProfile(id ?? null);
  const reviews = useSupplierReviews(id ?? null);
  const items = useStoreItems({ supplierId: id });
  const { colors } = useTheme();
  const showSkeleton = useDelayedLoading(status === 'loading');
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBusy, setReviewBusy] = useState(false);

  const isOwn = profile?.id === id;
  const canReview = canReviewSupplier(profile?.id ?? null, id ?? '');

  if (status === 'loading') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.title')} back />}>
        {showSkeleton ? <LoadingState /> : null}
      </Screen>
    );
  }

  if (!supplier || status === 'missing') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.title')} back />}>
        <EmptyState icon={Store} title={t('store.supplier.notFound')} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.title')} back />}>
        <InlineBanner tone="danger" message={t('store.supplier.loadFailed')} />
      </Screen>
    );
  }

  const rating = supplierRating(supplier);
  const bio = locale.startsWith('ar') ? supplier.bio.ar : supplier.bio.en;
  const actor = profile
    ? { uid: profile.id, name: profile.displayName ?? '', avatarPublicId: null }
    : null;

  const submitReview = async () => {
    if (!actor) return;
    setReviewBusy(true);
    try {
      const existing = reviews.items?.find((r) => r.id === profile?.id);
      await saveReview(
        actor,
        supplier.id,
        { rating: reviewRating, text: reviewText, reviewerName: actor.name },
        existing?.rating ?? null,
      );
      setReviewText('');
      emitActionFeedback({ message: t('store.supplier.reviewSaved'), kind: 'success' });
    } catch (err) {
      emitActionFeedback({ message: errorMessage(err), kind: 'error' });
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title={supplier.name}
          back
          actions={
            isOwn ? (
              <IconButton
                icon={Pencil}
                label={t('store.supplier.manageTitle')}
                variant="outline"
                onPress={() =>
                  router.push({ pathname: '/store/supplier/edit', params: { id: supplier.id } })
                }
              />
            ) : undefined
          }
        />
      }
      contentStyle={styles.content}
    >
      <View style={styles.hero}>
        <View style={[styles.cover, { backgroundColor: colors.surfaceMuted }]} />
        <View style={styles.avatarWrap}>
          <Avatar
            name={supplier.name}
            publicId={supplier.logoPublicId}
            size={sizes.avatarLg}
            active={supplier.isVerified}
          />
        </View>
        <AppText variant="h2" center>
          {supplier.name}
        </AppText>
        <View style={styles.chips}>
          {supplier.isVerified ? <Badge label={t('store.supplier.verified')} tone="success" /> : null}
          {supplier.serviceArea ? (
            <Badge label={supplier.serviceArea} tone="neutral" />
          ) : null}
        </View>
        {bio ? (
          <AppText variant="body" tone="secondary" center>
            {bio}
          </AppText>
        ) : null}

        <View style={[styles.stats, { backgroundColor: colors.surface }]}>
          <StatCell
            icon={Package}
            label={t('store.supplier.statItems')}
            value={String(supplier.itemsCount)}
          />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCell
            icon={Star}
            label={t('store.supplier.statRating')}
            value={rating != null ? String(rating) : '—'}
          />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCell
            icon={ShoppingBag}
            label={t('store.supplier.statBags')}
            value={String(supplier.bagsDonatedCount)}
          />
        </View>
      </View>

      <View>
        <SectionHeader
          title={t('store.supplier.items')}
          actionLabel={isOwn ? t('store.supplier.addItem') : undefined}
          onAction={
            isOwn
              ? () =>
                  router.push({
                    pathname: '/store/item/[id]',
                    params: { id: 'new', supplierId: supplier.id },
                  })
              : undefined
          }
        />
        {items.status === 'loading' ? (
          <View style={styles.block}>
            <SkeletonListRow />
            <SkeletonListRow />
          </View>
        ) : items.status === 'error' ? (
          <ErrorState message={t('store.loadFailed')} onRetry={items.refresh} />
        ) : (items.items ?? []).length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('store.supplier.noItems')}
            hint={t('store.supplier.noItemsHint')}
            actionLabel={isOwn ? t('store.supplier.addItem') : undefined}
            onAction={
              isOwn
                ? () =>
                    router.push({
                      pathname: '/store/item/[id]',
                      params: { id: 'new', supplierId: supplier.id },
                    })
                : undefined
            }
          />
        ) : (
          <GroupedList>
            {(items.items ?? []).map((item) => (
              <ListRow
                key={item.id}
                icon={Package}
                label={localizedName(item.name, locale)}
                hint={formatPriceMinor(item.priceMinor, item.currency, locale)}
                onPress={() =>
                  router.push({ pathname: '/store/item/[id]', params: { id: item.id } })
                }
              />
            ))}
          </GroupedList>
        )}
      </View>

      <View>
        <SectionHeader title={t('store.supplier.reviews')} />
        {reviews.status === 'loading' ? (
          <SkeletonListRow />
        ) : (reviews.items ?? []).length === 0 ? (
          <EmptyState
            icon={Star}
            title={t('store.supplier.noReviews')}
            hint={t('store.supplier.noReviewsHint')}
          />
        ) : (
          <GroupedList>
            {(reviews.items ?? []).map((r) => (
              <ListRow
                key={r.id}
                icon={Star}
                label={r.reviewerName}
                hint={r.text || undefined}
                value={'★'.repeat(r.rating)}
                chevron={false}
              />
            ))}
          </GroupedList>
        )}

        {canReview && actor ? (
          <Card style={styles.composer}>
            <AppText variant="body" weight="semibold">
              {t('store.supplier.leaveReview')}
            </AppText>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Button
                  key={s}
                  compact
                  fullWidth={false}
                  variant={s <= reviewRating ? 'lime' : 'secondary'}
                  title="★"
                  onPress={() => setReviewRating(clampRating(s))}
                />
              ))}
            </View>
            <TextField
              label={t('store.supplier.reviewText')}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder={t('store.supplier.reviewTextHint')}
              multiline
              maxLength={500}
            />
            <Button
              title={t('store.supplier.reviewSubmit')}
              loading={reviewBusy}
              onPress={submitReview}
            />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCell}>
      <Icon size={sizes.iconSm} color={colors.textSecondary} strokeWidth={iconStroke} />
      <AppText variant="h3" ltr>
        {value}
      </AppText>
      <AppText variant="caption" tone="secondary" center numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5], paddingBottom: spacing[10] },
  hero: { alignItems: 'center', gap: spacing[3] },
  cover: {
    alignSelf: 'stretch',
    height: 120,
    borderRadius: radii.xl,
  },
  avatarWrap: { marginTop: -sizes.avatarLg / 2 },
  chips: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    borderRadius: radii.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
  },
  statCell: { flex: 1, alignItems: 'center', gap: spacing[1] },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spacing[1] },
  block: { gap: spacing[3] },
  composer: { gap: spacing[3], marginTop: spacing[3] },
  stars: { flexDirection: 'row', gap: spacing[2] },
});
