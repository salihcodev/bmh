import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { workspaceSchema, type WorkspaceInput } from '@/features/workspaces/schemas';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useWorkspace } from '@/providers/workspace-provider';
import { OfflineError } from '@/services/sync/connectivity';
import { createWorkspace } from '@/services/workspaces/api';

export default function CreateWorkspaceScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { actor, switchWorkspace } = useWorkspace();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceInput>({ resolver: zodResolver(workspaceSchema), defaultValues: { name: '', description: '' } });

  const submit = handleSubmit(async (value) => {
    if (!actor) return;
    try {
      const wid = await createWorkspace(value, actor);
      switchWorkspace(wid);
      emitActionFeedback({ message: t('onboarding.created'), kind: 'success' });
      router.replace('/(app)');
    } catch (error) {
      setError('root', { message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error) });
    }
  });

  return (
    <Screen header={<AppHeader title={t('onboarding.createTitle')} back />}>
      <Card>
        <AppText muted style={{ marginBottom: 16 }}>
          {t('onboarding.createHint')}
        </AppText>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Field
              label={t('onboarding.workspaceName')}
              autoCapitalize="sentences"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.name?.message ? t(errors.name.message) : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Field
              label={`${t('onboarding.description')} (${t('common.optional')})`}
              multiline
              autoCapitalize="sentences"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.description?.message ? t(errors.description.message) : undefined}
            />
          )}
        />
        {errors.root?.message ? <AppText style={{ color: colors.danger }}>{errors.root.message}</AppText> : null}
        <Button
          title={t('onboarding.create')}
          loadingTitle={t('onboarding.creating')}
          loading={isSubmitting}
          onPress={submit}
        />
      </Card>
    </Screen>
  );
}
