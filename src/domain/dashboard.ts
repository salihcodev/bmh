import { SYSTEM_USER_TYPES, type UserType } from './user';

export const STAFF_USER_TYPES = ['support', 'moderator', 'custom'] as const;
export type StaffUserType = (typeof STAFF_USER_TYPES)[number];

export type UserTypeFilter = 'all' | 'system' | 'platform' | UserType;
export type UserStatusFilter = 'any' | 'active' | 'suspended';

export type UserBrowse = {
  type: UserTypeFilter;
  status: UserStatusFilter;
  /** Exact email lookup when the box is a full address. Otherwise a filter of loaded rows. */
  search: string;
  /** Soft-deleted accounts stay hidden until asked for. */
  showDeleted: boolean;
};

export const DEFAULT_USER_BROWSE: UserBrowse = {
  type: 'all',
  status: 'any',
  search: '',
  showDeleted: false,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmailQuery(value: string): boolean {
  return EMAIL.test(normalizeEmail(value));
}

export type UserQueryMode =
  | { kind: 'email'; email: string }
  | { kind: 'status'; status: 'active' | 'suspended' }
  | { kind: 'types'; values: readonly string[] }
  | { kind: 'all' };

const PLATFORM_TYPES = ['member', 'supplier'] as const;

/** One Firestore constraint. The other filters run on the loaded page. */
export function userQueryMode(browse: UserBrowse): UserQueryMode {
  const search = browse.search.trim();
  if (isEmailQuery(search)) return { kind: 'email', email: normalizeEmail(search) };
  if (browse.type === 'system') return { kind: 'types', values: SYSTEM_USER_TYPES };
  if (browse.type === 'platform') return { kind: 'types', values: PLATFORM_TYPES };
  if (browse.type !== 'all') return { kind: 'types', values: [browse.type] };
  if (browse.status === 'active' || browse.status === 'suspended') return { kind: 'status', status: browse.status };
  return { kind: 'all' };
}

export function userMatchesBrowse(
  user: { userType: string; status: string; isDeleted: boolean; displayName: string; email?: string },
  browse: UserBrowse,
): boolean {
  if (user.isDeleted && !browse.showDeleted) return false;
  if (!browse.showDeleted && user.status !== 'active' && user.status !== 'suspended') return false;
  if (browse.status !== 'any' && user.status !== browse.status) return false;
  if (browse.type === 'system' && !(SYSTEM_USER_TYPES as readonly string[]).includes(user.userType)) return false;
  if (browse.type === 'platform' && !(PLATFORM_TYPES as readonly string[]).includes(user.userType)) return false;
  if (browse.type !== 'all' && browse.type !== 'system' && browse.type !== 'platform' && user.userType !== browse.type) {
    return false;
  }
  const needle = browse.search.trim().toLowerCase();
  if (!needle || isEmailQuery(needle)) return true;
  return user.displayName.toLowerCase().includes(needle) || (user.email ?? '').toLowerCase().includes(needle);
}

export type StaffDraft = {
  displayName: string;
  email: string;
  password: string;
  userType: StaffUserType;
  systemRoleId: string;
};

export type StaffDraftError = 'name' | 'email' | 'password' | 'role';

/** Client check before Auth + the users/{uid} write. Rules still reject a bad document. */
export function validateStaffDraft(draft: StaffDraft): StaffDraftError | null {
  const name = draft.displayName.trim();
  if (name.length < 1 || name.length > 80) return 'name';
  if (!isEmailQuery(draft.email)) return 'email';
  if (draft.password.length < 6 || draft.password.length > 128) return 'password';
  if (!draft.systemRoleId || draft.systemRoleId === 'owner') return 'role';
  if (!(STAFF_USER_TYPES as readonly string[]).includes(draft.userType)) return 'role';
  return null;
}

/** Seeded role ids keep their userType. Any other role is a custom system user. */
export function userTypeForRole(roleId: string): StaffUserType {
  if (roleId === 'support' || roleId === 'moderator') return roleId;
  return 'custom';
}

export function bilingualName(ar: string, en: string, max = 60): { ar: string; en: string } | null {
  const name = { ar: ar.trim(), en: en.trim() };
  if (!name.ar || !name.en || name.ar.length > max || name.en.length > max) return null;
  return name;
}
