import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, HandHeart, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  EmptyState,
  ErrorState,
  Fab,
  IconButton,
  ListFooter,
  Screen,
  SkeletonList,
  Switch,
  useDelayedLoading,
} from '@/components/ui';
import { pick, type Language } from '@/domain/marketing';
import { nextSupportOrder, swapOrders, type SupportMethod } from '@/domain/support-method';
import { AdminHeader } from '@/features/admin/admin-header';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { reorderSupportMethods, setSupportMethodActive } from '@/services/admin/content-writes';
import { useAdminSupportMethods } from '@/services/admin/use-admin';
import { motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

export default function ManageSupportMethods() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'en' ? 'en' : 'ar';
  const methods = useAdminSupportMethods();
  const { can } = useCurrentUser();
  const { run } = useAdminAction();
  const showSkeleton = useDelayedLoading(methods.status === 'loading');
  const [busy, setBusy] = useState<string | null>(null);
  const items = methods.items ?? [];

  const toggle = async (method: SupportMethod, active: boolean) => {
    setBusy(method.id);
    await run((a) => setSupportMethodActive(a, method.id, active), active ? t('manage.support.shown') : t('manage.support.hidden'));
    setBusy(null);
  };

  const move = async (method: SupportMethod, direction: 'up' | 'down') => {
    setBusy(method.id);
    await run((a) => reorderSupportMethods(a, swapOrders(items, method.id, direction)));
    setBusy(null);
  };

  return (
    <Screen scroll={false} header={<AdminHeader title={t('manage.support.title')} />}>
      {methods.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : methods.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={methods.refresh} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          onEndReached={methods.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={methods.refreshing}
          onRefresh={methods.refresh}
          renderItem={({ item, index }) => (
            <MethodRow
              method={item}
              language={language}
              busy={busy === item.id}
              canPublish={can('support-methods.publish')}
              canReorder={can('support-methods.edit')}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onToggle={(v) => toggle(item, v)}
              onMove={(direction) => move(item, direction)}
            />
          )}
          ListEmptyComponent={<EmptyState icon={HandHeart} title={t('manage.support.empty')} hint={t('manage.support.emptyHint')} />}
          ListFooterComponent={
            items.length ? (
              <ListFooter loadingMore={methods.loadingMore} error={methods.moreError ? t('states.pageFailed') : null} done={methods.done} onRetry={methods.loadMore} />
            ) : null
          }
        />
      )}
      {can('support-methods.create') ? (
        <Fab
          label={t('manage.support.add')}
          icon={<Plus />}
          extended
          onPress={() => router.push({ pathname: '/manage/support-methods/[id]', params: { id: 'new', order: String(nextSupportOrder(items)) } })}
        />
      ) : null}
    </Screen>
  );
}

function MethodRow({
  method,
  language,
  busy,
  canPublish,
  canReorder,
  isFirst,
  isLast,
  onToggle,
  onMove,
}: {
  method: SupportMethod;
  language: Language;
  busy: boolean;
  canPublish: boolean;
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (value: boolean) => void;
  onMove: (direction: 'up' | 'down') => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pick(method.title, language)}
      onPress={() => router.push({ pathname: '/manage/support-methods/[id]', params: { id: method.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface }, pressed && { transform: [{ scale: motion.pressScale }] }]}
    >
      <View style={styles.body}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {pick(method.title, language)}
        </AppText>
        {method.copyValue ? (
          <AppText variant="bodySm" tone="secondary" ltr numberOfLines={1}>
            {method.copyValue}
          </AppText>
        ) : null}
        <View style={styles.tags}>
          <Badge label={method.isActive ? t('manage.support.shown') : t('manage.support.hidden')} tone={method.isActive ? 'success' : 'neutral'} />
          <Badge label={t('manage.banners.order', { order: method.order })} tone="neutral" />
        </View>
      </View>
      <View style={styles.actions}>
        {canReorder ? (
          <View style={styles.arrows}>
            <IconButton icon={ArrowUp} variant="ghost" label={t('manage.support.moveUp')} disabled={busy || isFirst} onPress={() => onMove('up')} />
            <IconButton icon={ArrowDown} variant="ghost" label={t('manage.support.moveDown')} disabled={busy || isLast} onPress={() => onMove('down')} />
          </View>
        ) : null}
        {canPublish ? <Switch label={t('manage.support.isActive')} value={method.isActive} disabled={busy} onValueChange={onToggle} /> : null}
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: sizes.fab + spacing[10] },
  separator: { height: spacing[3] },
  row: { padding: spacing[4], borderRadius: radii.xl, gap: spacing[2], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { flex: 1, gap: spacing[1] },
  tags: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  actions: { alignItems: 'flex-end', gap: spacing[2] },
  arrows: { flexDirection: 'row' },
});
