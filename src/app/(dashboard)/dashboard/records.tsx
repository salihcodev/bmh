import { router } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText, EmptyState, ErrorState, GroupedList, ListRow, LoadingState, Screen } from '@/components/ui';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { useDashboardWorkspaces } from '@/services/admin/use-admin';
import { spacing } from '@/theme';
import { formatNumber } from '@/utils/format';

/** Read-only overview. Record rows open only with workspaces.data-view. */
export default function RecordsRoute() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('workspaces.view')} fallback="/dashboard">
      <RecordsScreen />
    </PermissionGate>
  );
}

function RecordsScreen() {
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const page = useDashboardWorkspaces();
  const dataView = can('workspaces.data-view');
  const rows = (page.items ?? []).filter((item) => !item.isDeleted);

  return (
    <Screen header={<ScreenHeader title={t('dashboard.recordsTitle')} subtitle={t('dashboard.recordsSubtitle')} back />} contentStyle={styles.content}>
      <AppText variant="body" tone="secondary">
        {t(dataView ? 'dashboard.recordsOpen' : 'dashboard.recordsLocked')}
      </AppText>
      {page.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={page.refresh} />
      ) : page.status === 'loading' && !page.items ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} title={t('dashboard.workspacesEmpty')} />
      ) : (
        <GroupedList>
          {rows.map((item) => (
            <ListRow
              key={item.id}
              icon={Building2}
              label={item.name}
              hint={t('dashboard.workspaceCounts', {
                beneficiaries: formatNumber(item.beneficiaryCount),
                sessions: formatNumber(item.sessionCount),
              })}
              chevron={dataView}
              onPress={dataView ? () => router.push(`/dashboard/workspaces/${item.id}`) : undefined}
            />
          ))}
        </GroupedList>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
});
