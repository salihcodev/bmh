import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  GroupedList,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { deleteWorkspaceAsStaff, setWorkspaceArchived, updateWorkspaceAsStaff } from '@/services/admin/admin-writes';
import { useDashboardWorkspace, useWorkspaceBeneficiaries, useWorkspaceSessions } from '@/services/admin/use-admin';
import { spacing } from '@/theme';
import { Archive, ArchiveRestore, ClipboardList, Trash2 } from 'lucide-react-native';

export default function WorkspaceRoute() {
  const { can } = useCurrentUser();
  const { wid } = useLocalSearchParams<{ wid: string }>();
  return (
    <PermissionGate allowed={can('workspaces.view')} fallback="/dashboard/workspaces">
      <WorkspaceDetail wid={wid} />
    </PermissionGate>
  );
}

function WorkspaceDetail({ wid }: { wid: string }) {
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const { run } = useAdminAction();
  const state = useDashboardWorkspace(wid);
  const dataView = can('workspaces.data-view');
  const beneficiaries = useWorkspaceBeneficiaries(wid, dataView && !!state.workspace);
  const sessions = useWorkspaceSessions(wid, dataView && !!state.workspace && !state.workspace.isDeleted);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'archive' | 'restore' | 'delete' | null>(null);

  if (state.error) {
    return (
      <Screen header={<ScreenHeader title={t('dashboard.workspacesTitle')} back />}>
        <ErrorState message={t('states.loadFailed')} />
      </Screen>
    );
  }
  if (!state.workspace) {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('dashboard.workspacesTitle')} back />}>
        {state.workspace === false ? <EmptyState icon={ClipboardList} title={t('common.empty')} /> : <LoadingState />}
      </Screen>
    );
  }

  const workspace = state.workspace;
  const nameValue = name ?? workspace.name;
  const descriptionValue = description ?? workspace.description ?? '';
  const closed = workspace.isDeleted || workspace.isArchived;

  return (
    <Screen header={<ScreenHeader title={workspace.name} back />} contentStyle={styles.content}>
      <Card style={styles.card}>
        {can('workspaces.edit') && !workspace.isDeleted ? (
          <>
            <Field label={t('dashboard.workspaceName')} value={nameValue} onChangeText={setName} editable={!workspace.isArchived} />
            <Field label={t('dashboard.workspaceDescription')} value={descriptionValue} onChangeText={setDescription} editable={!workspace.isArchived} />
            {workspace.isArchived ? null : (
              <Button
                title={t('common.save')}
                onPress={() => run((actor) => updateWorkspaceAsStaff(actor, wid, { name: nameValue, description: descriptionValue }, { name: workspace.name, description: workspace.description }), t('dashboard.saved'))}
              />
            )}
          </>
        ) : (
          <AppText variant="body">{workspace.description || t('dashboard.noDescription')}</AppText>
        )}
        <AppText variant="caption" tone="secondary" center>
          {t('dashboard.workspaceCounts', { beneficiaries: workspace.beneficiaryCount, sessions: workspace.sessionCount })}
        </AppText>
      </Card>
      {!workspace.isDeleted && (can('workspaces.archive') || can('workspaces.delete')) ? (
        <GroupedList>
          {can('workspaces.archive') ? (
            <ListRow
              icon={workspace.isArchived ? ArchiveRestore : Archive}
              label={workspace.isArchived ? t('dashboard.restore') : t('dashboard.archive')}
              chevron={false}
              onPress={() => setConfirm(workspace.isArchived ? 'restore' : 'archive')}
            />
          ) : null}
          {can('workspaces.delete') ? (
            <ListRow icon={Trash2} label={t('dashboard.delete')} destructive chevron={false} onPress={() => setConfirm('delete')} />
          ) : null}
        </GroupedList>
      ) : null}
      {dataView && !closed ? (
        <>
          <View>
            <SectionHeader title={t('dashboard.beneficiaries')} />
            <RecordList items={beneficiaries.items} loading={beneficiaries.status === 'loading'} empty={t('dashboard.recordsEmpty')} onMore={beneficiaries.loadMore} done={beneficiaries.done} />
          </View>
          <View>
            <SectionHeader title={t('dashboard.sessions')} />
            <RecordList items={sessions.items} loading={sessions.status === 'loading'} empty={t('dashboard.recordsEmpty')} onMore={sessions.loadMore} done={sessions.done} />
          </View>
        </>
      ) : (
        <AppText variant="body" tone="secondary">
          {t(dataView ? 'dashboard.recordsClosed' : 'dashboard.recordsLocked')}
        </AppText>
      )}
      <ConfirmDialog
        visible={!!confirm}
        title={t(confirm === 'delete' ? 'dashboard.deleteTitle' : confirm === 'restore' ? 'dashboard.restoreTitle' : 'dashboard.archiveTitle')}
        message={t(confirm === 'delete' ? 'dashboard.deleteWorkspaceBody' : confirm === 'restore' ? 'dashboard.restoreBody' : 'dashboard.archiveBody')}
        confirmLabel={t(confirm === 'delete' ? 'dashboard.delete' : confirm === 'restore' ? 'dashboard.restore' : 'dashboard.archive')}
        cancelLabel={t('common.cancel')}
        destructive={confirm === 'delete' || confirm === 'archive'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm;
          setConfirm(null);
          if (action === 'delete') await run((actor) => deleteWorkspaceAsStaff(actor, wid, workspace.name), t('dashboard.deletedDone'));
          if (action === 'archive' || action === 'restore') {
            await run((actor) => setWorkspaceArchived(actor, wid, action === 'archive', workspace.name), t('dashboard.saved'));
          }
        }}
      />
    </Screen>
  );
}

function RecordList({
  items,
  loading,
  empty,
  onMore,
  done,
}: {
  items: { id: string; title: string; subtitle: string }[] | null;
  loading: boolean;
  empty: string;
  onMore: () => void;
  done: boolean;
}) {
  const { t } = useTranslation();
  if (loading && !items) return <LoadingState />;
  if (!items?.length) return <EmptyState icon={ClipboardList} title={empty} />;
  return (
    <View style={styles.list}>
      <GroupedList>
        {items.map((item) => (
          <ListRow key={item.id} label={item.title || item.id} hint={item.subtitle} />
        ))}
      </GroupedList>
      {done ? null : <Button title={t('dashboard.loadMore')} variant="ghost" onPress={onMore} />}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  list: { gap: spacing[4] },
  card: { gap: spacing[2], marginBottom: 0 },
});
