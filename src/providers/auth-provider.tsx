import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  updateProfile,
  type AuthCredential,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { reloadAppAsync } from 'expo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { SystemRole } from '@/domain/types';
import {
  applyProfilePatch,
  normalizeProfile,
  profileShowsPatch,
  USER_SCHEMA_VERSION,
  type OnboardingStep,
  type ProfilePatch,
  type UserProfile,
} from '@/domain/user';
import { emitActionFeedback } from '@/lib/action-feedback';
import { i18n } from '@/localization';
import { GoogleLinkRequired } from '@/services/firebase/auth-errors';
import { auth, db } from '@/services/firebase/client';
import { requestGoogleIdToken } from '@/services/firebase/google';
import { onSnapshot } from '@/services/firebase/listeners';
import { checkPendingWrites, isResetting, purgeDeviceData, resetSession } from '@/services/session/reset';
import { showSplashOverlay } from '@/services/session/splash-overlay';
import { appStorage } from '@/services/storage/mmkv';
import { LAST_UID_KEY } from '@/services/storage/user-scope';
import { checkOnline } from '@/services/sync/connectivity';
import { OUTBOX_JOBS, outbox } from '@/services/sync/outbox-runtime';

export type { ProfilePatch, UserProfile } from '@/domain/user';

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  /** True until Firebase reports the first auth state. */
  loading: boolean;
  /** True once we know whether `users/{uid}` exists. */
  profileReady: boolean;
  /** The user's system role (`systemRoles/{systemRoleId}`); null for platform users and the owner. */
  systemRole: SystemRole | null;
  /** True while the system role doc of a staff account is loading. */
  systemRoleLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  /** Returns 'queued' when offline: the outbox sends it on reconnect. */
  resetPassword: (email: string) => Promise<'sent' | 'queued'>;
  signInWithGoogle: () => Promise<void>;
  linkGoogleToPassword: (email: string, password: string, credential: AuthCredential) => Promise<void>;
  sendPhoneCode: (e164: string) => Promise<ConfirmationResult>;
  confirmPhoneCode: (confirmation: ConfirmationResult, code: string) => Promise<void>;
  /** Creates `users/{uid}` after phone sign-in, when the account has no name yet. */
  saveProfile: (displayName: string) => Promise<void>;
  updateProfileFields: (patch: ProfilePatch) => Promise<void>;
  /** Saves the onboarding step on users/{uid}; 'done' also stamps completedAt. */
  setOnboardingStep: (step: OnboardingStep) => Promise<void>;
  /**
   * Returns 'pending' (and does nothing) when unsynced writes exist and `force` is not set,
   * so the caller can warn that signing out discards them.
   */
  signOutUser: (options?: { force?: boolean }) => Promise<'pending' | 'signed-out'>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const CACHE_VERSION_KEY = 'session.cacheVersion';

