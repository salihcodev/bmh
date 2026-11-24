import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineBanner,
  LoadingState,
  Screen,
  TextLink,
  useDelayedLoading,
} from '@/components/ui';
import { formatPriceMinor, localizedName } from '@/domain/store';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useCartStore } from '@/services/store/cart-store';
import { useStoreItem } from '@/services/store/use-store';
import { radii, screenPadding, spacing, useTheme } from '@/theme';

export default function ItemDetailScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, status } = useStoreItem(id ?? null);
  const { user } = useAuth();
  const { add, cart } = useCartStore();
  const { colors } = useTheme();
  const showSkeleton = useDelayedLoading(status === 'loading');
  const [qty, setQty] = useState(1);

  if (status === 'loading') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.title')} back />}>
        {showSkeleton ? <LoadingState /> : null}
      </Screen>
    );
  }

  if (!item || status === 'missing') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.title')} back />}>
        <EmptyState icon={ShoppingBag} title={t('store.item.notFound')} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.title')} back />}>
        <InlineBanner tone="danger" message={t('store.item.loadFailed')} />
      </Screen>
    );
  }

  const name = localizedName(item.name, locale);
  const description = locale.startsWith('ar') ? item.description.ar : item.description.en;
  const isAvailable = item.isAvailable && item.status === 'active';
  const existing = cart.lines.find((l) => l.storeItemId === item.id);

  const addToCart = () => {
    if (!user) { router.push('/(auth)/login'); return; }
    add({
      storeItemId: item.id,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      name: item.name,
      imagePublicId: item.imagePublicIds[0] ?? null,
      unitPriceMinor: item.priceMinor,
      quantity: qty,
    });
    emitActionFeedback({ message: t('store.item.added'), kind: 'success' });
  };

  return (
    <Screen
      header={<ScreenHeader title={name} back />}
      contentStyle={styles.content}
    >
      {/* Image placeholder */}
      <View style={[styles.hero, { backgroundColor: colors.surfaceMuted }]} />

      <Card style={styles.info}>
        <View style={styles.row}>
          <AppText variant="h2" style={styles.flex}>{name}</AppText>
          <AppText variant="h2" weight="semibold">
            {formatPriceMinor(item.priceMinor, item.currency, locale)}
          </AppText>
        </View>

        <View style={styles.row}>
          <TextLink
            label={t('store.item.viewSupplier')}
            onPress={() => router.push({ pathname: '/store/supplier/[id]', params: { id: item.supplierId } })}
          />
          {!isAvailable ? <Badge label={t('store.item.unavailable')} tone="warning" /> : null}
        </View>

        {existing ? (
          <InlineBanner
            tone="success"
            message={`${t('store.cartAction')}: ×${existing.quantity}`}
          />
        ) : null}

        {description ? (
          <View>
            <AppText variant="caption" tone="secondary">{t('store.item.description')}</AppText>
            <AppText variant="body">{description}</AppText>
          </View>
        ) : null}
      </Card>

      {isAvailable ? (
        <Card style={styles.addToCart}>
          <AppText variant="body" weight="semibold">{t('store.item.quantity')}</AppText>
          <View style={styles.qtyRow}>
            <Button
              compact
              fullWidth={false}
              variant="secondary"
              icon={<Minus />}
              title=""
              onPress={() => setQty((q) => Math.max(1, q - 1))}
            />
            <AppText variant="h3" style={styles.qtyText}>{qty}</AppText>
            <Button
              compact
              fullWidth={false}
              variant="secondary"
              icon={<Plus />}
              title=""
              onPress={() => setQty((q) => Math.min(99, q + 1))}
            />
          </View>
          <Button title={t('store.item.addToCart')} onPress={addToCart} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  hero: { height: 240, borderRadius: radii.xl, marginHorizontal: screenPadding },
  info: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  flex: { flex: 1 },
  addToCart: { gap: spacing[3] },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  qtyText: { minWidth: 40, textAlign: 'center' },
});
