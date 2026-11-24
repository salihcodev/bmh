import { router } from 'expo-router';
import { useCallback } from 'react';

import { markOnboardingSeen } from '@/config/onboarding';
import { isOnboardingComplete } from '@/domain/user';
import { useAuth } from '@/providers/auth-provider';

/**
 * Marks onboarding done (once) and hands over to the index route, where the route guard picks the
 * destination. Used by Skip, "later", create and join; screens never choose where to go next.
 */
export function useFinishOnboarding() {
  const { profile, setOnboardingStep } = useAuth();
  return useCallback(() => {
    markOnboardingSeen();
    // Applied to the local profile synchronously, so the guard already sees "done" on the next render.
    if (profile && !isOnboardingComplete(profile, false)) void setOnboardingStep('done');
    router.replace('/');
  }, [profile, setOnboardingStep]);
}
