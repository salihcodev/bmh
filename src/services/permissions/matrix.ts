// Single source of truth for permission keys and role defaults.
// Keep in sync with validPermissions() in firestore.rules.
// Underscore keys keep Firestore field paths safe (no dots).

export const PERMISSIONS = [
  'beneficiaries_view',
  'beneficiaries_create',
  'beneficiaries_edit',
  'beneficiaries_archive',
  'beneficiaries_export',
  'beneficiaries_import',
  'areas_manage',
  'members_manage',
  'sessions_create',
  'sessions_run',
  'sessions_reassign',
  'sessions_view_history',
  'assistance_record',
  'history_view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type PermissionMap = Partial<Record<Permission, boolean>>;

export type Role = 'owner' | 'admin' | 'member';
export const ROLES: readonly Role[] = ['owner', 'admin', 'member'];

/** Defaults granted to a new Member. Owner/Admin implicitly have every permission. */
export const MEMBER_DEFAULT_PERMISSIONS: PermissionMap = {
  beneficiaries_view: true,
  sessions_view_history: true,
  history_view: true,
};

export function defaultPermissionsFor(role: Role): PermissionMap {
  if (role === 'member') return { ...MEMBER_DEFAULT_PERMISSIONS };
  return Object.fromEntries(PERMISSIONS.map((key) => [key, true])) as PermissionMap;
}

/** Strips unknown keys so the map always passes validPermissions() in rules. */
export function sanitizePermissions(input: Record<string, unknown> | undefined): PermissionMap {
  const result: PermissionMap = {};
  for (const key of PERMISSIONS) {
    if (input?.[key] === true) result[key] = true;
  }
  return result;
}
