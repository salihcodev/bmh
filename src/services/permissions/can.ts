import {
  isPermissionKey,
  permissionDef,
  WORKSPACE_ADMIN_ROLE,
  type PermissionKey,
  type PermissionScope,
  type SystemPermission,
  type WorkspacePermission,
} from './catalog';

// Mirrors hasPerm() / hasSys() in firestore.rules. UI uses it to hide or disable actions;
// the rules remain the actual enforcement.

export type RoleLike = { permissions: readonly string[]; isDeleted?: boolean };

export type MemberLike = { roleId: string; status: 'active' | 'disabled' };

export type UserLike = {
  userType: string;
  systemRoleId?: string | null;
  status: 'active' | 'suspended';
  isDeleted?: boolean;
};

export type PermissionSubject = {
  user?: UserLike | null;
  /** The user's system role doc (`systemRoles/{systemRoleId}`). */
  systemRole?: RoleLike | null;
  /** The membership in the workspace being checked. */
  member?: MemberLike | null;
  /** The member's role doc (`workspaces/{wid}/roles/{roleId}`). Not needed for admins. */
  workspaceRole?: RoleLike | null;
};

function activeUser(user: UserLike | null | undefined): user is UserLike {
  return !!user && user.status === 'active' && !user.isDeleted;
}

export function isOwnerUser(user: UserLike | null | undefined): boolean {
  return activeUser(user) && user.userType === 'owner';
}

export function isWorkspaceAdmin(member: MemberLike | null | undefined): boolean {
  return !!member && member.status === 'active' && member.roleId === WORKSPACE_ADMIN_ROLE;
}

/** Holds at least one system key (owner, or a system role). Gates the dashboard. */
export function hasSystemAccess(user: UserLike | null | undefined, role: RoleLike | null | undefined): boolean {
  if (isOwnerUser(user)) return true;
  return activeUser(user) && !!user.systemRoleId && !!role && !role.isDeleted && role.permissions.length > 0;
}

export function canSystem(
  user: UserLike | null | undefined,
  role: RoleLike | null | undefined,
  key: SystemPermission,
): boolean {
  if (isOwnerUser(user)) return true;
  if (!activeUser(user) || !user.systemRoleId || !role || role.isDeleted) return false;
  return role.permissions.includes(key);
}

export function canWorkspace(
  member: MemberLike | null | undefined,
  role: RoleLike | null | undefined,
  key: WorkspacePermission,
): boolean {
  if (!member || member.status !== 'active') return false;
  if (member.roleId === WORKSPACE_ADMIN_ROLE) return true;
  if (!role || role.isDeleted) return false;
  return role.permissions.includes(key);
}

/** One entry point: `can(subject, 'beneficiaries.view')`. The scope comes from the catalog. */
export function can(subject: PermissionSubject, key: PermissionKey, scope?: PermissionScope): boolean {
  if (!isPermissionKey(key)) return false;
  const resolved = scope ?? permissionDef(key)?.scope;
  if (resolved === 'workspace') {
    return canWorkspace(subject.member, subject.workspaceRole, key as WorkspacePermission);
  }
  return canSystem(subject.user, subject.systemRole, key as SystemPermission);
}

/** Every key the subject holds in a workspace (admins hold all of them). */
export function workspaceKeys(
  member: MemberLike | null | undefined,
  role: RoleLike | null | undefined,
  all: readonly WorkspacePermission[],
): WorkspacePermission[] {
  return all.filter((key) => canWorkspace(member, role, key));
}

/**
 * Anti-escalation (rules: `hasAll`): a role can only be given, or composed, by someone who
 * already holds every key in it.
 */
export function canGrant(actorKeys: readonly string[], targetKeys: readonly string[]): boolean {
  const held = new Set(actorKeys);
  return targetKeys.every((key) => held.has(key));
}
