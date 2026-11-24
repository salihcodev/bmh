import { router, useLocalSearchParams } from 'expo-router';
import { Image as ImageIcon, LayoutTemplate } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  confirmAsync,
  EmptyState,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  Switch,
  TextField,
} from '@/components/ui';
import {
  draftFromBanner,
  validateBannerDraft,
  type Banner,
  type BannerDraft,
  type BannerDraftErrors,
  type Language,
} from '@/domain/marketing';
import { useCurrentUser } from '@/hooks/use-current-user';
import { AdminHeader } from '@/features/admin/admin-header';
import { MediaPickerSheet } from '@/features/admin/media-picker-sheet';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { BannerCard } from '@/features/home/banner-card';
import { LANGUAGE_NAMES, useTranslation } from '@/localization';
import { saveBanner } from '@/services/admin/admin-writes';
import { deleteBanner } from '@/services/admin/content-writes';
import { useAdminBanner } from '@/services/admin/use-admin';
import { screenPadding, sizes, spacing } from '@/theme';

export default function BannerFormScreen() {
  const { id, order } = useLocalSearchParams<{ id: string; order?: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const existing = useAdminBanner(isNew ? null : id);

  if (!isNew && existing.banner === null && !existing.error) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.banners.editTitle')} />}>
        <LoadingState />
      </Screen>
    );
  }
  if (!isNew && (existing.banner === false || existing.error)) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.banners.editTitle')} />}>
        <EmptyState icon={LayoutTemplate} title={t('manage.banners.notFound')} />
      </Screen>
    );
  }
  const banner = isNew ? null : (existing.banner as Banner);
  return <BannerForm key={banner?.id ?? 'new'} banner={banner} nextOrder={Number(order) || 1} />;
}

