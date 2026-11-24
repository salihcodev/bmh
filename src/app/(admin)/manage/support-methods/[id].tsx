import { router, useLocalSearchParams } from 'expo-router';
import { HandHeart, Image as ImageIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  confirmAsync,
  EmptyState,
  ListRow,
  LoadingState,
  Screen,
  Switch,
  TextField,
} from '@/components/ui';
import {
  draftFromSupportMethod,
  emptySupportDraft,
  SUPPORT_COPY_LABEL_MAX,
  SUPPORT_COPY_VALUE_MAX,
  SUPPORT_DESCRIPTION_MAX,
  SUPPORT_LINK_MAX,
  SUPPORT_TITLE_MAX,
  validateSupportDraft,
  type SupportMethod,
  type SupportMethodDraft,
  type SupportMethodErrors,
} from '@/domain/support-method';
import { AdminHeader } from '@/features/admin/admin-header';
import { MediaPickerSheet } from '@/features/admin/media-picker-sheet';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { deleteSupportMethod, saveSupportMethod } from '@/services/admin/content-writes';
import { useAdminSupportMethod } from '@/services/admin/use-admin';
import { spacing } from '@/theme';

export default function SupportMethodFormScreen() {
  const { id, order } = useLocalSearchParams<{ id: string; order?: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const existing = useAdminSupportMethod(isNew ? null : id);

  if (!isNew && existing.method === null && !existing.error) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.support.editTitle')} />}>
        <LoadingState />
      </Screen>
    );
  }
  if (!isNew && (existing.method === false || existing.error || existing.method?.isDeleted)) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.support.editTitle')} />}>
        <EmptyState icon={HandHeart} title={t('manage.support.notFound')} />
      </Screen>
    );
  }
  const method = isNew ? null : (existing.method as SupportMethod);
  return <SupportMethodForm key={method?.id ?? 'new'} method={method} nextOrder={Number(order) || 0} />;
}

function SupportMethodForm({ method, nextOrder }: { method: SupportMethod | null; nextOrder: number }) {
  const { t } = useTranslation();
  const { run } = useAdminAction();
  const { can } = useCurrentUser();
  const [draft, setDraft] = useState<SupportMethodDraft>(() => (method ? draftFromSupportMethod(method) : emptySupportDraft()));
  const [errors, setErrors] = useState<SupportMethodErrors>({});
  const [picking, setPicking] = useState(false);
  const set = <K extends keyof SupportMethodDraft>(key: K, value: SupportMethodDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const err = (key: keyof SupportMethodDraft) => {
    const e = errors[key];
    return e ? t(`manage.support.errors.${e}`) : undefined;
  };

  const save = async () => {
    const result = validateSupportDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const ok = await run(
      (a) => saveSupportMethod(a, method?.id ?? null, result.value, { publish: !method && draft.isActive, order: nextOrder }),
      t('manage.support.saved'),
    );
    if (ok) router.back();
  };

  const remove = async () => {
    if (!method) return;
    const confirmed = await confirmAsync({
      title: t('manage.support.deleteTitle'),
      message: t('manage.support.deleteBody'),
      confirmLabel: t('manage.support.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    const ok = await run((a) => deleteSupportMethod(a, method.id), t('manage.support.deleted'));
    if (ok) router.back();
  };

  return (
    <Screen
      header={<AdminHeader title={method ? t('manage.support.editTitle') : t('manage.support.newTitle')} />}
      footer={
        <View style={styles.footer}>
          <Button title={t('manage.support.save')} onPress={save} />
          {method && can('support-methods.delete') ? <Button title={t('manage.support.delete')} variant="destructive" onPress={remove} /> : null}
        </View>
      }
      contentStyle={styles.content}
    >
      <Card style={styles.group}>
        <TextField label={t('manage.support.titleAr')} value={draft.titleAr} onChangeText={(v) => set('titleAr', v)} error={err('titleAr')} maxLength={SUPPORT_TITLE_MAX} />
        <TextField label={t('manage.support.titleEn')} value={draft.titleEn} onChangeText={(v) => set('titleEn', v)} error={err('titleEn')} maxLength={SUPPORT_TITLE_MAX} ltr />
        <TextField label={t('manage.support.descriptionAr')} value={draft.descriptionAr} onChangeText={(v) => set('descriptionAr', v)} maxLength={SUPPORT_DESCRIPTION_MAX} multiline />
        <TextField label={t('manage.support.descriptionEn')} value={draft.descriptionEn} onChangeText={(v) => set('descriptionEn', v)} maxLength={SUPPORT_DESCRIPTION_MAX} multiline ltr />
      </Card>

      <Card style={styles.group}>
        <TextField
          label={t('manage.support.copyValue')}
          value={draft.copyValue}
          onChangeText={(v) => set('copyValue', v)}
          error={err('copyValue')}
          maxLength={SUPPORT_COPY_VALUE_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          ltr
        />
        <TextField label={t('manage.support.copyLabelAr')} value={draft.copyLabelAr} onChangeText={(v) => set('copyLabelAr', v)} error={err('copyLabelAr')} maxLength={SUPPORT_COPY_LABEL_MAX} />
        <TextField label={t('manage.support.copyLabelEn')} value={draft.copyLabelEn} onChangeText={(v) => set('copyLabelEn', v)} error={err('copyLabelEn')} maxLength={SUPPORT_COPY_LABEL_MAX} ltr />
        <TextField
          label={t('manage.support.linkUrl')}
          value={draft.linkUrl}
          onChangeText={(v) => set('linkUrl', v)}
          error={err('linkUrl')}
          maxLength={SUPPORT_LINK_MAX}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          ltr
        />
        <AppText variant="caption" tone="secondary">
          {t('manage.support.linkHint')}
        </AppText>
      </Card>

      <Card style={styles.group} flush>
        <ListRow icon={ImageIcon} label={t('manage.support.image')} hint={draft.imagePublicId ?? t('manage.support.noImage')} chevron onPress={() => setPicking(true)} />
      </Card>

      {!method && can('support-methods.publish') ? (
        <Card style={styles.group}>
          <View style={styles.switchRow}>
            <AppText variant="body">{t('manage.support.showNow')}</AppText>
            <Switch label={t('manage.support.showNow')} value={draft.isActive} onValueChange={(v) => set('isActive', v)} />
          </View>
        </Card>
      ) : null}
      {method ? (
        <AppText variant="caption" tone="secondary">
          {t('manage.support.visibilityHint')}
        </AppText>
      ) : null}

      <MediaPickerSheet
        visible={picking}
        title={t('manage.support.pickTitle')}
        entity="support"
        entityId={method?.id ?? null}
        selected={draft.imagePublicId}
        onClose={() => setPicking(false)}
        onPick={(publicId) => {
          set('imagePublicId', publicId);
          setPicking(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  group: { gap: spacing[3] },
  footer: { gap: spacing[2] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
