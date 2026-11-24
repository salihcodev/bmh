import { describe, expect, it } from 'vitest';

import { resolveRoute, routeFor, type GuardInput } from '@/domain/route-guard';
import { applyProfilePatch, normalizeProfile, profileShowsPatch } from '@/domain/user';

const base: GuardInput = {
  authLoading: false,
  signedIn: true,
  profileReady: true,
  profile: { status: 'active', onboarding: { step: 'intro', completedAt: null } },
  membershipsLoading: false,
  hasMembership: false,
  everySignIn: false,
  seenThisSession: false,
};
const route = (patch: Partial<GuardInput>) => resolveRoute({ ...base, ...patch });

describe('route guard', () => {
  it('waits for auth', () => {
    expect(route({ authLoading: true })).toEqual({ kind: 'loading' });
  });

  it('sends signed-out users to sign in', () => {
    expect(route({ signedIn: false, profile: null })).toEqual({ kind: 'signedOut' });
  });

  it('waits until the profile document is known', () => {
    expect(route({ profileReady: false })).toEqual({ kind: 'loading' });
  });

  it('starts onboarding at the intro when there is no profile yet', () => {
    expect(route({ profile: null })).toEqual({ kind: 'onboarding', step: 'intro' });
  });

  it('blocks suspended users before anything else', () => {
    expect(route({ profile: { status: 'suspended', onboarding: { step: 'done', completedAt: 1 } } })).toEqual({
      kind: 'suspended',
    });
  });

  it('resumes onboarding at the saved step', () => {
    expect(route({ profile: { status: 'active', onboarding: { step: 'workspace', completedAt: null } } })).toEqual({
      kind: 'onboarding',
      step: 'workspace',
    });
  });

  it('opens the app once onboarding is completed, with or without a workspace', () => {
    const done = { status: 'active' as const, onboarding: { step: 'done' as const, completedAt: 1 } };
    expect(route({ profile: done })).toEqual({ kind: 'app' });
    expect(route({ profile: done, hasMembership: true })).toEqual({ kind: 'app' });
  });

  it('treats legacy profiles with a membership as onboarded, after memberships load', () => {
    const legacy = { status: 'active' as const, onboarding: null };
    expect(route({ profile: legacy, membershipsLoading: true })).toEqual({ kind: 'loading' });
    expect(route({ profile: legacy, hasMembership: true })).toEqual({ kind: 'app' });
    expect(route({ profile: legacy, hasMembership: false })).toEqual({ kind: 'onboarding', step: 'intro' });
  });

  // FIX-01: Skip/Finish used to need two taps because the guard still saw the old step.
  it('opens the app as soon as the step is set to done, before the server stamps completedAt', () => {
    const justDone = { status: 'active' as const, onboarding: { step: 'done' as const, completedAt: null } };
    expect(route({ profile: justDone })).toEqual({ kind: 'app' });
  });

  it('opens the app from the optimistic profile while the snapshot still shows the workspace step', () => {
    const snapshot = normalizeProfile('u1', { displayName: 'A', onboarding: { step: 'workspace', completedAt: null } });
    const optimistic = applyProfilePatch(snapshot, { onboarding: { step: 'done', completedAt: Date.now() } });
    expect(route({ profile: snapshot })).toEqual({ kind: 'onboarding', step: 'workspace' });
    expect(route({ profile: optimistic })).toEqual({ kind: 'app' });
  });

  it('resumes at the saved step after sign-out or a restart (state lives on users/{uid})', () => {
    for (const step of ['intro', 'profile', 'workspace'] as const) {
      const saved = normalizeProfile('u1', { displayName: 'A', onboarding: { step, completedAt: null } });
      expect(route({ profile: saved })).toEqual({ kind: 'onboarding', step });
    }
  });

  it('sends every new account through onboarding, whatever its memberships', () => {
    const fresh = normalizeProfile('u1', { displayName: 'A', onboarding: { step: 'intro', completedAt: null } });
    expect(route({ profile: fresh, hasMembership: true })).toEqual({ kind: 'onboarding', step: 'intro' });
  });

  it('lands staff on the dashboard and the owner on the app', () => {
    const done = { status: 'active' as const, onboarding: { step: 'done' as const, completedAt: 1 } };
    expect(route({ profile: { ...done, userType: 'owner' } })).toEqual({ kind: 'app' });
    expect(route({ profile: { ...done, userType: 'member' } })).toEqual({ kind: 'app' });
    expect(route({ profile: { ...done, userType: 'supplier' } })).toEqual({ kind: 'app' });
    expect(route({ profile: { ...done, userType: 'support' } })).toEqual({ kind: 'dashboard' });
    expect(route({ profile: { ...done, userType: 'moderator' } })).toEqual({ kind: 'dashboard' });
    expect(route({ profile: { ...done, userType: 'custom' } })).toEqual({ kind: 'dashboard' });
    expect(routeFor({ kind: 'dashboard' })).toBe('/(dashboard)');
    expect(routeFor({ kind: 'app' })).toBe('/(app)');
  });

  it('shows onboarding once per session when the every-sign-in flag is on', () => {
    const done = { status: 'active' as const, onboarding: { step: 'done' as const, completedAt: 1 } };
    expect(route({ profile: done, everySignIn: true })).toEqual({ kind: 'onboarding', step: 'intro' });
    expect(route({ profile: done, everySignIn: true, seenThisSession: true })).toEqual({ kind: 'app' });
  });
});

describe('optimistic profile patch', () => {
  const profile = normalizeProfile('u1', { displayName: 'Old', onboarding: { step: 'workspace', completedAt: null } });

  it('applies only the fields that are set', () => {
    const next = applyProfilePatch(profile, { displayName: 'New', locale: undefined });
    expect(next.displayName).toBe('New');
    expect(next.locale).toBe(profile.locale);
    expect(profile.displayName).toBe('Old');
  });

  it('is kept while the snapshot does not show the write yet', () => {
    const patch = { onboarding: { step: 'done' as const, completedAt: 123 } };
    expect(profileShowsPatch(profile, patch)).toBe(false);
    // A pending serverTimestamp reads as null in local snapshots.
    const pending = normalizeProfile('u1', { displayName: 'Old', onboarding: { step: 'done', completedAt: null } });
    expect(profileShowsPatch(pending, patch)).toBe(false);
  });

  it('is dropped once the snapshot shows the write, whatever the timestamp value', () => {
    const confirmed = normalizeProfile('u1', { displayName: 'Old', onboarding: { step: 'done', completedAt: { seconds: 9 } } });
    expect(profileShowsPatch(confirmed, { onboarding: { step: 'done', completedAt: 123 } })).toBe(true);
    expect(profileShowsPatch(confirmed, { displayName: 'Old' })).toBe(true);
    expect(profileShowsPatch(confirmed, { displayName: 'New' })).toBe(false);
  });
});