function BannerForm({ banner, nextOrder }: { banner: Banner | null; nextOrder: number }) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const { run } = useAdminAction();
  const { can } = useCurrentUser();
  const [draft, setDraft] = useState<BannerDraft>(() => draftFromBanner(banner, nextOrder));
  const [errors, setErrors] = useState<BannerDraftErrors>({});
  const [picking, setPicking] = useState<Language | null>(null);
  const [previewLang, setPreviewLang] = useState<Language>(i18n.language === 'en' ? 'en' : 'ar');
  const set = <K extends keyof BannerDraft>(key: K, value: BannerDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const err = (key: keyof BannerDraft) => {
    const e = errors[key];
    return e ? t(e === 'invalidTarget' ? 'manage.banners.invalidTarget' : 'manage.banners.required') : undefined;
  };
  const previewWidth = Math.min(width, sizes.maxContent) - screenPadding * 2;
  const preview: Banner = {
    id: banner?.id ?? 'new',
    title: { ar: draft.titleAr, en: draft.titleEn },
    subtitle: { ar: draft.subtitleAr, en: draft.subtitleEn },
    imagePublicId: { ar: draft.imageAr, en: draft.imageEn },
    cta: draft.ctaType === 'none' ? null : { type: draft.ctaType, target: draft.ctaTarget, label: { ar: draft.ctaLabelAr, en: draft.ctaLabelEn } },
    gradient: banner?.gradient ?? null,
    order: Number(draft.order) || 0,
    isActive: draft.isActive,
    isDeleted: false,
    startsAt: null,
    endsAt: null,
  };

  const save = async () => {
    const result = validateBannerDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const ok = await run((a) => saveBanner(a, banner?.id ?? null, result.value), t('manage.banners.saved'));
    if (ok) router.back();
  };

  const remove = async () => {
    if (!banner) return;
    const confirmed = await confirmAsync({
      title: t('manage.banners.deleteTitle'),
      message: t('manage.banners.deleteBody'),
      confirmLabel: t('manage.banners.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    const ok = await run((a) => deleteBanner(a, banner.id), t('manage.banners.deleted'));
    if (ok) router.back();
  };

  return (
    <Screen
      header={<AdminHeader title={banner ? t('manage.banners.editTitle') : t('manage.banners.newTitle')} />}
      footer={
        <View style={styles.footer}>
          <Button title={t('manage.banners.save')} onPress={save} />
          {banner && can('banners.delete') ? <Button title={t('manage.banners.delete')} variant="destructive" onPress={remove} /> : null}
        </View>
      }
      contentStyle={styles.content}
    >
      <View>
        <SectionHeader
          title={t('manage.banners.preview')}
          action={
            <View style={styles.row}>
              {(['ar', 'en'] as const).map((l) => (
                <Chip key={l} label={LANGUAGE_NAMES[l]} selected={previewLang === l} onPress={() => setPreviewLang(l)} />
              ))}
            </View>
          }
        />
        {/* Keyed so a changed image re-mounts the card (clears a previous load error). */}
        <BannerCard key={`${previewLang}:${preview.imagePublicId?.[previewLang] ?? ''}`} banner={preview} language={previewLang} width={previewWidth} />
      </View>

      <Card style={styles.group}>
        <TextField label={t('manage.banners.titleAr')} value={draft.titleAr} onChangeText={(v) => set('titleAr', v)} error={err('titleAr')} maxLength={80} />
        <TextField label={t('manage.banners.subtitleAr')} value={draft.subtitleAr} onChangeText={(v) => set('subtitleAr', v)} maxLength={160} multiline />
        <TextField label={t('manage.banners.titleEn')} value={draft.titleEn} onChangeText={(v) => set('titleEn', v)} error={err('titleEn')} maxLength={80} ltr />
        <TextField label={t('manage.banners.subtitleEn')} value={draft.subtitleEn} onChangeText={(v) => set('subtitleEn', v)} maxLength={160} multiline ltr />
      </Card>

      <Card style={styles.group} flush>
        {(['ar', 'en'] as const).map((l) => {
          const value = l === 'ar' ? draft.imageAr : draft.imageEn;
          return (
            <ListRow
              key={l}
              icon={ImageIcon}
              label={t(l === 'ar' ? 'manage.banners.imageAr' : 'manage.banners.imageEn')}
              hint={value ?? t('manage.banners.noImage')}
              chevron
              onPress={() => setPicking(l)}
            />
          );
        })}
      </Card>

      <Card style={styles.group}>
        <AppText variant="label">{t('manage.banners.ctaType')}</AppText>
        <View style={styles.row}>
          {(['none', 'route', 'url'] as const).map((type) => (
            <Chip
              key={type}
              label={t(`manage.banners.cta${type === 'none' ? 'None' : type === 'route' ? 'Route' : 'Url'}`)}
              selected={draft.ctaType === type}
              onPress={() => set('ctaType', type)}
            />
          ))}
        </View>
        {draft.ctaType !== 'none' ? (
          <>
            <TextField
              label={t('manage.banners.ctaTarget')}
              value={draft.ctaTarget}
              onChangeText={(v) => set('ctaTarget', v)}
              error={err('ctaTarget')}
              autoCapitalize="none"
              autoCorrect={false}
              ltr
            />
            <TextField label={t('manage.banners.ctaLabelAr')} value={draft.ctaLabelAr} onChangeText={(v) => set('ctaLabelAr', v)} error={err('ctaLabelAr')} maxLength={40} />
            <TextField label={t('manage.banners.ctaLabelEn')} value={draft.ctaLabelEn} onChangeText={(v) => set('ctaLabelEn', v)} error={err('ctaLabelEn')} maxLength={40} ltr />
          </>
        ) : null}
      </Card>

      <Card style={styles.group}>
        <TextField
          label={t('manage.banners.orderLabel')}
          value={draft.order}
          onChangeText={(v) => set('order', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          error={errors.order ? t('manage.banners.required') : undefined}
          ltr
        />
        <View style={styles.switchRow}>
          <AppText variant="body">{t('manage.banners.isActive')}</AppText>
          <Switch label={t('manage.banners.isActive')} value={draft.isActive} onValueChange={(v) => set('isActive', v)} />
        </View>
      </Card>

      <MediaPickerSheet
        visible={!!picking}
        title={t('manage.banners.pickTitle')}
        entity="banner"
        lang={picking}
        entityId={banner?.id ?? null}
        selected={picking ? (picking === 'ar' ? draft.imageAr : draft.imageEn) : null}
        onClose={() => setPicking(null)}
        onPick={(publicId) => {
          if (picking) set(picking === 'ar' ? 'imageAr' : 'imageEn', publicId);
          setPicking(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  footer: { gap: spacing[2] },
  group: { gap: spacing[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
