import { router, useLocalSearchParams } from 'expo-router';
import { Image as ImageIcon, Newspaper } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  Switch,
  TextField,
} from '@/components/ui';
import type { Language, NewsItem } from '@/domain/marketing';
import {
  draftFromNews,
  NEWS_BODY_MAX,
  NEWS_CATEGORIES,
  NEWS_SUMMARY_MAX,
  NEWS_TITLE_MAX,
  validateNewsDraft,
  type NewsDraft,
  type NewsDraftErrors,
} from '@/domain/news-admin';
import { AdminHeader } from '@/features/admin/admin-header';
import { MediaPickerSheet } from '@/features/admin/media-picker-sheet';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { deleteNews, saveNews } from '@/services/admin/content-writes';
import { useAdminNewsItem } from '@/services/admin/use-admin';
import { spacing } from '@/theme';

export default function NewsFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const existing = useAdminNewsItem(isNew ? null : id);

  if (!isNew && existing.item === null && !existing.error) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.news.editTitle')} />}>
        <LoadingState />
      </Screen>
    );
  }
  if (!isNew && (existing.item === false || existing.error || existing.item?.isDeleted)) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.news.editTitle')} />}>
        <EmptyState icon={Newspaper} title={t('manage.news.notFound')} />
      </Screen>
    );
  }
  const item = isNew ? null : (existing.item as NewsItem);
  return <NewsForm key={item?.id ?? 'new'} item={item} />;
}

function NewsForm({ item }: { item: NewsItem | null }) {
  const { t } = useTranslation();
  const { run } = useAdminAction();
  const { can } = useCurrentUser();
  const [draft, setDraft] = useState<NewsDraft>(() => draftFromNews(item));
  const [errors, setErrors] = useState<NewsDraftErrors>({});
  const [picking, setPicking] = useState<Language | null>(null);
  const set = <K extends keyof NewsDraft>(key: K, value: NewsDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const err = (key: keyof NewsDraft) => (errors[key] ? t('manage.news.required') : undefined);

  const save = async () => {
    const result = validateNewsDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const ok = await run(
      (a) => saveNews(a, item?.id ?? null, result.value, { publish: !item && draft.isPublished }),
      t('manage.news.saved'),
    );
    if (ok) router.back();
  };

  const remove = async () => {
    if (!item) return;
    const confirmed = await confirmAsync({
      title: t('manage.news.deleteTitle'),
      message: t('manage.news.deleteBody'),
      confirmLabel: t('manage.news.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    const ok = await run((a) => deleteNews(a, item.id), t('manage.news.deleted'));
    if (ok) router.back();
  };

  return (
    <Screen
      header={<AdminHeader title={item ? t('manage.news.editTitle') : t('manage.news.newTitle')} />}
      footer={
        <View style={styles.footer}>
          <Button title={t('manage.news.save')} onPress={save} />
          {item && can('news.delete') ? <Button title={t('manage.news.delete')} variant="destructive" onPress={remove} /> : null}
        </View>
      }
      contentStyle={styles.content}
    >
      <Card style={styles.group}>
        <TextField label={t('manage.news.titleAr')} value={draft.titleAr} onChangeText={(v) => set('titleAr', v)} error={err('titleAr')} maxLength={NEWS_TITLE_MAX} />
        <TextField label={t('manage.news.summaryAr')} value={draft.summaryAr} onChangeText={(v) => set('summaryAr', v)} error={err('summaryAr')} maxLength={NEWS_SUMMARY_MAX} multiline />
        <TextField label={t('manage.news.bodyAr')} value={draft.bodyAr} onChangeText={(v) => set('bodyAr', v)} error={err('bodyAr')} maxLength={NEWS_BODY_MAX} multiline />
      </Card>

      <Card style={styles.group}>
        <TextField label={t('manage.news.titleEn')} value={draft.titleEn} onChangeText={(v) => set('titleEn', v)} error={err('titleEn')} maxLength={NEWS_TITLE_MAX} ltr />
        <TextField label={t('manage.news.summaryEn')} value={draft.summaryEn} onChangeText={(v) => set('summaryEn', v)} error={err('summaryEn')} maxLength={NEWS_SUMMARY_MAX} multiline ltr />
        <TextField label={t('manage.news.bodyEn')} value={draft.bodyEn} onChangeText={(v) => set('bodyEn', v)} error={err('bodyEn')} maxLength={NEWS_BODY_MAX} multiline ltr />
      </Card>

      <Card style={styles.group} flush>
        {(['ar', 'en'] as const).map((l) => {
          const value = l === 'ar' ? draft.coverAr : draft.coverEn;
          return (
            <ListRow
              key={l}
              icon={ImageIcon}
              label={t(l === 'ar' ? 'manage.news.coverAr' : 'manage.news.coverEn')}
              hint={value ?? t('manage.news.noCover')}
              chevron
              onPress={() => setPicking(l)}
            />
          );
        })}
      </Card>

      <Card style={styles.group}>
        <AppText variant="label">{t('manage.news.category')}</AppText>
        <View style={styles.row}>
          {NEWS_CATEGORIES.map((c) => (
            <Chip key={c} label={t(`manage.news.categories.${c}`)} selected={draft.category === c} onPress={() => set('category', c)} />
          ))}
        </View>
        <View style={styles.switchRow}>
          <AppText variant="body">{t('manage.news.isPinned')}</AppText>
          <Switch label={t('manage.news.isPinned')} value={draft.isPinned} onValueChange={(v) => set('isPinned', v)} />
        </View>
        {!item && can('news.publish') ? (
          <View style={styles.switchRow}>
            <AppText variant="body">{t('manage.news.publishNow')}</AppText>
            <Switch label={t('manage.news.publishNow')} value={draft.isPublished} onValueChange={(v) => set('isPublished', v)} />
          </View>
        ) : null}
        {item ? (
          <AppText variant="caption" tone="secondary">
            {t('manage.news.publishHint')}
          </AppText>
        ) : null}
      </Card>

      <MediaPickerSheet
        visible={!!picking}
        title={t('manage.news.pickTitle')}
        entity="news"
        lang={picking}
        entityId={item?.id ?? null}
        selected={picking ? (picking === 'ar' ? draft.coverAr : draft.coverEn) : null}
        onClose={() => setPicking(null)}
        onPick={(publicId) => {
          if (picking) set(picking === 'ar' ? 'coverAr' : 'coverEn', publicId);
          setPicking(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  group: { gap: spacing[3] },
  footer: { gap: spacing[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
