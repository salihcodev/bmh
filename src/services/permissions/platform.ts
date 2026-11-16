import type { GlobalRole, UserStatus } from '@/domain/user';

// Platform permissions are separate from workspace permissions (matrix.ts).
// Mirrors isSuperAdmin() in firestore.rules; the rules are the enforcement.
export const PLATFORM_PERMISSIONS = [
  'platform_manage_users',
  'platform_manage_content',
  'platform_manage_media',
  'platform_view_reports',
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

const GRANTS: Record<GlobalRole, readonly PlatformPermission[]> = {
  user: [],
  superadmin: PLATFORM_PERMISSIONS,
};

export type PlatformUserLike = { globalRole: GlobalRole; status: UserStatus };

export function canPlatform(user: PlatformUserLike | null | undefined, permission: PlatformPermission): boolean {
  if (!user || user.status !== 'active') return false;
  return GRANTS[user.globalRole]?.includes(permission) ?? false;
}

export function isSuperAdmin(user: PlatformUserLike | null | undefined): boolean {
  return !!user && user.status === 'active' && user.globalRole === 'superadmin';
}
