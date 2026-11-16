import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { LayoutTemplate, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  AppText,
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  Fab,
  ListFooter,
  Screen,
  SkeletonList,
  Switch,
  useDelayedLoading,
} from '@/components/ui';
import { pick, type Banner, type Language } from '@/domain/marketing';
import { AdminHeader } from '@/features/admin/admin-header';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { BannerCard } from '@/features/home/banner-card';
import { LANGUAGE_NAMES, useTranslation } from '@/localization';
import { setBannerActive } from '@/services/admin/admin-writes';
import { useAdminBanners } from '@/services/admin/use-admin';
import { motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

export default function ManageBanners() {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState<Language>(i18n.language === 'en' ? 'en' : 'ar');
  const banners = useAdminBanners();
  const { run } = useAdminAction();
  const showSkeleton = useDelayedLoading(banners.status === 'loading');
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (banner: Banner, isActive: boolean) => {
    setBusy(banner.id);
    await run((a) => setBannerActive(a, banner.id, isActive), isActive ? t('manage.banners.active') : t('manage.banners.inactive'));
    setBusy(null);
  };

  const header = (
    <View style={styles.filters}>
      {(['ar', 'en'] as const).map((l) => (
        <Chip key={l} label={LANGUAGE_NAMES[l]} selected={language === l} onPress={() => setLanguage(l)} />
      ))}
    </View>
  );

  return (
    <Screen scroll={false} header={<AdminHeader title={t('manage.banners.title')} />}>
      {banners.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : banners.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={banners.refresh} />
      ) : (
        <FlashList
          data={banners.items ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ItemSeparatorComponent={Separator}
          onEndReached={banners.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={banners.refreshing}
          onRefresh={banners.refresh}
          renderItem={({ item }) => (
            <BannerRow banner={item} language={language} busy={busy === item.id} onToggle={(v) => toggle(item, v)} />
          )}
          ListEmptyComponent={<EmptyState icon={LayoutTemplate} title={t('manage.banners.empty')} hint={t('manage.banners.emptyHint')} />}
          ListFooterComponent={
            banners.items?.length ? (
              <ListFooter
                loadingMore={banners.loadingMore}
                error={banners.moreError ? t('states.pageFailed') : null}
                done={banners.done}
                onRetry={banners.loadMore}
              />
            ) : null
          }
        />
      )}
      <Fab
        label={t('manage.banners.add')}
        icon={<Plus />}
        extended
        onPress={() => router.push({ pathname: '/manage/banners/[id]', params: { id: 'new', order: String((banners.items?.length ?? 0) + 1) } })}
      />
    </Screen>
  );
}

function BannerRow({
  banner,
  language,
  busy,
  onToggle,
}: {
  banner: Banner;
  language: Language;
  busy: boolean;
  onToggle: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3] * 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pick(banner.title, language)}
      onPress={() => router.push({ pathname: '/manage/banners/[id]', params: { id: banner.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface }, pressed && { transform: [{ scale: motion.pressScale }] }]}
    >
      <View pointerEvents="none">
        <BannerCard banner={banner} language={language} width={previewWidth} />
      </View>
      <View style={styles.meta}>
        <View style={styles.tags}>
          <Badge label={banner.isActive ? t('manage.banners.active') : t('manage.banners.inactive')} tone={banner.isActive ? 'success' : 'neutral'} />
          <Badge label={t('manage.banners.order', { order: banner.order })} tone="neutral" />
        </View>
        <Switch label={t('manage.banners.isActive')} value={banner.isActive} disabled={busy} onValueChange={onToggle} />
      </View>
      <AppText variant="caption" tone="tertiary" ltr numberOfLines={1}>
        {banner.id}
      </AppText>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  filters: { flexDirection: 'row', gap: spacing[2], paddingBottom: spacing[3] },
  list: { paddingHorizontal: screenPadding, paddingBottom: sizes.fab + spacing[10] },
  separator: { height: spacing[3] },
  row: { padding: spacing[3], borderRadius: radii.xl, gap: spacing[3] },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tags: { flexDirection: 'row', gap: spacing[2] },
});