function profileData(user: User, displayName: string, emailOverride?: string) {
  const email = (emailOverride || user.email || '').trim().toLowerCase();
  const data: Record<string, unknown> = {
    displayName: displayName.trim().slice(0, 80),
    locale: i18n.language === 'en' ? 'en' : 'ar',
    userType: 'member',
    supplierStatus: 'none',
    status: 'active',
    isDeleted: false,
    onboarding: { step: 'intro', completedAt: null },
    schemaVersion: USER_SCHEMA_VERSION,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (email) data.email = email;
  if (user.phoneNumber) data.phone = user.phoneNumber;
  return data;
}

function nameFor(user: User, pendingName?: string) {
  const pending = pendingName?.trim();
  if (pending) return pending;
  const fromAccount = user.displayName?.trim();
  if (fromAccount) return fromAccount;
  const fromEmail = user.email?.split('@')[0]?.trim();
  return fromEmail || '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const pendingProfile = useRef<{ displayName: string; email: string } | null>(null);
  // Set just before a sign-in that should create users/{uid} if it is missing.
  const expectNewProfile = useRef(false);
  const ensuredFor = useRef<string | null>(null);
  // Profile writes not yet visible in a snapshot. The route guard reads `profile`, so a write such as
  // "onboarding done" must show at once or the guard sends the user back for a second tap.
  const pendingPatch = useRef<ProfilePatch | null>(null);
  const snapshotProfile = useRef<UserProfile | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        // The cache may still hold another account's documents if the previous session
        // ended without resetSession (revoked token, crash). Purge before showing anything.
        const lastUid = appStorage.getString(LAST_UID_KEY) ?? null;
        const accountChanged = lastUid !== null && lastUid !== (nextUser?.uid ?? null);
        // Builds before v2 never cleared the cache on sign-out: purge once if nobody is signed in.
        const legacyCache = appStorage.getString(CACHE_VERSION_KEY) !== '2';
        appStorage.set(CACHE_VERSION_KEY, '2');
        if (legacyCache && !nextUser) {
          void showSplashOverlay()
            .then(() => purgeDeviceData(null))
            .then(() => reloadAppAsync('legacy-cache'));
          return;
        }
        if (accountChanged && !isResetting()) {
          void showSplashOverlay()
            .then(() => purgeDeviceData(lastUid))
            .then(() => {
              if (nextUser) appStorage.set(LAST_UID_KEY, nextUser.uid);
              return reloadAppAsync('account-changed');
            });
          return;
        }
        if (nextUser) appStorage.set(LAST_UID_KEY, nextUser.uid);
        setUser(nextUser);
        if (!nextUser) {
          setProfile(null);
          setProfileReady(false);
          pendingPatch.current = null;
          snapshotProfile.current = null;
          pendingProfile.current = null;
          expectNewProfile.current = false;
          ensuredFor.current = null;
        }
        setLoading(false);
      }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let active = true;
    return onSnapshot(doc(db, 'users', uid), (snapshot) => {
      if (!active || !snapshot) return;
      if (snapshot.exists()) {
        const next = normalizeProfile(snapshot.id, snapshot.data());
        snapshotProfile.current = next;
        const patch = pendingPatch.current;
        if (patch && profileShowsPatch(next, patch)) pendingPatch.current = null;
        setProfile(pendingPatch.current ? applyProfilePatch(next, pendingPatch.current) : next);
        setProfileReady(true);
        expectNewProfile.current = false;
        return;
      }

      const pending = pendingProfile.current;
      const shouldCreate = expectNewProfile.current || pending !== null;
      // An empty cache is not proof the profile is missing. Wait for the server
      // unless this session just registered or used Google/phone.
      if (!shouldCreate) {
        if (!snapshot.metadata.fromCache) {
          setProfile(null);
          setProfileReady(true);
        }
        return;
      }
      if (ensuredFor.current === uid) return;

      const current = auth.currentUser ?? user;
      const displayName = nameFor(current, pending?.displayName);
      if (!displayName) {
        setProfile(null);
        setProfileReady(true);
        return;
      }

      ensuredFor.current = uid;
      pendingProfile.current = null;
      expectNewProfile.current = false;
      void setDoc(doc(db, 'users', uid), profileData(current, displayName, pending?.email)).catch(() => {
        if (!active) return;
        ensuredFor.current = null;
        setProfile(null);
        setProfileReady(true);
      });
    });
  }, [user]);

  const systemRoleId = profile?.status === 'active' ? profile.systemRoleId : null;
  const [systemRoleState, setSystemRoleState] = useState<{ id: string; role: SystemRole | null } | null>(null);
  useEffect(() => {
    if (!systemRoleId) return;
    return onSnapshot(
      doc(db, 'systemRoles', systemRoleId),
      (snapshot) => {
        const role = snapshot?.exists() ? ({ id: systemRoleId, ...snapshot.data() } as SystemRole) : null;
        setSystemRoleState({ id: systemRoleId, role });
      },
      () => setSystemRoleState({ id: systemRoleId, role: null }),
    );
  }, [systemRoleId]);
  const systemRole = systemRoleId && systemRoleState?.id === systemRoleId ? systemRoleState.role : null;
  const systemRoleLoading = !!systemRoleId && systemRoleState?.id !== systemRoleId;

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    emitActionFeedback({ message: i18n.t('auth.signedIn'), kind: 'success' });
  }, []);

  // The profile doc is written by the auth listener from `pendingProfile`, so a
  // missing-doc snapshot during createUser cannot flash the name screen.
  const register = useCallback(
    async ({ email, password, displayName }: { email: string; password: string; displayName: string }) => {
      pendingProfile.current = { displayName: displayName.trim(), email: email.trim().toLowerCase() };
      expectNewProfile.current = true;
      try {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: displayName.trim() });
      } catch (error) {
        pendingProfile.current = null;
        expectNewProfile.current = false;
        throw error;
      }
    },
    [],
  );

  const resetPassword = useCallback(async (email: string): Promise<'sent' | 'queued'> => {
    const normalized = email.trim().toLowerCase();
    if (!(await checkOnline())) {
      outbox.enqueue(OUTBOX_JOBS.passwordReset, { email: normalized }, `password_reset:${normalized}`);
      return 'queued';
    }
    await sendPasswordResetEmail(auth, normalized);
    return 'sent';
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { idToken, email } = await requestGoogleIdToken();
    const credential = GoogleAuthProvider.credential(idToken);
    expectNewProfile.current = true;
    try {
      await signInWithCredential(auth, credential);
      emitActionFeedback({ message: i18n.t('auth.signedIn'), kind: 'success' });
    } catch (error) {
      expectNewProfile.current = false;
      if ((error as { code?: string })?.code === 'auth/account-exists-with-different-credential') {
        throw new GoogleLinkRequired(email, credential);
      }
      throw error;
    }
  }, []);

  const linkGoogleToPassword = useCallback(async (email: string, password: string, credential: AuthCredential) => {
    const signedIn = await signInWithEmailAndPassword(auth, email.trim(), password);
    await linkWithCredential(signedIn.user, credential);
    emitActionFeedback({ message: i18n.t('auth.googleLinked'), kind: 'success' });
  }, []);

  const sendPhoneCode = useCallback(async (e164: string) => {
    return signInWithPhoneNumber(auth, e164);
  }, []);

  const confirmPhoneCode = useCallback(async (confirmation: ConfirmationResult, code: string) => {
    expectNewProfile.current = true;
    try {
      const credential = await confirmation.confirm(code);
      if (!credential?.user) throw Object.assign(new Error('auth/invalid-verification-code'), { code: 'auth/invalid-verification-code' });
      emitActionFeedback({ message: i18n.t('auth.signedIn'), kind: 'success' });
    } catch (error) {
      expectNewProfile.current = false;
      throw error;
    }
  }, []);

  const saveProfile = useCallback(async (displayName: string) => {
    const current = auth.currentUser;
    if (!current) throw Object.assign(new Error('unauthenticated'), { code: 'unauthenticated' });
    const name = displayName.trim();
    await setDoc(doc(db, 'users', current.uid), profileData(current, name));
    await updateProfile(current, { displayName: name });
  }, []);

  const updateProfileFields = useCallback(async (patch: ProfilePatch) => {
    const current = auth.currentUser;
    if (!current) throw Object.assign(new Error('unauthenticated'), { code: 'unauthenticated' });
    const local: ProfilePatch = { ...patch };
    if (patch.displayName !== undefined) local.displayName = patch.displayName.trim().slice(0, 80);
    pendingPatch.current = { ...pendingPatch.current, ...local };
    setProfile((prev) => (prev ? applyProfilePatch(prev, local) : prev));

    const data: Record<string, unknown> = { ...local, updatedAt: serverTimestamp() };
    if (patch.onboarding?.completedAt != null) data.onboarding = { ...patch.onboarding, completedAt: serverTimestamp() };
    // Fire-and-forget: Firestore queues it offline. A rejected write drops the local copy.
    void updateDoc(doc(db, 'users', current.uid), data).catch(() => {
      pendingPatch.current = null;
      setProfile(snapshotProfile.current);
    });
    if (patch.displayName) await updateProfile(current, { displayName: patch.displayName.trim() }).catch(() => undefined);
  }, []);

  // `completedAt` here is only the local marker; updateProfileFields writes a server timestamp.
  const setOnboardingStep = useCallback(
    (step: OnboardingStep) => updateProfileFields({ onboarding: { step, completedAt: step === 'done' ? Date.now() : null } }),
    [updateProfileFields],
  );

  const signOutUser = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force && (await checkPendingWrites()) === 'pending') return 'pending' as const;
    emitActionFeedback({ message: i18n.t('auth.signedOut'), kind: 'success' });
    await resetSession();
    return 'signed-out' as const;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileReady,
      systemRole,
      systemRoleLoading,
      signIn,
      register,
      resetPassword,
      signInWithGoogle,
      linkGoogleToPassword,
      sendPhoneCode,
      confirmPhoneCode,
      saveProfile,
      updateProfileFields,
      setOnboardingStep,
      signOutUser,
    }),
    [
      updateProfileFields,
      setOnboardingStep,
      user,
      profile,
      loading,
      profileReady,
      systemRole,
      systemRoleLoading,
      signIn,
      register,
      resetPassword,
      signInWithGoogle,
      linkGoogleToPassword,
      sendPhoneCode,
      confirmPhoneCode,
      saveProfile,
      signOutUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
