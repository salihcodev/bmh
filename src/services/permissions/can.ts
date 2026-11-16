import type { Permission, PermissionMap, Role } from './matrix';

export type MemberLike = {
  role: Role;
  status: 'active' | 'disabled';
  permissions: PermissionMap;
};

/**
 * Mirrors hasPerm() in firestore.rules. UI uses it to hide/disable actions;
 * the rules remain the actual enforcement.
 */
export function can(member: MemberLike | null | undefined, permission: Permission): boolean {
  if (!member || member.status !== 'active') return false;
  if (member.role === 'owner' || member.role === 'admin') return true;
  return member.permissions[permission] === true;
}

export function isOwner(member: MemberLike | null | undefined): boolean {
  return !!member && member.status === 'active' && member.role === 'owner';
}

export function isOwnerOrAdmin(member: MemberLike | null | undefined): boolean {
  return !!member && member.status === 'active' && (member.role === 'owner' || member.role === 'admin');
}
