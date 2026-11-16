import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, Field, Screen, Section } from '@/components/ui';
import { workspaceSchema, type WorkspaceInput } from '@/features/workspaces/schemas';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace } from '@/providers/workspace-provider';
import { isOwnerOrAdmin } from '@/services/permissions/can';
import { recountCounters } from '@/services/places/api';
import { OfflineError } from '@/services/sync/connectivity';
import { updateWorkspaceDetails } from '@/services/workspaces/api';

export default function WorkspaceSettingsScreen() {
  const { t } = useTranslation();
  const { wid, workspace, member, actor } = useActiveWorkspace();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceInput>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: workspace?.name ?? '', description: workspace?.description ?? '' },
  });

  const submit = handleSubmit((value) => {
    updateWorkspaceDetails(wid, value);
    emitActionFeedback({ message: t('cities.saved'), kind: 'success' });
    router.back();
  });

  const allowed = isOwnerOrAdmin(member);

  return (
    <Screen header={<AppHeader title={t('workspace.settings')} back />}>
      <Card>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Field
              label={t('onboarding.workspaceName')}
              editable={allowed}
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
              label={t('onboarding.description')}
              multiline
              editable={allowed}
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.description?.message ? t(errors.description.message) : undefined}
            />
          )}
        />
        {allowed ? <Button title={t('common.save')} onPress={submit} /> : <AppText muted>{t('common.notAllowed')}</AppText>}
      </Card>
      {allowed ? (
        <Section title={t('workspace.recount')}>
          <Button
            title={t('workspace.recount')}
            variant="secondary"
            onPress={async () => {
              try {
                await recountCounters(wid, actor);
                emitActionFeedback({ message: t('workspace.recounted'), kind: 'success' });
              } catch (error) {
                emitActionFeedback({
                  message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
                  kind: 'error',
                });
              }
            }}
          />
        </Section>
      ) : null}
    </Screen>
  );
}
