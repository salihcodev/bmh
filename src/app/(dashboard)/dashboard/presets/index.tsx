import { PresetList } from '@/features/dashboard/catalog-screens';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function PresetsRoute() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('presets.view')} fallback="/dashboard">
      <PresetList />
    </PermissionGate>
  );
}
