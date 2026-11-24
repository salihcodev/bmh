import { useLocalSearchParams } from 'expo-router';

import { PresetEditor } from '@/features/dashboard/catalog-screens';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function PresetRoute() {
  const { presetId } = useLocalSearchParams<{ presetId: string }>();
  const { can } = useCurrentUser();
  const allowed = presetId === 'new' ? can('presets.create') : can('presets.view');
  return (
    <PermissionGate allowed={allowed} fallback="/dashboard/presets">
      <PresetEditor presetId={presetId} />
    </PermissionGate>
  );
}
