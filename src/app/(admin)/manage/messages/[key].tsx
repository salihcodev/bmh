import { router, useLocalSearchParams } from 'expo-router';
import { MessageSquareText } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  confirmAsync,
  EmptyState,
  LoadingState,
  NoPermissionState,
  Screen,
  Switch,
  TextField,
} from '@/components/ui';
import { USER_TYPES } from '@/domain/user';
import {
  draftFromMessage,
  emptyMessageDraft,
  MESSAGE_CATEGORIES,
  MESSAGE_TEXT_MAX,
  MESSAGE_TITLE_MAX,
  MESSAGE_TYPES,
  PLACEMENT_MAX,
  validateMessageDraft,
  type AudienceKind,
  type MessageCategory,
  type MessageDraftErrors,
  type SystemMessage,
  type SystemMessageDraft,
} from '@/domain/system-message';
import { AdminHeader } from '@/features/admin/admin-header';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import {
  createSystemMessage,
  deleteSystemMessage,
  MessageKeyTakenError,
  updateSystemMessage,
} from '@/services/admin/content-writes';
import { MESSAGE_FAMILY, useAdminMessage } from '@/services/admin/use-admin';
import { spacing } from '@/theme';

export default function MessageFormScreen() {
  const { key, category } = useLocalSearchParams<{ key: string; category?: string }>();
  const isNew = key === 'new';
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const existing = useAdminMessage(isNew ? null : key);

  if (!isNew && existing.message === null && !existing.error) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.messages.editTitle')} />}>
        <LoadingState />
      </Screen>
    );
  }
  if (!isNew && (existing.message === false || existing.error || existing.message?.isDeleted)) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.messages.editTitle')} />}>
        <EmptyState icon={MessageSquareText} title={t('manage.messages.notFound')} />
      </Screen>
    );
  }
  const message = isNew ? null : (existing.message as SystemMessage);
  // Editing needs the edit key of the message's family; creating needs a create key for some family.
  const allowed = message
    ? can(`${MESSAGE_FAMILY[message.category]}.edit`)
    : MESSAGE_CATEGORIES.some((c) => can(`${MESSAGE_FAMILY[c]}.create`));
  if (!allowed) {
    return (
      <Screen scroll={false} header={<AdminHeader title={t('manage.messages.editTitle')} />}>
        <NoPermissionState />
      </Screen>
    );
  }
  const first = MESSAGE_CATEGORIES.find((c) => c === category && can(`${MESSAGE_FAMILY[c]}.create`)) ?? MESSAGE_CATEGORIES.find((c) => can(`${MESSAGE_FAMILY[c]}.create`)) ?? 'message';
  return <MessageForm key={message?.key ?? 'new'} message={message} startCategory={first} />;
}

