import { describe, expect, it } from 'vitest';

import { resolveRoute, type GuardInput } from '@/domain/route-guard';

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

  it('shows onboarding once per session when the every-sign-in flag is on', () => {
    const done = { status: 'active' as const, onboarding: { step: 'done' as const, completedAt: 1 } };
    expect(route({ profile: done, everySignIn: true })).toEqual({ kind: 'onboarding', step: 'intro' });
    expect(route({ profile: done, everySignIn: true, seenThisSession: true })).toEqual({ kind: 'app' });
  });
});
