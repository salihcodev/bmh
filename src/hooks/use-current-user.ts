import { useCallback } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { canSystem, hasSystemAccess, isOwnerUser } from '@/services/permissions/can';
import type { SystemPermission } from '@/services/permissions/catalog';

/** Platform-level view of the signed-in account. Workspace permissions stay in usePermission(). */
export function useCurrentUser() {
  const { user, profile, systemRole, systemRoleLoading } = useAuth();
  const can = useCallback(
    (permission: SystemPermission) => canSystem(profile, systemRole, permission),
    [profile, systemRole],
  );
  return {
    user,
    profile,
    systemRole,
    systemRoleLoading,
    isOwner: isOwnerUser(profile),
    /** Holds at least one system key: sees the Manage area. */
    hasDashboard: hasSystemAccess(profile, systemRole),
    status: profile?.status ?? 'active',
    isSuspended: profile?.status === 'suspended',
    can,
  };
}
