import { ONBOARDING_EVERY_SIGN_IN, onboardingSeenThisSession } from '@/config/onboarding';
import { resolveRoute, type GuardResult } from '@/domain/route-guard';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';

/** The single routing decision used by the index route and every group layout. */
export function useRouteGuard(): GuardResult {
  const { user, profile, loading, profileReady } = useAuth();
  const { loading: membershipsLoading, memberships } = useWorkspace();
  return resolveRoute({
    authLoading: loading,
    signedIn: !!user,
    profileReady,
    profile,
    membershipsLoading,
    hasMembership: memberships.length > 0,
    everySignIn: ONBOARDING_EVERY_SIGN_IN,
    seenThisSession: onboardingSeenThisSession(),
  });
}
