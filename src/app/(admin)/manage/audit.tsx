import { AuditLogScreen } from '@/features/audit-log/audit-log-screen';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function ManageAudit() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('logs.view')} fallback="/dashboard">
      <AuditLogScreen />
    </PermissionGate>
  );
}
