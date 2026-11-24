import { router, useLocalSearchParams } from 'expo-router';
import { Package, Pencil, ShoppingBag, Star, Store, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  GroupedList,
  IconButton,
  InlineBanner,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  TextField,
  useDelayedLoading,
} from '@/components/ui';
import { formatPriceMinor, localizedName } from '@/domain/store';
import {
  emptySupplierProfile,
  supplierRating,
  type SupplierProfile,
} from '@/domain/supplier-profile';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useStoreItems, useSupplierProfile } from '@/services/store/use-store';
import { deleteStoreItem, saveSupplierProfile } from '@/services/store/writes';
import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';

export default function SupplierEditScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const sid = (typeof id === 'string' && id ? id : null) ?? profile?.id ?? null;
  const { profile: supplier, status } = useSupplierProfile(sid);
  const showSkeleton = useDelayedLoading(status === 'loading');
  const isOwner = profile?.userType === 'supplier' && profile.id === sid;

  const bootstrapped = useMemo((): SupplierProfile | null => {
    if (!sid || !isOwner || status !== 'missing') return null;
    const fallbackName = (profile?.displayName || profile?.email || 'Supplier').trim();
    return {
      id: sid,
      ...emptySupplierProfile(fallbackName),
    };
  }, [sid, isOwner, status, profile?.displayName, profile?.email]);

  if (status === 'loading') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.supplier.manageTitle')} back />}>
        {showSkeleton ? <LoadingState /> : null}
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.supplier.manageTitle')} back />}>
        <InlineBanner tone="danger" message={t('store.supplier.loadFailed')} />
      </Screen>
    );
  }

  const resolved = supplier ?? bootstrapped;
  if (!resolved) {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('store.supplier.manageTitle')} back />}>
        <EmptyState icon={Store} title={t('store.supplier.notFound')} />
      </Screen>
    );
  }

  const actor = profile
    ? { uid: profile.id, name: profile.displayName ?? '', avatarPublicId: profile.avatarPublicId ?? null }
    : null;

  return (
    <ProfileEditor
      key={`${resolved.id}:${status}`}
      supplier={resolved}
      actor={actor}
      create={status === 'missing'}
    />
  );
}

