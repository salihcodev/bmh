import { getDoc } from '@react-native-firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, Link2, Share2, ShoppingBag, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  GroupedList,
  InlineBanner,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  Switch,
  useDelayedLoading,
} from '@/components/ui';
import { bagLink, groupItemsBySupplier } from '@/domain/bag';
import { formatPriceMinor } from '@/domain/store';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';

import {
  regenerateBagLink,
  restoreBagVersion,
  softDeleteBag,
  updateBagMeta,
} from '@/services/store/bag-writes';
import { useCartStore } from '@/services/store/cart-store';
import { useBag, useBagChanges, useBagItems } from '@/services/store/use-store';
import { refs } from '@/services/firebase/refs';
import { env } from '@/config/env';
import { spacing } from '@/theme';

export default function BagDetailScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { bag, status } = useBag(id ?? null);
  const bagItems = useBagItems(id ?? null);
  const bagChanges = useBagChanges(id ?? null);
  const { replaceFromBag } = useCartStore();
  const showSkeleton = useDelayedLoading(status === 'loading');
  const [changesSheet, setChangesSheet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);

  const isCreator = bag?.creatorId === profile?.id;
  const actor = profile ? { uid: profile.id, name: profile.displayName ?? '', avatarPublicId: null } : null;

  if (status === 'loading') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('bags.title')} back />}>
        {showSkeleton ? <LoadingState /> : null}
      </Screen>
    );
  }

  if (!bag || status === 'missing') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('bags.title')} back />}>
        <EmptyState icon={ShoppingBag} title={t('bags.notFound')} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('bags.title')} back />}>
        <InlineBanner tone="danger" message={t('bags.loadFailed')} />
      </Screen>
    );
  }

  const groups = groupItemsBySupplier(bagItems.items ?? []);
  const link = bagLink(bag.linkToken, env.linkDomain);

  const shareLink = async () => {
    try {
      await Share.share({ url: link, message: link });
      emitActionFeedback({ message: t('bags.shared'), kind: 'success' });
    } catch {
      /* cancelled */
    }
  };

  const handleRegenerate = async () => {
    if (!actor) return;
    setBusy(true);
    try {
      await regenerateBagLink(actor, bag.id, bag.linkToken);
      emitActionFeedback({ message: t('bags.regenerateDone'), kind: 'success' });
    } catch (err) {
      emitActionFeedback({ message: errorMessage(err), kind: 'error' });
    } finally {
      setBusy(false);
      setConfirmRegenerate(false);
    }
  };

  const handleDelete = async () => {
    if (!actor) return;
    setBusy(true);
    try {
      await softDeleteBag(actor, bag.id, bag.name);
      emitActionFeedback({ message: t('bags.deleted'), kind: 'success' });
      router.back();
    } catch (err) {
      emitActionFeedback({ message: errorMessage(err), kind: 'error' });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const handleRestoreOriginal = async () => {
    if (!actor) return;
    setBusy(true);
    try {
      const snap = await getDoc(refs.bagVersion(bag.id, 1));
      if (!snap.exists()) throw new Error('Original version missing');
      const data = snap.data() ?? {};
      const items = Array.isArray(data.items) ? data.items : [];
      await restoreBagVersion(
        actor,
        bag.id,
        {
          version: 1,
          items: items as never,
          totalMinor: typeof data.totalMinor === 'number' ? data.totalMinor : 0,
          itemsCount: typeof data.itemsCount === 'number' ? data.itemsCount : items.length,
          supplierTotals:
            data.supplierTotals && typeof data.supplierTotals === 'object'
              ? (data.supplierTotals as Record<string, number>)
              : {},
          note: typeof data.note === 'string' ? data.note : '',
        },
        bagItems.items ?? [],
        bag.version,
      );
      emitActionFeedback({ message: t('bags.restoreDone'), kind: 'success' });
    } catch (err) {
      emitActionFeedback({ message: errorMessage(err) || t('bags.restoreFailed'), kind: 'error' });
    } finally {
      setBusy(false);
      setConfirmRestore(false);
    }
  };

  const copyToCart = () => {
    const lines = (bagItems.items ?? []).map((i) => ({
      storeItemId: i.storeItemId,
      supplierId: i.supplierId,
      supplierName: i.supplierName,
      name: i.name,
      imagePublicId: i.imagePublicId,
      unitPriceMinor: i.unitPriceMinor,
      quantity: i.quantity,
    }));
    replaceFromBag(lines);
    emitActionFeedback({ message: t('bags.copiedToCart'), kind: 'success' });
    router.push('/cart');
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title={bag.name}
          back
          actions={
            <Button
              compact
              fullWidth={false}
              variant="secondary"
              icon={<Share2 />}
              title=""
              onPress={shareLink}
            />
          }
        />
      }
      contentStyle={styles.content}
    >
      {bag.note ? <InlineBanner tone="info" message={bag.note} /> : null}

      {/* Stats card */}
      <Card style={styles.stats}>
        <View style={styles.row}>
          <AppText variant="body" weight="semibold">{t('bags.title')}</AppText>
          <AppText variant="bodySm" tone="secondary">
            {t('bags.version', { v: bag.version })}
          </AppText>
        </View>
        <AppText variant="h3">
          {formatPriceMinor(bag.totalMinor, bag.currency, locale)}
        </AppText>
        <View style={styles.row}>
          <Badge label={bag.isPublic ? t('bags.public') : t('bags.private')} tone={bag.isPublic ? 'success' : 'neutral'} />
          <Badge
            label={bag.accessMode === 'collaborative' ? t('bags.accessModeCollab') : t('bags.accessModeView')}
            tone="neutral"
          />
        </View>
      </Card>

      {/* Creator controls — ListRow carries the visible label; Switch label is a11y-only */}
      {isCreator ? (
        <GroupedList>
          <ListRow
            icon={Eye}
            label={t('bags.public')}
            chevron={false}
            right={
              <Switch
                label={t('bags.public')}
                value={bag.isPublic}
                onValueChange={async (v) => {
                  if (!actor) return;
                  try {
                    await updateBagMeta(actor, bag.id, { isPublic: v }, bag.version);
                    emitActionFeedback({ message: t('bags.visibilitySaved'), kind: 'success' });
                  } catch (err) {
                    emitActionFeedback({ message: errorMessage(err), kind: 'error' });
                  }
                }}
              />
            }
          />
          <ListRow
            icon={Users}
            label={t('bags.accessModeCollab')}
            hint={t('bags.accessMode')}
            chevron={false}
            right={
              <Switch
                label={t('bags.accessModeCollab')}
                value={bag.accessMode === 'collaborative'}
                onValueChange={async (v) => {
                  if (!actor) return;
                  try {
                    await updateBagMeta(
                      actor,
                      bag.id,
                      { accessMode: v ? 'collaborative' : 'view-only' },
                      bag.version,
                    );
                    emitActionFeedback({ message: t('bags.accessModeSaved'), kind: 'success' });
                  } catch (err) {
                    emitActionFeedback({ message: errorMessage(err), kind: 'error' });
                  }
                }}
              />
            }
          />
        </GroupedList>
      ) : null}

      {/* Items grouped by supplier */}
      {groups.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={t('store.emptyItems')} />
      ) : (
        groups.map((group) => (
          <View key={group.supplierId}>
            <SectionHeader title={group.supplierName} />
            <Card style={styles.itemGroup}>
              {group.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.flex}>
                    <AppText variant="body" weight="semibold" numberOfLines={1}>
                      {locale.startsWith('ar') ? item.name.ar : item.name.en}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      ×{item.quantity} · {formatPriceMinor(item.unitPriceMinor, 'EGP', locale)}
                    </AppText>
                  </View>
                  <AppText variant="body" weight="semibold">
                    {formatPriceMinor(item.unitPriceMinor * item.quantity, 'EGP', locale)}
                  </AppText>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={t('bags.copyToCart')}
          variant="secondary"
          onPress={copyToCart}
        />
        <Button
          title={t('bags.viewChanges')}
          variant="secondary"
          icon={<Link2 />}
          onPress={() => setChangesSheet(true)}
        />
        {isCreator ? (
          <>
            <Button
              title={t('bags.regenerateLink')}
              variant="secondary"
              icon={<Link2 />}
              onPress={() => setConfirmRegenerate(true)}
              loading={busy}
            />
            {bag.version > 1 ? (
              <Button
                title={t('bags.restoreOriginal')}
                variant="secondary"
                onPress={() => setConfirmRestore(true)}
                loading={busy}
              />
            ) : null}
            <Button
              title={t('bags.delete')}
              variant="ghost"
              icon={<Trash2 />}
              onPress={() => setConfirmDelete(true)}
            />
          </>
        ) : null}
      </View>

      {/* Changes sheet */}
      <BottomSheet visible={changesSheet} title={t('bags.viewChanges')} onClose={() => setChangesSheet(false)}>
        {bagChanges.status === 'loading' ? <LoadingState /> : null}
        {(bagChanges.items ?? []).length === 0 ? (
          <AppText variant="bodySm" tone="secondary" center>{t('bags.noChanges')}</AppText>
        ) : (
          (bagChanges.items ?? []).map((c) => (
            <View key={c.id} style={styles.changeRow}>
              <AppText variant="body" weight="semibold">{c.actorName}</AppText>
              <AppText variant="caption" tone="secondary">
                {c.type} · v{c.version}
              </AppText>
            </View>
          ))
        )}
      </BottomSheet>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('bags.deleteTitle')}
        message={t('bags.deleteBody')}
        confirmLabel={t('bags.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        visible={confirmRegenerate}
        title={t('bags.regenerateTitle')}
        message={t('bags.regenerateBody')}
        confirmLabel={t('bags.regenerateLink')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmRegenerate(false)}
        onConfirm={handleRegenerate}
      />

      <ConfirmDialog
        visible={confirmRestore}
        title={t('bags.restoreTitle')}
        message={t('bags.restoreBody')}
        confirmLabel={t('bags.restoreOriginal')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmRestore(false)}
        onConfirm={handleRestoreOriginal}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  stats: { gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
  itemGroup: { gap: spacing[3] },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  actions: { gap: spacing[3] },
  changeRow: { gap: spacing[1], paddingVertical: spacing[2] },
});
