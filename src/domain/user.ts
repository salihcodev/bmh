import { z } from 'zod';

export const USER_SCHEMA_VERSION = 2;

export const GLOBAL_ROLES = ['user', 'superadmin'] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export type UserStatus = 'active' | 'suspended';

export const ONBOARDING_STEPS = ['intro', 'profile', 'workspace', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type Onboarding = { step: OnboardingStep; completedAt: unknown | null };

export type UserProfile = {
  id: string;
  displayName: string;
  email?: string;
  phone?: string | null;
  locale?: 'ar' | 'en';
  themePreference?: 'system' | 'light' | 'dark';
  globalRole: GlobalRole;
  status: UserStatus;
  onboarding: Onboarding | null;
  lastWorkspaceId?: string | null;
  schemaVersion: number;
};

const rawProfileSchema = z.object({
  displayName: z.string().catch(''),
  email: z.string().optional().catch(undefined),
  phone: z.string().nullable().optional().catch(undefined),
  locale: z.enum(['ar', 'en']).optional().catch(undefined),
  themePreference: z.enum(['system', 'light', 'dark']).optional().catch(undefined),
  // Unknown or missing roles never grant anything.
  globalRole: z.enum(GLOBAL_ROLES).catch('user'),
  status: z.enum(['active', 'suspended']).catch('active'),
  onboarding: z
    .object({ step: z.enum(ONBOARDING_STEPS).catch('intro'), completedAt: z.unknown().nullable().optional() })
    .nullable()
    .optional()
    .catch(null),
  lastWorkspaceId: z.string().nullable().optional().catch(null),
  schemaVersion: z.number().catch(1),
});

/** Normalizes a users/{uid} document of any schema version into the v2 shape. */
export function normalizeProfile(id: string, data: unknown): UserProfile {
  const parsed = rawProfileSchema.parse(data ?? {});
  return {
    id,
    ...parsed,
    onboarding: parsed.onboarding ? { step: parsed.onboarding.step, completedAt: parsed.onboarding.completedAt ?? null } : null,
  };
}

/**
 * Onboarding is complete when `completedAt` is set. Profiles created before onboarding
 * existed (no `onboarding` field) count as complete once the user has a workspace.
 */
export function isOnboardingComplete(profile: Pick<UserProfile, 'onboarding'> | null, hasMembership: boolean): boolean {
  if (!profile) return false;
  if (!profile.onboarding) return hasMembership;
  return profile.onboarding.completedAt != null || profile.onboarding.step === 'done';
}

export function onboardingStep(profile: Pick<UserProfile, 'onboarding'> | null): OnboardingStep {
  return profile?.onboarding?.step ?? 'intro';
}
