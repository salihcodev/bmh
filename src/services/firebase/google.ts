import { env } from '@/config/env';

const CANCELLED = new Set(['-5', '12501', 'SIGN_IN_CANCELLED', 'auth/popup-closed-by-user']);

export function isGoogleCancel(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return CANCELLED.has(String(code));
}

function coded(code: string): Error & { code: string } {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}

/** Opens the Google account chooser and returns an ID token for Firebase Auth. */
export async function requestGoogleIdToken(): Promise<{ idToken: string; email: string }> {
  const webClientId = env.googleWebClientId;
  if (!webClientId) throw coded('google/not-configured');

  let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
  try {
    ({ GoogleSignin } = await import('@react-native-google-signin/google-signin'));
  } catch {
    throw coded('google/native-missing');
  }

  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // signIn() reuses the last cached account. Clearing it shows the chooser.
  await GoogleSignin.signOut().catch(() => undefined);
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw coded('google/missing-id-token');
  return { idToken, email: result.data?.user.email ?? '' };
}

export async function signOutGoogleSession() {
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // The native module is absent until the dev client is rebuilt.
  }
}
