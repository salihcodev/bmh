import { describe, expect, it, vi } from 'vitest';

import { isOnboardingComplete, normalizeProfile, onboardingStep } from '@/domain/user';
import { pickActiveWorkspace } from '@/domain/workspace';
import { activeListenerCount, trackListener, unsubscribeAll } from '@/services/firebase/listener-registry';
import { canPlatform, isSuperAdmin } from '@/services/permissions/platform';
import { createMemoryStore } from '@/services/storage/kv';
import { clearUserKeys, userKey, type EnumerableStore } from '@/services/storage/user-scope';
import { createOutbox } from '@/services/sync/outbox';

function enumerable(initial: Record<string, string> = {}): EnumerableStore {
  const data = new Map(Object.entries(initial));
  const base = createMemoryStore();
  return {
    ...base,
    getString: (key) => data.get(key),
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    keys: () => [...data.keys()],
  };
}

describe('listener registry', () => {
  it('unsubscribes every tracked listener once', () => {
    const a = vi.fn();
    const b = vi.fn();
    const stopA = trackListener(a);
    trackListener(b);
    expect(activeListenerCount()).toBe(2);
    stopA();
    stopA();
    expect(a).toHaveBeenCalledTimes(1);
    expect(unsubscribeAll()).toBe(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(activeListenerCount()).toBe(0);
  });
});

describe('uid-scoped storage', () => {
  it('clears only the signed-out user keys', () => {
    const store = enumerable({
      [userKey('alice', 'lastWorkspaceId')]: 'wsA',
      [userKey('alice', 'draft')]: '{}',
      [userKey('bob', 'lastWorkspaceId')]: 'wsB',
      'preferences.v1': '{}',
    });
    expect(clearUserKeys(store, 'alice')).toBe(2);
    expect(store.keys().sort()).toEqual(['preferences.v1', userKey('bob', 'lastWorkspaceId')].sort());
  });
});

describe('outbox per user', () => {
  it('removes the signed-out user jobs and keeps anonymous ones', () => {
    const outbox = createOutbox({ store: createMemoryStore(), handlers: {} });
    outbox.enqueue('a', {}, 'k1', 'alice');
    outbox.enqueue('reset', { email: 'x' }, 'k2', null);
    outbox.enqueue('a', {}, 'k3', 'bob');
    expect(outbox.removeForUser('alice')).toBe(1);
    expect(outbox.list().map((job) => job.idempotencyKey)).toEqual(['k2', 'k3']);
  });
});

describe('persisted workspace validation', () => {
  it('never picks a workspace the user is not a member of', () => {
    const memberships = [{ workspaceId: 'wsB' }];
    expect(pickActiveWorkspace(memberships, 'wsA', 'wsA')?.workspaceId).toBe('wsB');
    expect(pickActiveWorkspace([], 'wsA', 'wsA')).toBeNull();
  });
});

describe('users v2 profile', () => {
  it('normalizes legacy profiles to safe defaults', () => {
    const profile = normalizeProfile('alice', { displayName: 'Alice', email: 'a@x.com' });
    expect(profile.globalRole).toBe('user');
    expect(profile.status).toBe('active');
    expect(profile.onboarding).toBeNull();
    expect(profile.schemaVersion).toBe(1);
  });

  it('treats unknown roles as user', () => {
    expect(normalizeProfile('x', { displayName: 'X', globalRole: 'god' }).globalRole).toBe('user');
    expect(normalizeProfile('x', { displayName: 'X', status: 'weird' }).status).toBe('active');
  });

  it('derives onboarding completion and the resume step', () => {
    const fresh = normalizeProfile('a', { displayName: 'A', onboarding: { step: 'workspace', completedAt: null } });
    expect(isOnboardingComplete(fresh, true)).toBe(false);
    expect(onboardingStep(fresh)).toBe('workspace');
    const done = normalizeProfile('a', { displayName: 'A', onboarding: { step: 'done', completedAt: 1 } });
    expect(isOnboardingComplete(done, false)).toBe(true);
    const legacy = normalizeProfile('a', { displayName: 'A' });
    expect(isOnboardingComplete(legacy, true)).toBe(true);
    expect(isOnboardingComplete(legacy, false)).toBe(false);
    expect(isOnboardingComplete(null, true)).toBe(false);
  });
});

describe('platform permissions', () => {
  it('only an active super admin has platform permissions', () => {
    expect(canPlatform({ globalRole: 'superadmin', status: 'active' }, 'platform_manage_media')).toBe(true);
    expect(canPlatform({ globalRole: 'superadmin', status: 'suspended' }, 'platform_manage_media')).toBe(false);
    expect(canPlatform({ globalRole: 'user', status: 'active' }, 'platform_manage_users')).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});
