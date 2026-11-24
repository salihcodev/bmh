import { FlashList } from '@shopify/flash-list';
import { Store } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  EmptyState,
  ErrorState,
  ListFooter,
  Screen,
  SkeletonList,
  Switch,
  useDelayedLoading,
} from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { type SupplierProfile, supplierRating } from '@/domain/supplier-profile';
import { setSupplierVerified } from '@/services/store/writes';
import { usePopularSuppliers } from '@/services/store/use-store';
import { motion, radii, screenPadding, spacing, useTheme } from '@/theme';
import { router } from 'expo-router';

export default function AllSuppliersScreen() {
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const suppliers = usePopularSuppliers(50);
  const { run } = useAdminAction();
  const { colors } = useTheme();
  const showSkeleton = useDelayedLoading(suppliers.status === 'loading');
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (s: SupplierProfile, verified: boolean) => {
    setBusy(s.id);
    await run(
      (a) => setSupplierVerified(a, s.id, verified, s.name),
      verified ? 'Verified' : 'Unverified',
    );
    setBusy(null);
  };

  return (
    <Screen scroll={false} header={<AdminHeader title={t('dashboard.links.allSuppliers')} />}>
      {suppliers.status === 'loading' && showSkeleton ? (
        <View style={styles.pad}>
          <SkeletonList />
        </View>
      ) : suppliers.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={suppliers.refresh} />
      ) : (
        <FlashList
          data={suppliers.items ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surface },
                pressed && { transform: [{ scale: motion.pressScale }] },
              ]}
              onPress={() => router.push({ pathname: '/store/supplier/[id]', params: { id: item.id } })}
            >
              <View style={styles.flex}>
                <AppText variant="body" weight="semibold">{item.name}</AppText>
                <AppText variant="caption" tone="secondary">
                  {item.itemsCount} items
                  {supplierRating(item) != null ? ` · ${supplierRating(item)} ★` : ''}
                </AppText>
              </View>
              {can('suppliers.approve') ? (
                <Switch
                  label={t('store.supplier.verified')}
                  value={item.isVerified}
                  disabled={busy === item.id}
                  onValueChange={(v) => toggle(item, v)}
                />
              ) : (
                <Badge
                  label={item.isVerified ? t('store.supplier.verified') : item.status}
                  tone={item.isVerified ? 'success' : 'neutral'}
                />
              )}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon={Store} title={t('store.emptyItems')} />}
          ListFooterComponent={
            (suppliers.items?.length ?? 0) > 0 ? (
              <ListFooter
                loadingMore={suppliers.loadingMore}
                error={suppliers.moreError ? t('states.pageFailed') : null}
                done={suppliers.done}
                onRetry={suppliers.loadMore}
              />
            ) : null
          }
          onEndReached={suppliers.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={suppliers.refreshing}
          onRefresh={suppliers.refresh}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: 80 },
  row: { padding: spacing[4], borderRadius: radii.xl, marginBottom: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
