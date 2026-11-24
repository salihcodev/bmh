import { useLocalSearchParams } from 'expo-router';

import { RoleEditor } from '@/features/dashboard/catalog-screens';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function RoleRoute() {
  const { roleId } = useLocalSearchParams<{ roleId: string }>();
  const { can } = useCurrentUser();
  const allowed = roleId === 'new' ? can('roles.create') : can('roles.view');
  return (
    <PermissionGate allowed={allowed} fallback="/dashboard/roles">
      <RoleEditor roleId={roleId} />
    </PermissionGate>
  );
}
