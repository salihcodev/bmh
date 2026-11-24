import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { MessageSquareText, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  Fab,
  ListFooter,
  NoPermissionState,
  Screen,
  SkeletonList,
  Switch,
  useDelayedLoading,
} from '@/components/ui';
import { pick, type Language } from '@/domain/marketing';
import { MESSAGE_CATEGORIES, type MessageCategory, type SystemMessage } from '@/domain/system-message';
import { AdminHeader } from '@/features/admin/admin-header';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { setSystemMessagePublished } from '@/services/admin/content-writes';
import { MESSAGE_FAMILY, useAdminMessages } from '@/services/admin/use-admin';
import { motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

export default function ManageMessages() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'en' ? 'en' : 'ar';
  const { can } = useCurrentUser();
  const viewable = MESSAGE_CATEGORIES.filter((c) => can(`${MESSAGE_FAMILY[c]}.view`));
  const [chosen, setChosen] = useState<MessageCategory | null>(null);
  const category = chosen && viewable.includes(chosen) ? chosen : (viewable[0] ?? 'message');
  const messages = useAdminMessages(category);
  const { run } = useAdminAction();
  const showSkeleton = useDelayedLoading(messages.status === 'loading');
  const [busy, setBusy] = useState<string | null>(null);
  const canPublish = can(`${MESSAGE_FAMILY[category]}.publish`);
  const canCreate = MESSAGE_CATEGORIES.some((c) => can(`${MESSAGE_FAMILY[c]}.create`));

  if (viewable.length === 0) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.messages.title')} />}>
        <NoPermissionState />
      </Screen>
    );
  }

  const toggle = async (message: SystemMessage, published: boolean) => {
    setBusy(message.key);
    await run((a) => setSystemMessagePublished(a, message, published), published ? t('manage.messages.published') : t('manage.messages.draft'));
    setBusy(null);
  };

  const header = (
    <View style={styles.filters}>
      {viewable.map((c) => (
        <Chip key={c} label={t(`manage.messages.categories.${c}`)} selected={category === c} onPress={() => setChosen(c)} />
      ))}
    </View>
  );

  return (
    <Screen scroll={false} header={<AdminHeader title={t('manage.messages.title')} />}>
      {messages.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            {header}
            <SkeletonList />
          </View>
        ) : null
      ) : messages.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={messages.refresh} />
      ) : (
        <FlashList
          data={messages.items ?? []}
          keyExtractor={(m) => m.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ItemSeparatorComponent={Separator}
          onEndReached={messages.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={messages.refreshing}
          onRefresh={messages.refresh}
          renderItem={({ item }) => (
            <MessageRow message={item} language={language} busy={busy === item.key} canPublish={canPublish} onToggle={(v) => toggle(item, v)} />
          )}
          ListEmptyComponent={<EmptyState icon={MessageSquareText} title={t('manage.messages.empty')} hint={t('manage.messages.emptyHint')} />}
          ListFooterComponent={
            messages.items?.length ? (
              <ListFooter loadingMore={messages.loadingMore} error={messages.moreError ? t('states.pageFailed') : null} done={messages.done} onRetry={messages.loadMore} />
            ) : null
          }
        />
      )}
      {canCreate ? (
        <Fab
          label={t('manage.messages.add')}
          icon={<Plus />}
          extended
          onPress={() => router.push({ pathname: '/manage/messages/[key]', params: { key: 'new', category } })}
        />
      ) : null}
    </Screen>
  );
}

function MessageRow({
  message,
  language,
  busy,
  canPublish,
  onToggle,
}: {
  message: SystemMessage;
  language: Language;
  busy: boolean;
  canPublish: boolean;
  onToggle: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={message.key}
      onPress={() => router.push({ pathname: '/manage/messages/[key]', params: { key: message.key } })}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface }, pressed && { transform: [{ scale: motion.pressScale }] }]}
    >
      <AppText variant="label" ltr numberOfLines={1}>
        {message.key}
      </AppText>
      <AppText variant="bodySm" tone="secondary" numberOfLines={2}>
        {pick(message.text, language)}
      </AppText>
      <View style={styles.meta}>
        <View style={styles.tags}>
          <Badge label={message.isPublished ? t('manage.messages.published') : t('manage.messages.draft')} tone={message.isPublished ? 'success' : 'neutral'} />
          <Badge label={t(`manage.messages.types.${message.type}`)} tone="neutral" />
          <Badge label={message.placement} tone="neutral" ltr />
        </View>
        {canPublish ? <Switch label={t('manage.messages.isPublished')} value={message.isPublished} disabled={busy} onValueChange={onToggle} /> : null}
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingBottom: spacing[3] },
  list: { paddingHorizontal: screenPadding, paddingBottom: sizes.fab + spacing[10] },
  separator: { height: spacing[3] },
  row: { padding: spacing[4], borderRadius: radii.xl, gap: spacing[2] },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  tags: { flexDirection: 'row', gap: spacing[2], flexShrink: 1, flexWrap: 'wrap' },
});
