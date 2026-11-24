import type { StyleProp, TextStyle } from 'react-native';

import { AppText, InlineBanner, type BannerTone, type TextTone } from '@/components/ui';
import type { MessageType } from '@/domain/system-message';

import { useSystemMessage } from './use-system-message';

const TONES: Record<MessageType, BannerTone> = { info: 'info', success: 'success', warning: 'warning', error: 'danger' };

/**
 * Admin-editable text for a named place. Messages and alerts render as a notice strip; info texts
 * (and the plain fallback) render as secondary text. Without admin text and without `fallback`,
 * nothing renders.
 */
export function SystemMessage({
  messageKey,
  fallback = '',
  tone = 'secondary',
  plain = false,
  style,
}: {
  messageKey: string;
  /** The app's own i18n string, shown whenever no admin message applies. */
  fallback?: string;
  tone?: TextTone;
  /** Always plain text, even for messages and alerts (inside a card that already has a background). */
  plain?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { message, text, title, isRemote } = useSystemMessage(messageKey, fallback);
  if (!text) return null;
  if (!plain && message && isRemote && message.category !== 'info-text') {
    return <InlineBanner tone={TONES[message.type]} message={title ? `${title}. ${text}` : text} />;
  }
  return (
    <AppText variant="bodySm" tone={tone} style={style}>
      {text}
    </AppText>
  );
}