function ProfileEditor({
  supplier,
  actor,
  create,
}: {
  supplier: SupplierProfile;
  actor: { uid: string; name: string; avatarPublicId: string | null } | null;
  create: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { colors } = useTheme();
  const items = useStoreItems({ supplierId: supplier.id, enabled: !create });
  const [name, setName] = useState(supplier.name);
  const [bioAr, setBioAr] = useState(supplier.bio.ar);
  const [bioEn, setBioEn] = useState(supplier.bio.en);
  const [serviceArea, setServiceArea] = useState(supplier.serviceArea);
  const [phone, setPhone] = useState(supplier.contacts.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(supplier.contacts.whatsapp ?? '');
  const [email, setEmail] = useState(supplier.contacts.email ?? '');
  const [saveBusy, setSaveBusy] = useState(false);

  const rating = supplierRating(supplier);

  const save = async () => {
    if (!actor) return;
    setSaveBusy(true);
    try {
      await saveSupplierProfile(
        actor,
        supplier.id,
        {
          name,
          bio: { ar: bioAr, en: bioEn },
          categoryIds: supplier.categoryIds,
          serviceArea,
          contacts: { phone: phone || null, whatsapp: whatsapp || null, email: email || null },
        },
        { create },
      );
      emitActionFeedback({ message: t('store.supplier.profileSaved'), kind: 'success' });
      if (create) {
        // Remount with live snapshot after create.
        router.replace({ pathname: '/store/supplier/edit', params: { id: supplier.id } });
      } else {
        router.back();
      }
    } catch (err) {
      emitActionFeedback({
        message: errorMessage(err) || t('store.supplier.profileSaveFailed'),
        kind: 'error',
      });
    } finally {
      setSaveBusy(false);
    }
  };

  const addItem = () =>
    router.push({ pathname: '/store/item/[id]', params: { id: 'new', supplierId: supplier.id } });

  return (
    <Screen
      header={<ScreenHeader title={t('store.supplier.manageTitle')} back />}
      contentStyle={styles.content}
    >
      {create ? (
        <InlineBanner tone="info" message={t('store.supplier.setupProfileHint')} />
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

      <Card style={styles.form}>
        <AppText variant="h3">{t('store.supplier.editProfile')}</AppText>
        {create ? (
          <AppText variant="bodySm" tone="secondary">
            {t('store.supplier.setupProfile')}
          </AppText>
        ) : null}
        <TextField label={t('store.supplier.profileName')} value={name} onChangeText={setName} maxLength={120} />
        <TextField
          label={t('store.supplier.profileBioAr')}
          value={bioAr}
          onChangeText={setBioAr}
          multiline
          maxLength={2000}
        />
        <TextField
          label={t('store.supplier.profileBioEn')}
          value={bioEn}
          onChangeText={setBioEn}
          multiline
          maxLength={2000}
        />
        <TextField
          label={t('store.supplier.profileServiceArea')}
          value={serviceArea}
          onChangeText={setServiceArea}
          maxLength={200}
        />
        <TextField label={t('store.supplier.profilePhone')} value={phone} onChangeText={setPhone} maxLength={40} />
        <TextField
          label={t('store.supplier.profileWhatsapp')}
          value={whatsapp}
          onChangeText={setWhatsapp}
          maxLength={40}
        />
        <TextField label={t('store.supplier.profileEmail')} value={email} onChangeText={setEmail} maxLength={120} />
        <Button title={t('common.save')} loading={saveBusy} onPress={save} />
      </Card>

      {!create ? (
        <View>
          <SectionHeader
            title={t('store.supplier.myItems')}
            actionLabel={t('store.supplier.addItem')}
            onAction={addItem}
          />
          {items.status === 'loading' ? (
            <LoadingState />
          ) : (items.items ?? []).length === 0 ? (
            <EmptyState
              icon={Package}
              title={t('store.supplier.noItems')}
              hint={t('store.supplier.noItemsHint')}
              actionLabel={t('store.supplier.addItem')}
              onAction={addItem}
            />
          ) : (
            <GroupedList>
              {(items.items ?? []).map((item) => (
                <ListRow
                  key={item.id}
                  icon={Package}
                  label={localizedName(item.name, locale)}
                  hint={formatPriceMinor(item.priceMinor, item.currency, locale)}
                  right={
                    <View style={styles.rowActions}>
                      <IconButton
                        icon={Pencil}
                        label={t('store.supplier.editItem')}
                        variant="ghost"
                        size={sizes.iconButton - 8}
                        onPress={() =>
                          router.push({ pathname: '/store/item/[id]', params: { id: item.id } })
                        }
                      />
                      <IconButton
                        icon={Trash2}
                        label={t('store.supplier.deleteItem')}
                        variant="ghost"
                        size={sizes.iconButton - 8}
                        onPress={async () => {
                          if (!actor) return;
                          try {
                            await deleteStoreItem(
                              actor,
                              item.id,
                              item.supplierId,
                              localizedName(item.name, locale),
                            );
                            emitActionFeedback({
                              message: t('store.supplier.itemDeleted'),
                              kind: 'success',
                            });
                          } catch (err) {
                            emitActionFeedback({ message: errorMessage(err), kind: 'error' });
                          }
                        }}
                      />
                    </View>
                  }
                  chevron={false}
                />
              ))}
            </GroupedList>
          )}
        </View>
      ) : null}
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
  stats: {
    flexDirection: 'row',
    borderRadius: radii.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
  },
  statCell: { flex: 1, alignItems: 'center', gap: spacing[1] },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spacing[1] },
  form: { gap: spacing[3] },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
});
