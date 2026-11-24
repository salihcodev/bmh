import { router } from 'expo-router';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PromptSheet,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { formatPriceMinor, localizedName } from '@/domain/store';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { createBagFromCart } from '@/services/store/bag-writes';
import { useCartStore } from '@/services/store/cart-store';
import { screenPadding, spacing, useTheme } from '@/theme';

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { profile } = useAuth();
  const { cart, totals, setQty, remove, clear } = useCartStore();
  const { colors } = useTheme();
  const [confirmClear, setConfirmClear] = useState(false);
  const [bagPrompt, setBagPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  const lines = cart.lines;

  const createBag = async (name: string, note?: string) => {
    if (!profile) return;
    if (!name.trim()) {
      emitActionFeedback({ message: t('cart.bagNameRequired'), kind: 'error' });
      return;
    }
    setBusy(true);
    try {
      const actor = { uid: profile.id, name: profile.displayName ?? '', avatarPublicId: null };
      const { bagId } = await createBagFromCart(actor, {
        name: name.trim(),
        note: note?.trim(),
        lines,
        isPublic: false,
        accessMode: 'collaborative',
      });
      clear();
      emitActionFeedback({ message: t('cart.bagCreated'), kind: 'success' });
      router.replace({ pathname: '/bags/[id]', params: { id: bagId } });
    } catch (err) {
      emitActionFeedback({ message: errorMessage(err) || t('cart.bagCreateFailed'), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<ScreenHeader title={t('cart.title')} back />} contentStyle={styles.content}>
      {lines.length === 0 ? (
        <EmptyState icon={ShoppingCart} title={t('cart.empty')} hint={t('cart.emptyHint')} />
      ) : (
        <>
          {/* Lines grouped by supplier */}
          {totals.bySupplier.map((group) => (
            <View key={group.supplierId}>
              <SectionHeader title={group.supplierName} />
              <Card style={styles.group}>
                {lines
                  .filter((l) => l.supplierId === group.supplierId)
                  .map((line) => (
                    <View key={line.storeItemId} style={styles.lineRow}>
                      <View style={styles.flex}>
                        <AppText variant="body" weight="semibold" numberOfLines={2}>
                          {localizedName(line.name, locale)}
                        </AppText>
                        <AppText variant="caption" tone="secondary">
                          {formatPriceMinor(line.unitPriceMinor, 'EGP', locale)}
                        </AppText>
                      </View>
                      <View style={styles.qtyRow}>
                        <Button
                          compact
                          fullWidth={false}
                          variant="secondary"
                          icon={<Minus />}
                          title=""
                          onPress={() => setQty(line.storeItemId, line.quantity - 1)}
                        />
                        <AppText variant="body" weight="semibold" style={styles.qtyText}>
                          {line.quantity}
                        </AppText>
                        <Button
                          compact
                          fullWidth={false}
                          variant="secondary"
                          icon={<Plus />}
                          title=""
                          onPress={() => setQty(line.storeItemId, line.quantity + 1)}
                        />
                        <Button
                          compact
                          fullWidth={false}
                          variant="ghost"
                          icon={<Trash2 />}
                          title=""
                          onPress={() => remove(line.storeItemId)}
                        />
                      </View>
                    </View>
                  ))}
                <View style={[styles.subtotalRow, { borderTopColor: colors.divider }]}>
                  <AppText variant="bodySm" tone="secondary">{t('cart.subtotal')}</AppText>
                  <AppText variant="body" weight="semibold">
                    {formatPriceMinor(group.totalMinor, 'EGP', locale)}
                  </AppText>
                </View>
              </Card>
            </View>
          ))}

          {/* Total */}
          <Card style={styles.totalCard}>
            <View style={styles.totalRow}>
              <AppText variant="h3">{t('cart.total')}</AppText>
              <AppText variant="h3" weight="semibold">
                {formatPriceMinor(totals.grandTotalMinor, 'EGP', locale)}
              </AppText>
            </View>
            <AppText variant="caption" tone="secondary">
              {t('cart.itemCount', { count: totals.itemCount })} ·{' '}
              {t('cart.lineCount', { count: totals.lineCount })}
            </AppText>
          </Card>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={t('cart.createBag')}
              onPress={() => setBagPrompt(true)}
              loading={busy}
            />
            <Button
              title={t('cart.clear')}
              variant="ghost"
              icon={<Trash2 />}
              onPress={() => setConfirmClear(true)}
            />
          </View>
        </>
      )}

      <ConfirmDialog
        visible={confirmClear}
        title={t('cart.clearTitle')}
        message={t('cart.clearBody')}
        confirmLabel={t('cart.clear')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clear();
          emitActionFeedback({ message: t('cart.clearDone'), kind: 'success' });
          setConfirmClear(false);
        }}
      />

      <PromptSheet
        visible={bagPrompt}
        title={t('cart.createBag')}
        fields={[
          { key: 'name', label: t('cart.bagName'), required: true, max: 120 },
          { key: 'note', label: t('cart.bagNote'), required: false, multiline: true, max: 500 },
        ]}
        submitLabel={t('cart.createBag')}
        onClose={() => setBagPrompt(false)}
        onSubmit={async (values) => {
          await createBag(values.name ?? '', values.note);
          setBagPrompt(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  group: { gap: spacing[3] },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  qtyText: { minWidth: 24, textAlign: 'center' },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
    borderTopWidth: 1,
  },
  totalCard: { gap: spacing[2] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { gap: spacing[3], paddingHorizontal: screenPadding },
});
