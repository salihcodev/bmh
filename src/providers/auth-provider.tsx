import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  type AuthCredential,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { emitActionFeedback } from '@/lib/action-feedback';
import { i18n } from '@/localization';
import { GoogleLinkRequired } from '@/services/firebase/auth-errors';
import { auth, db } from '@/services/firebase/client';
import { requestGoogleIdToken, signOutGoogleSession } from '@/services/firebase/google';
import { checkOnline } from '@/services/sync/connectivity';
import { OUTBOX_JOBS, outbox } from '@/services/sync/outbox-runtime';

export type UserProfile = {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  locale?: string;
  lastWorkspaceId?: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  /** True until Firebase reports the first auth state. */
  loading: boolean;
  /** True once we know whether `users/{uid}` exists. */
  profileReady: boolean;
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
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function profileData(user: User, displayName: string, emailOverride?: string) {
  const email = (emailOverride || user.email || '').trim().toLowerCase();
  const data: Record<string, unknown> = {
    displayName: displayName.trim().slice(0, 80),
    locale: i18n.language,
    createdAt: serverTimestamp(),
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

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        if (!nextUser) {
          setProfile(null);
          setProfileReady(false);
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
        setProfile({ id: snapshot.id, ...(snapshot.data() as Omit<UserProfile, 'id'>) });
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

  const signOutUser = useCallback(async () => {
    await signOutGoogleSession();
    await signOut(auth);
    emitActionFeedback({ message: i18n.t('auth.signedOut'), kind: 'success' });
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileReady,
      signIn,
      register,
      resetPassword,
      signInWithGoogle,
      linkGoogleToPassword,
      sendPhoneCode,
      confirmPhoneCode,
      saveProfile,
      signOutUser,
    }),
    [
      user,
      profile,
      loading,
      profileReady,
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
