/**
 * Active workspace: the device preference, else the one saved on the user
 * profile (new device), else the first membership. A stale id (left or removed
 * workspace) falls through to the next option.
 */
export function pickActiveWorkspace<T extends { workspaceId: string }>(
  memberships: T[],
  devicePreference: string | null | undefined,
  profilePreference?: string | null,
): T | null {
  const find = (id: string | null | undefined) => (id ? memberships.find((m) => m.workspaceId === id) : undefined);
  return find(devicePreference) ?? find(profilePreference) ?? memberships[0] ?? null;
}
