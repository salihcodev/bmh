import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFinishOnboarding } from '@/features/onboarding/use-finish-onboarding';
import { workspaceSchema, type WorkspaceInput } from '@/features/workspaces/schemas';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useWorkspace } from '@/providers/workspace-provider';
import { OfflineError } from '@/services/sync/connectivity';
import { createWorkspace } from '@/services/workspaces/api';

export default function CreateWorkspaceScreen() {
  const { t } = useTranslation();
  const { actor, switchWorkspace } = useWorkspace();
  const finish = useFinishOnboarding();
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
      await finish('/');
    } catch (error) {
      setError('root', { message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error) });
    }
  });

  return (
    <Screen header={<AppHeader title={t('onboarding.createTitle')} back />}>
      <Card>
        <AppText muted style={styles.hint}>
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
        {errors.root?.message ? (
          <AppText variant="bodySm" tone="danger">
            {errors.root.message}
          </AppText>
        ) : null}
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

const styles = StyleSheet.create({ hint: { marginBottom: Spacing.lg } });
