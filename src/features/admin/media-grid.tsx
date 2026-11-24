import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Image as ImageIcon } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Badge, EmptyState, ErrorState, ListFooter, SkeletonList, useDelayedLoading } from '@/components/ui';
import { useTranslation } from '@/localization';
import type { MediaAsset, useMediaAssets } from '@/services/admin/use-admin';
import { cloudinaryUrl } from '@/services/media/cloudinary';
import { motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

const COLUMNS = 3;

export function MediaGrid({
  media,
  onSelect,
  selectedPublicId,
  header,
}: {
  media: ReturnType<typeof useMediaAssets>;
  onSelect: (asset: MediaAsset) => void;
  selectedPublicId?: string | null;
  header?: ReactElement;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const cell = (Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[2] * (COLUMNS - 1)) / COLUMNS;
  const showSkeleton = useDelayedLoading(media.status === 'loading');

  if (media.status === 'loading') {
    return showSkeleton ? (
      <View style={styles.pad}>
        {header}
        <SkeletonList />
      </View>
    ) : null;
  }
  if (media.status === 'error') return <ErrorState message={t('states.pageFailed')} onRetry={media.refresh} />;

  return (
    <FlashList
      data={media.items ?? []}
      numColumns={COLUMNS}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      onEndReached={media.loadMore}
      onEndReachedThreshold={0.5}
      refreshing={media.refreshing}
      onRefresh={media.refresh}
      renderItem={({ item, index }) => (
        <View style={{ paddingBottom: spacing[2], paddingStart: index % COLUMNS === 0 ? 0 : spacing[2] / 2, paddingEnd: index % COLUMNS === COLUMNS - 1 ? 0 : spacing[2] / 2 }}>
          <MediaCell asset={item} size={cell} selected={item.publicId === selectedPublicId} onPress={() => onSelect(item)} />
        </View>
      )}
      ListEmptyComponent={<EmptyState icon={ImageIcon} title={t('manage.media.empty')} hint={t('manage.media.emptyHint')} />}
      ListFooterComponent={
        media.items?.length ? (
          <ListFooter loadingMore={media.loadingMore} error={media.moreError ? t('states.pageFailed') : null} done={media.done} onRetry={media.loadMore} />
        ) : null
      }
    />
  );
}

function MediaCell({ asset, size, selected, onPress }: { asset: MediaAsset; size: number; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const uri = cloudinaryUrl(asset.publicId, { width: Math.round(size * 3), height: Math.round(size * 3), crop: 'fill' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={asset.label || asset.publicId}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { width: size, height: size, backgroundColor: colors.surfaceMuted, borderColor: selected ? colors.textPrimary : colors.surfaceMuted },
        pressed && { transform: [{ scale: motion.pressScale }] },
      ]}
    >
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" accessible={false} /> : null}
      <View style={styles.badges}>
        <Badge label={t(`manage.media.kinds.${asset.entity}`)} tone="ink" />
        {asset.lang ? <Badge label={asset.lang.toUpperCase()} tone="lime" ltr /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: sizes.fab + spacing[10] },
  cell: { borderRadius: radii.md, overflow: 'hidden', borderWidth: 2, justifyContent: 'flex-end' },
  badges: { flexDirection: 'row', gap: spacing[1], padding: spacing[1], flexWrap: 'wrap' },
});
