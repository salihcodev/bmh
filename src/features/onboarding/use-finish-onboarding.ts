import { router } from 'expo-router';
import { useCallback } from 'react';

import { markOnboardingSeen } from '@/config/onboarding';
import { isOnboardingComplete } from '@/domain/user';
import { useAuth } from '@/providers/auth-provider';

/** Marks onboarding done (once) and leaves it. Used by the workspace step, create and join. */
export function useFinishOnboarding() {
  const { profile, setOnboardingStep } = useAuth();
  return useCallback(
    async (to: string = '/') => {
      markOnboardingSeen();
      if (profile && !isOnboardingComplete(profile, false)) await setOnboardingStep('done');
      router.replace(to);
    },
    [profile, setOnboardingStep],
  );
}
