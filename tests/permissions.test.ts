import { describe, expect, it } from 'vitest';

import { permissionGate } from '@/domain/permission-gate';
import { can, canGrant, canWorkspace, workspaceKeys } from '@/services/permissions/can';
import {
  assignableKeys,
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PRESET_SEEDS,
  sanitizeKeys,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_SEEDS,
  WORKSPACE_PERMISSIONS,
  WORKSPACE_ROLE_SEEDS,
} from '@/services/permissions/catalog';

describe('permission catalog', () => {
  it('has 129 unique keys: 92 system and 37 workspace', () => {
    expect(PERMISSION_KEYS).toHaveLength(129);
    expect(new Set(PERMISSION_KEYS).size).toBe(129);
    expect(SYSTEM_PERMISSIONS).toHaveLength(92);
    expect(WORKSPACE_PERMISSIONS).toHaveLength(37);
  });

  it('every key is <entity>.<action>, bilingual, and in a group of its own scope', () => {
    const groups = new Map(PERMISSION_GROUPS.map((g) => [g.id, g.scope]));
    for (const def of PERMISSION_CATALOG) {
      expect(def.key).toMatch(/^[a-z-]+\.[a-z-]+$/);
      expect(def.label.en && def.label.ar && def.description.en && def.description.ar).toBeTruthy();
      expect([def.scope, 'mixed']).toContain(groups.get(def.group));
    }
  });

  it('roles can never hold baseline keys', () => {
    const baseline = PERMISSION_CATALOG.filter((d) => d.baseline).map((d) => d.key);
    expect(baseline).toHaveLength(3);
    expect(sanitizeKeys(baseline, 'system')).toEqual([]);
    expect(assignableKeys('system').some((k) => baseline.includes(k))).toBe(false);
  });

  it('sanitizeKeys drops unknown and other-scope keys', () => {
    expect(sanitizeKeys(['users.view', 'beneficiaries.view', 'nope.nope'], 'system')).toEqual(['users.view']);
  });

  it('seeded roles and presets only use keys of their scope', () => {
    const scoped = (keys: readonly string[], scope: 'system' | 'workspace') =>
      keys.every((k) => PERMISSION_CATALOG.find((d) => d.key === k)?.scope === scope);
    for (const role of SYSTEM_ROLE_SEEDS) expect(scoped(role.permissions, 'system')).toBe(true);
    for (const role of WORKSPACE_ROLE_SEEDS) expect(scoped(role.permissions, 'workspace')).toBe(true);
    for (const preset of PRESET_SEEDS) expect(scoped(preset.permissions, preset.scope)).toBe(true);
    expect(WORKSPACE_ROLE_SEEDS.find((r) => r.id === 'admin')?.permissions).toHaveLength(37);
  });
});

describe('can()', () => {
  const member = { roleId: 'field', status: 'active' as const };
  const role = { permissions: ['beneficiaries.view', 'sessions.view'] };

  it('workspace keys come from the member role doc', () => {
    expect(can({ member, workspaceRole: role }, 'beneficiaries.view')).toBe(true);
    expect(can({ member, workspaceRole: role }, 'beneficiaries.edit')).toBe(false);
    expect(can({ member, workspaceRole: { ...role, isDeleted: true } }, 'beneficiaries.view')).toBe(false);
    expect(can({ member: { ...member, status: 'disabled' }, workspaceRole: role }, 'beneficiaries.view')).toBe(false);
  });

  it('the admin role holds every workspace key without a role doc', () => {
    const admin = { roleId: 'admin', status: 'active' as const };
    expect(canWorkspace(admin, null, 'workspace.delete')).toBe(true);
    expect(workspaceKeys(admin, null, WORKSPACE_PERMISSIONS)).toHaveLength(37);
  });

  it('a workspace role never grants system keys, and unknown keys are denied', () => {
    expect(can({ member, workspaceRole: { permissions: ['users.view'] } }, 'users.view')).toBe(false);
    expect(can({ member, workspaceRole: role }, 'nope.nope' as never)).toBe(false);
  });
});

describe('anti-escalation', () => {
  it('only grants a role whose keys the actor already holds', () => {
    expect(canGrant(['a.view', 'a.edit'], ['a.view'])).toBe(true);
    expect(canGrant(['a.view'], ['a.view', 'a.edit'])).toBe(false);
    expect(canGrant([], [])).toBe(true);
  });
});

describe('permissionGate', () => {
  it('waits while roles load, then allows or redirects', () => {
    expect(permissionGate({ loading: true, allowed: false })).toBe('loading');
    expect(permissionGate({ loading: false, allowed: false })).toBe('redirect');
    expect(permissionGate({ loading: true, allowed: true })).toBe('allow');
  });
});
