import { RoleList } from '@/features/dashboard/catalog-screens';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function RolesRoute() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('roles.view')} fallback="/dashboard">
      <RoleList />
    </PermissionGate>
  );
}
