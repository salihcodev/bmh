import { describe, expect, it } from 'vitest';

import {
  bilingualName,
  userMatchesBrowse,
  userQueryMode,
  userTypeForRole,
  validateStaffDraft,
  type UserBrowse,
} from '@/domain/dashboard';
import { canEnterApp, canSwitchSurfaces, homeSurface } from '@/domain/user';
import { rememberSurface, resetSurfaceMemory, surfaceTarget } from '@/services/navigation/surface-memory';

const browse = (patch: Partial<UserBrowse> = {}): UserBrowse => ({
  type: 'all',
  status: 'any',
  search: '',
  showDeleted: false,
  ...patch,
});

const person = {
  userType: 'member',
  status: 'active',
  isDeleted: false,
  displayName: 'Nada Adel',
  email: 'nada@example.com',
};

describe('dashboard surfaces', () => {
  it('sends support, moderator and custom to the dashboard', () => {
    expect(homeSurface('owner')).toBe('app');
    expect(homeSurface('member')).toBe('app');
    expect(homeSurface('supplier')).toBe('app');
    expect(homeSurface('support')).toBe('dashboard');
    expect(homeSurface('moderator')).toBe('dashboard');
    expect(homeSurface('custom')).toBe('dashboard');
  });

  it('lets only the owner and the moderator cross between the app and the dashboard', () => {
    expect(canSwitchSurfaces('owner')).toBe(true);
    expect(canSwitchSurfaces('moderator')).toBe(true);
    expect(canSwitchSurfaces('support')).toBe(false);
    expect(canSwitchSurfaces('custom')).toBe(false);
    expect(canEnterApp('moderator')).toBe(true);
    expect(canEnterApp('support')).toBe(false);
    expect(canEnterApp('custom')).toBe(false);
    expect(canEnterApp('member')).toBe(true);
  });

  it('reopens the last dashboard path, and the app side always opens on Home', () => {
    resetSurfaceMemory();
    expect(surfaceTarget('app')).toBe('/dashboard');
    rememberSurface('dashboard', '/dashboard/users');
    rememberSurface('app', '/settings');
    expect(surfaceTarget('app')).toBe('/dashboard/users');
    expect(surfaceTarget('dashboard')).toBe('/(app)');
  });

  it('never sends the app side to the root redirect gate', () => {
    resetSurfaceMemory();
    rememberSurface('app', '/');
    expect(surfaceTarget('dashboard')).toBe('/(app)');
  });
});

describe('dashboard user browse', () => {
  it('uses one query constraint and filters the rest on the loaded page', () => {
    expect(userQueryMode(browse())).toEqual({ kind: 'all' });
    expect(userQueryMode(browse({ status: 'suspended' }))).toEqual({ kind: 'status', status: 'suspended' });
    expect(userQueryMode(browse({ type: 'support' }))).toEqual({ kind: 'types', values: ['support'] });
    expect(userQueryMode(browse({ type: 'system', status: 'suspended' })).kind).toBe('types');
    expect(userQueryMode(browse({ search: 'nada@example.com', type: 'member' }))).toEqual({
      kind: 'email',
      email: 'nada@example.com',
    });
  });

  it('matches type, status, deletion and a name fragment', () => {
    expect(userMatchesBrowse(person, browse({ search: 'adel' }))).toBe(true);
    expect(userMatchesBrowse(person, browse({ type: 'platform' }))).toBe(true);
    expect(userMatchesBrowse(person, browse({ type: 'system' }))).toBe(false);
    expect(userMatchesBrowse(person, browse({ status: 'suspended' }))).toBe(false);
    expect(userMatchesBrowse({ ...person, isDeleted: true }, browse())).toBe(false);
    expect(userMatchesBrowse({ ...person, isDeleted: true }, browse({ showDeleted: true }))).toBe(true);
  });
});

describe('staff drafts', () => {
  const draft = {
    displayName: 'Salma',
    email: 'salma@example.com',
    password: 'secret1',
    userType: 'custom' as const,
    systemRoleId: 'field-desk',
  };

  it('accepts a complete staff draft and maps seeded role ids', () => {
    expect(validateStaffDraft(draft)).toBeNull();
    expect(userTypeForRole('support')).toBe('support');
    expect(userTypeForRole('moderator')).toBe('moderator');
    expect(userTypeForRole('field-desk')).toBe('custom');
    expect(validateStaffDraft({ ...draft, systemRoleId: 'owner' })).toBe('role');
    expect(validateStaffDraft({ ...draft, password: 'short' })).toBe('password');
    expect(bilingualName('  دعم ', ' Support ')).toEqual({ ar: 'دعم', en: 'Support' });
    expect(bilingualName('', 'Support')).toBeNull();
  });
});
