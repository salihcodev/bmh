import { i18n } from '@/localization';

export type FeedbackKind = 'success' | 'error' | 'warning' | 'info';

export type ActionFeedbackEvent = {
  message: string;
  kind: FeedbackKind;
  duration?: number;
  /** One inline action, e.g. Undo. */
  action?: { label: string; onPress: () => void };
};

type Listener = (event: ActionFeedbackEvent) => void;

const listeners = new Set<Listener>();

/** Lets non-React code (services, repositories) surface a toast. */
export function emitActionFeedback(event: ActionFeedbackEvent) {
  listeners.forEach((listener) => listener(event));
}

export function subscribeToActionFeedback(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const CODE_KEYS: Record<string, string> = {
  'permission-denied': 'errors.permissionDenied',
  unauthenticated: 'errors.unauthenticated',
  unavailable: 'errors.unavailable',
  'network-request-failed': 'errors.network',
};

export function errorMessage(error: unknown, fallbackKey = 'errors.generic'): string {
  const value = error as { code?: string } | null;
  const code = value?.code?.replace(/^(firestore|auth)\//, '');
  return i18n.t((code && CODE_KEYS[code]) || fallbackKey);
}
