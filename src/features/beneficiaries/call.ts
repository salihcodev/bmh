import { Linking } from 'react-native';

import { emitActionFeedback } from '@/lib/action-feedback';
import { i18n } from '@/localization';
import { logCallAttempt } from '@/services/beneficiaries/api';
import type { Actor } from '@/services/firebase/refs';

/**
 * Opens the dialer and records a `call_initiated` event. The app cannot know whether
 * the call connected, so the event only ever means "a call was started".
 */
export async function startCall(
  wid: string,
  beneficiaryId: string,
  phone: string | null,
  actor: Actor,
  options: { sessionId?: string; onLogged?: () => void } = {},
) {
  if (!phone) {
    emitActionFeedback({ message: i18n.t('beneficiaries.noPrimaryPhone'), kind: 'warning' });
    return;
  }
  try {
    await Linking.openURL(`tel:${phone}`);
  } catch {
    emitActionFeedback({ message: i18n.t('errors.generic'), kind: 'error' });
    return;
  }
  logCallAttempt(wid, beneficiaryId, phone, actor, options.sessionId);
  options.onLogged?.();
}
