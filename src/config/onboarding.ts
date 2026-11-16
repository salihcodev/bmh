/**
 * Show onboarding on every sign-in instead of only until it is completed once.
 * Product decision (docs/open-product-decisions.md); keep false unless the product asks for it.
 */
export const ONBOARDING_EVERY_SIGN_IN = false;

let seenThisSession = false;

/** Marks onboarding as shown in this app session (used only when ONBOARDING_EVERY_SIGN_IN is on). */
export function markOnboardingSeen() {
  seenThisSession = true;
}

export function onboardingSeenThisSession() {
  return seenThisSession;
}
