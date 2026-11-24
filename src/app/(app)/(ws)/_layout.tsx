import { Stack } from 'expo-router';

import { LoadingState, Screen } from '@/components/ui';
import { NoWorkspaceScreen } from '@/features/workspaces/no-workspace';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useTranslation } from '@/localization';
import { useWorkspace } from '@/providers/workspace-provider';

/** Workspace screens: rendered only with a verified active membership (useActiveWorkspace never sees ''). */
export default function WorkspaceLayout() {
  const { t } = useTranslation();
  const { loading, roleLoading, workspaceId, member } = useWorkspace();
  const stackOptions = useStackScreenOptions();
  // Wait for the member's role doc too, so permission checks never flash "not allowed".
  if (loading || roleLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!workspaceId || !member) return <NoWorkspaceScreen title={t('tabs.activities')} back />;
  return <Stack screenOptions={stackOptions} />;
}
