import { z } from 'zod';

export const USER_SCHEMA_VERSION = 3;

/**
 * System users run the dashboard; platform users use the app. `owner` is both and only comes
 * from the seed. `custom` is a system user holding an owner-made system role.
 */
export const SYSTEM_USER_TYPES = ['owner', 'support', 'moderator', 'custom'] as const;
export const PLATFORM_USER_TYPES = ['member', 'supplier'] as const;
export const USER_TYPES = [...SYSTEM_USER_TYPES, ...PLATFORM_USER_TYPES] as const;
export type UserType = (typeof USER_TYPES)[number];

export const SUPPLIER_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export type UserStatus = 'active' | 'suspended';

export function isSystemUserType(type: UserType): boolean {
  return (SYSTEM_USER_TYPES as readonly string[]).includes(type);
}

export type Surface = 'app' | 'dashboard';

/**
 * Where sign-in lands (DASH-02). Owner and platform users open the app.
 * Support, moderator and custom system users open the dashboard.
 */
export function homeSurface(type: string | null | undefined): Surface {
  return type === 'support' || type === 'moderator' || type === 'custom' ? 'dashboard' : 'app';
}

/** Owner and moderator can open the app as well as the dashboard. Support and custom cannot. */
export function canEnterApp(type: string | null | undefined): boolean {
  return type !== 'support' && type !== 'custom';
}

/** Header switch (DASH-03). Moderator lands on the dashboard but may cross over. */
export function canSwitchSurfaces(type: string | null | undefined): boolean {
  return type === 'owner' || type === 'moderator';
}

/** Owner, moderator and platform users can open the app tabs. */
export function usesApp(type: UserType): boolean {
  return canEnterApp(type);
}

export const ONBOARDING_STEPS = ['intro', 'profile', 'workspace', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type Onboarding = { step: OnboardingStep; completedAt: unknown | null };

export type UserProfile = {
  id: string;
  displayName: string;
  email?: string;
  phone?: string | null;
  /** Cloudinary public ID of the profile photo; the URL is built on the device (cld 'avatar'). */
  avatarPublicId?: string | null;
  locale?: 'ar' | 'en';
  themePreference?: 'system' | 'light' | 'dark';
  userType: UserType;
  systemRoleId: string | null;
  supplierStatus: SupplierStatus;
  status: UserStatus;
  isDeleted: boolean;
  onboarding: Onboarding | null;
  lastWorkspaceId?: string | null;
  schemaVersion: number;
};

const rawProfileSchema = z.object({
  displayName: z.string().catch(''),
  email: z.string().optional().catch(undefined),
  phone: z.string().nullable().optional().catch(undefined),
  avatarPublicId: z.string().nullable().optional().catch(null),
  locale: z.enum(['ar', 'en']).optional().catch(undefined),
  themePreference: z.enum(['system', 'light', 'dark']).optional().catch(undefined),
  // Unknown or missing types never grant anything.
  userType: z.enum(USER_TYPES).catch('member'),
  systemRoleId: z.string().nullable().optional().catch(null),
  supplierStatus: z.enum(SUPPLIER_STATUSES).catch('none'),
  status: z.enum(['active', 'suspended']).catch('active'),
  isDeleted: z.boolean().catch(false),
  onboarding: z
    .object({ step: z.enum(ONBOARDING_STEPS).catch('intro'), completedAt: z.unknown().nullable().optional() })
    .nullable()
    .optional()
    .catch(null),
  lastWorkspaceId: z.string().nullable().optional().catch(null),
  schemaVersion: z.number().catch(1),
});

/** Normalizes a users/{uid} document into the v3 shape. */
export function normalizeProfile(id: string, data: unknown): UserProfile {
  const parsed = rawProfileSchema.parse(data ?? {});
  return {
    id,
    ...parsed,
    systemRoleId: parsed.systemRoleId ?? null,
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

/** Fields a user may change on their own profile (mirrors the users rule). */
export type ProfilePatch = Partial<
  Pick<UserProfile, 'displayName' | 'phone' | 'avatarPublicId' | 'locale' | 'themePreference' | 'onboarding' | 'lastWorkspaceId'>
>;

/** The profile as it will be once `patch` is written. Used to show a write before its snapshot arrives. */
export function applyProfilePatch(profile: UserProfile, patch: ProfilePatch): UserProfile {
  const next: UserProfile = { ...profile };
  for (const [key, value] of Object.entries(patch) as [keyof ProfilePatch, unknown][]) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

/**
 * True once a snapshot already shows `patch`. Onboarding is compared by step and by whether it is
 * completed, because `completedAt` is a server timestamp on the snapshot and a local value in the patch.
 */
export function profileShowsPatch(profile: UserProfile, patch: ProfilePatch): boolean {
  return (Object.entries(patch) as [keyof ProfilePatch, unknown][]).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'onboarding') {
      const want = value as Onboarding | null;
      const have = profile.onboarding;
      if (!want || !have) return want === have;
      return want.step === have.step && (want.completedAt == null) === (have.completedAt == null);
    }
    return profile[key] === value;
  });
}
