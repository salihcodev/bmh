import { useCallback } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { canPlatform, isSuperAdmin, type PlatformPermission } from '@/services/permissions/platform';

/** Platform-level view of the signed-in account. Workspace permissions stay in useCan(). */
export function useCurrentUser() {
  const { user, profile } = useAuth();
  const can = useCallback((permission: PlatformPermission) => canPlatform(profile, permission), [profile]);
  return {
    user,
    profile,
    isSuperAdmin: isSuperAdmin(profile),
    status: profile?.status ?? 'active',
    isSuspended: profile?.status === 'suspended',
    can,
  };
}
