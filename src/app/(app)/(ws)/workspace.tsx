import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Button, Card, ConfirmDialog, Field, Screen, Section } from '@/components/ui';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { workspaceSchema, type WorkspaceInput } from '@/features/workspaces/schemas';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission } from '@/providers/workspace-provider';
import { recountCounters } from '@/services/places/api';
import { OfflineError } from '@/services/sync/connectivity';
import { deleteWorkspace, updateWorkspaceDetails } from '@/services/workspaces/api';

export default function WorkspaceSettingsScreen() {
  const canEdit = usePermission('workspace.edit');
  const canDelete = usePermission('workspace.delete');
  return (
    <PermissionGate allowed={canEdit || canDelete}>
      <WorkspaceSettings canEdit={canEdit} canDelete={canDelete} />
    </PermissionGate>
  );
}

function WorkspaceSettings({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const { wid, workspace, actor } = useActiveWorkspace();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceInput>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: workspace?.name ?? '', description: workspace?.description ?? '' },
  });

  const report = (error: unknown) =>
    emitActionFeedback({
      message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
      kind: 'error',
    });

  const submit = handleSubmit((value) => {
    updateWorkspaceDetails(wid, value);
    emitActionFeedback({ message: t('cities.saved'), kind: 'success' });
    router.back();
  });

  return (
    <Screen header={<ScreenHeader title={t('workspace.settings')} back />}>
      <Card>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Field
              label={t('onboarding.workspaceName')}
              editable={canEdit}
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
              editable={canEdit}
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.description?.message ? t(errors.description.message) : undefined}
            />
          )}
        />
        {canEdit ? <Button title={t('common.save')} onPress={submit} /> : null}
      </Card>
      {canEdit ? (
        <Section title={t('workspace.recount')}>
          <Button
            title={t('workspace.recount')}
            variant="secondary"
            onPress={async () => {
              try {
                await recountCounters(wid, actor);
                emitActionFeedback({ message: t('workspace.recounted'), kind: 'success' });
              } catch (error) {
                report(error);
              }
            }}
          />
        </Section>
      ) : null}
      {canDelete ? (
        <Section title={t('workspace.deleteTitle')}>
          <Button title={t('workspace.delete')} variant="danger" onPress={() => setConfirmDelete(true)} />
        </Section>
      ) : null}
      <ConfirmDialog
        visible={confirmDelete}
        title={t('workspace.delete')}
        message={t('workspace.deleteConfirm', { name: workspace?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          try {
            await deleteWorkspace(wid, actor);
            emitActionFeedback({ message: t('workspace.deleted'), kind: 'success' });
            router.replace('/');
          } catch (error) {
            report(error);
          }
        }}
      />
    </Screen>
  );
}