function MessageForm({ message, startCategory }: { message: SystemMessage | null; startCategory: MessageCategory }) {
  const { t } = useTranslation();
  const { run } = useAdminAction();
  const { can } = useCurrentUser();
  const [draft, setDraft] = useState<SystemMessageDraft>(() => (message ? draftFromMessage(message) : emptyMessageDraft(startCategory)));
  const [errors, setErrors] = useState<MessageDraftErrors>({});
  const set = <K extends keyof SystemMessageDraft>(field: K, value: SystemMessageDraft[K]) => setDraft((d) => ({ ...d, [field]: value }));
  const err = (field: keyof SystemMessageDraft) => {
    const e = errors[field];
    return e ? t(`manage.messages.errors.${e}`) : undefined;
  };
  const canEditIn = (c: MessageCategory) => can(`${MESSAGE_FAMILY[c]}.${message ? 'edit' : 'create'}`);
  const canPublish = can(`${MESSAGE_FAMILY[draft.category]}.publish`);
  const audienceKinds: AudienceKind[] = message?.audience.kind === 'role' ? ['all', 'userType', 'role'] : ['all', 'userType'];

  const toggleType = (type: string) =>
    set('audienceValues', draft.audienceValues.includes(type) ? draft.audienceValues.filter((v) => v !== type) : [...draft.audienceValues, type]);

  const save = async () => {
    const result = validateMessageDraft(draft, { isNew: !message });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    let keyTaken = false;
    const ok = await run(async (a) => {
      try {
        if (message) await updateSystemMessage(a, message.key, result.value);
        else await createSystemMessage(a, result.value);
      } catch (error) {
        if (error instanceof MessageKeyTakenError) {
          keyTaken = true;
          setErrors({ key: 'invalidKey' });
          throw new Error(t('manage.messages.keyTaken'));
        }
        throw error;
      }
    }, t('manage.messages.saved'));
    if (ok && !keyTaken) router.back();
  };

  const remove = async () => {
    if (!message) return;
    const confirmed = await confirmAsync({
      title: t('manage.messages.deleteTitle'),
      message: t('manage.messages.deleteBody'),
      confirmLabel: t('manage.messages.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    const ok = await run((a) => deleteSystemMessage(a, message.key), t('manage.messages.deleted'));
    if (ok) router.back();
  };

  return (
    <Screen
      header={<AdminHeader title={message ? t('manage.messages.editTitle') : t('manage.messages.newTitle')} />}
      footer={
        <View style={styles.footer}>
          <Button title={t('manage.messages.save')} onPress={save} />
          {message && can(`${MESSAGE_FAMILY[message.category]}.delete`) ? (
            <Button title={t('manage.messages.delete')} variant="destructive" onPress={remove} />
          ) : null}
        </View>
      }
      contentStyle={styles.content}
    >
      <Card style={styles.group}>
        {message ? (
          <AppText variant="label" ltr selectable>
            {message.key}
          </AppText>
        ) : (
          <TextField
            label={t('manage.messages.key')}
            value={draft.key}
            onChangeText={(v) => set('key', v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            error={err('key')}
            maxLength={60}
            autoCapitalize="none"
            autoCorrect={false}
            ltr
          />
        )}
        <AppText variant="label">{t('manage.messages.category')}</AppText>
        <View style={styles.row}>
          {MESSAGE_CATEGORIES.filter(canEditIn).map((c) => (
            <Chip key={c} label={t(`manage.messages.categories.${c}`)} selected={draft.category === c} onPress={() => set('category', c)} />
          ))}
        </View>
        <AppText variant="label">{t('manage.messages.type')}</AppText>
        <View style={styles.row}>
          {MESSAGE_TYPES.map((type) => (
            <Chip key={type} label={t(`manage.messages.types.${type}`)} selected={draft.type === type} onPress={() => set('type', type)} />
          ))}
        </View>
        <TextField
          label={t('manage.messages.placement')}
          value={draft.placement}
          onChangeText={(v) => set('placement', v)}
          error={err('placement')}
          maxLength={PLACEMENT_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          ltr
        />
      </Card>

      <Card style={styles.group}>
        <TextField label={t('manage.messages.titleAr')} value={draft.titleAr} onChangeText={(v) => set('titleAr', v)} error={err('titleAr')} maxLength={MESSAGE_TITLE_MAX} />
        <TextField label={t('manage.messages.textAr')} value={draft.textAr} onChangeText={(v) => set('textAr', v)} error={err('textAr')} maxLength={MESSAGE_TEXT_MAX} multiline />
        <TextField label={t('manage.messages.titleEn')} value={draft.titleEn} onChangeText={(v) => set('titleEn', v)} error={err('titleEn')} maxLength={MESSAGE_TITLE_MAX} ltr />
        <TextField label={t('manage.messages.textEn')} value={draft.textEn} onChangeText={(v) => set('textEn', v)} error={err('textEn')} maxLength={MESSAGE_TEXT_MAX} multiline ltr />
      </Card>

      <Card style={styles.group}>
        <AppText variant="label">{t('manage.messages.audience')}</AppText>
        <View style={styles.row}>
          {audienceKinds.map((kind) => (
            <Chip
              key={kind}
              label={t(`manage.messages.audiences.${kind}`)}
              selected={draft.audienceKind === kind}
              onPress={() => setDraft((d) => ({ ...d, audienceKind: kind, audienceValues: kind === message?.audience.kind ? message.audience.values : [] }))}
            />
          ))}
        </View>
        {draft.audienceKind === 'userType' ? (
          <View style={styles.row}>
            {USER_TYPES.map((type) => (
              <Chip key={type} label={t(`manage.users.type.${type}`, { defaultValue: type })} selected={draft.audienceValues.includes(type)} onPress={() => toggleType(type)} />
            ))}
          </View>
        ) : null}
        {draft.audienceKind === 'role' ? (
          <AppText variant="bodySm" tone="secondary" ltr>
            {draft.audienceValues.join(', ')}
          </AppText>
        ) : null}
        {errors.audienceValues ? (
          <AppText variant="caption" tone="danger">
            {err('audienceValues')}
          </AppText>
        ) : null}
        {!message && canPublish ? (
          <View style={styles.switchRow}>
            <AppText variant="body">{t('manage.messages.publishNow')}</AppText>
            <Switch label={t('manage.messages.publishNow')} value={draft.isPublished} onValueChange={(v) => set('isPublished', v)} />
          </View>
        ) : null}
        {message ? (
          <AppText variant="caption" tone="secondary">
            {t('manage.messages.publishHint')}
          </AppText>
        ) : null}
      </Card>
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
