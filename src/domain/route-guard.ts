import { homeSurface, isOnboardingComplete, onboardingStep, type OnboardingStep, type UserProfile } from './user';

export type GuardInput = {
  authLoading: boolean;
  signedIn: boolean;
  /** We know whether users/{uid} exists. */
  profileReady: boolean;
  profile: (Pick<UserProfile, 'status' | 'onboarding'> & { userType?: UserProfile['userType'] }) | null;
  membershipsLoading: boolean;
  hasMembership: boolean;
  everySignIn: boolean;
  seenThisSession: boolean;
};

export type GuardResult =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'suspended' }
  | { kind: 'onboarding'; step: Exclude<OnboardingStep, 'done'> }
  | { kind: 'app' }
  | { kind: 'dashboard' };

/** App for owner and platform users; dashboard for support, moderator and custom (DASH-02). */
function homeKind(profile: GuardInput['profile']): GuardResult {
  return homeSurface(profile?.userType) === 'dashboard' ? { kind: 'dashboard' } : { kind: 'app' };
}

/**
 * Where a user belongs, in order: signed out, suspended, onboarding, app.
 * A user without a profile document (phone sign-in) starts at the intro and creates it on the profile step.
 */
export function resolveRoute(input: GuardInput): GuardResult {
  if (input.authLoading) return { kind: 'loading' };
  if (!input.signedIn) return { kind: 'signedOut' };
  if (!input.profileReady) return { kind: 'loading' };
  if (!input.profile) return { kind: 'onboarding', step: 'intro' };
  if (input.profile.status === 'suspended') return { kind: 'suspended' };
  // Legacy profiles (no onboarding field) are judged by membership, so wait for it.
  if (!input.profile.onboarding && input.membershipsLoading) return { kind: 'loading' };
  if (input.everySignIn && !input.seenThisSession) return { kind: 'onboarding', step: 'intro' };
  if (isOnboardingComplete(input.profile, input.hasMembership)) return homeKind(input.profile);
  const step = onboardingStep(input.profile);
  return { kind: 'onboarding', step: step === 'done' ? 'workspace' : step };
}

export function routeFor(result: GuardResult): string | null {
  switch (result.kind) {
    case 'loading':
      return null;
    case 'signedOut':
      return '/(auth)/login';
    case 'suspended':
      return '/suspended';
    case 'onboarding':
      return '/onboarding';
    case 'app':
      return '/(app)';
    case 'dashboard':
      return '/(dashboard)';
  }
}
