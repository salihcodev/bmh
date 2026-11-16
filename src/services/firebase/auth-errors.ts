import type { AuthCredential } from '@react-native-firebase/auth';

import { i18n } from '@/localization';

const AUTH_ERROR_KEYS: Record<string, string> = {
  'auth/invalid-credential': 'errors.auth.invalidCredential',
  'auth/wrong-password': 'errors.auth.invalidCredential',
  'auth/user-not-found': 'errors.auth.userNotFound',
  'auth/invalid-email': 'errors.auth.invalidEmail',
  'auth/user-disabled': 'errors.auth.userDisabled',
  'auth/too-many-requests': 'errors.auth.tooManyRequests',
  'auth/network-request-failed': 'errors.network',
  'auth/operation-not-allowed': 'errors.auth.operationNotAllowed',
  'auth/email-already-in-use': 'errors.auth.emailInUse',
  'auth/weak-password': 'errors.auth.weakPassword',
  'auth/missing-email': 'errors.auth.missingEmail',
  'auth/invalid-phone-number': 'errors.auth.invalidPhoneNumber',
  'auth/missing-phone-number': 'errors.auth.invalidPhoneNumber',
  'auth/invalid-verification-code': 'errors.auth.invalidVerificationCode',
  'auth/invalid-verification-id': 'errors.auth.sessionExpired',
  'auth/session-expired': 'errors.auth.sessionExpired',
  'auth/code-expired': 'errors.auth.sessionExpired',
  'auth/quota-exceeded': 'errors.auth.quotaExceeded',
  'auth/missing-client-identifier': 'errors.auth.missingClient',
  'auth/app-not-authorized': 'errors.auth.missingClient',
  'auth/captcha-check-failed': 'errors.auth.missingClient',
  'auth/account-exists-with-different-credential': 'errors.auth.accountExists',
  'google/not-configured': 'errors.auth.googleNotConfigured',
  'google/native-missing': 'errors.auth.googleNativeMissing',
  'google/missing-id-token': 'errors.auth.googleFailed',
  '10': 'errors.auth.googleDeveloper',
  DEVELOPER_ERROR: 'errors.auth.googleDeveloper',
};

/** Same email already has a password account. The login screen asks for that password and links Google. */
export class GoogleLinkRequired extends Error {
  readonly code = 'auth/account-exists-with-different-credential';

  constructor(
    readonly email: string,
    readonly credential: AuthCredential,
  ) {
    super('GOOGLE_LINK_REQUIRED');
    this.name = 'GoogleLinkRequired';
  }
}

export function isGoogleLinkRequired(error: unknown): error is GoogleLinkRequired {
  return error instanceof GoogleLinkRequired;
}

export function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

export function authErrorMessage(error: unknown, fallbackKey = 'errors.auth.generic'): string {
  const key = AUTH_ERROR_KEYS[errorCode(error)] ?? fallbackKey;
  return i18n.t(key);
}
