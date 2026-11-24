import { Redirect, useLocalSearchParams } from 'expo-router';

import { LoadingState, Screen , AppText } from '@/components/ui';
import { parseBagToken } from '@/domain/bag';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { joinBagByToken } from '@/services/store/bag-writes';
import { useBagLink } from '@/services/store/use-store';
import { setPendingHref } from '@/services/navigation/pending-href';
import { useEffect, useRef } from 'react';

/** Resolves a bag token from a deep link, joins the bag, then navigates to its detail screen. */
export default function BagTokenScreen() {
  const { t } = useTranslation();
  const { token: rawToken } = useLocalSearchParams<{ token: string }>();
  const { user, profile } = useAuth();
  const token = parseBagToken(rawToken ?? '');
  const { bagId, status } = useBagLink(token);

  const href = `/bag/${rawToken}`;

  // If not signed in, save the pending path and redirect to login
  if (!user) {
    setPendingHref(href);
    return <Redirect href="/(auth)/login" />;
  }

  if (!token) {
    return <Redirect href="/(app)" />;
  }

  if (status === 'missing' || status === 'inactive') {
    return (
      <Screen scroll={false}>
        <AppText variant="body" tone="secondary" center>{t('bags.inactive')}</AppText>
      </Screen>
    );
  }

  if (status === 'error') {
    return <Redirect href="/(app)" />;
  }

  if (status === 'ready' && bagId) {
    return <JoinAndRedirect bagId={bagId} token={token} profile={profile} />;
  }

  return (
    <Screen scroll={false}>
      <LoadingState />
    </Screen>
  );
}

function JoinAndRedirect({
  bagId,
  token,
  profile,
}: {
  bagId: string;
  token: string;
  profile: { id: string; displayName?: string | null } | null;
}) {
  const joined = useRef(false);

  useEffect(() => {
    if (!profile || joined.current) return;
    joined.current = true;
    const actor = { uid: profile.id, name: profile.displayName ?? '', avatarPublicId: null };
    joinBagByToken(actor, bagId, token).catch(() => {/* already a participant or offline */});
  }, [bagId, token, profile]);

  return <Redirect href={{ pathname: '/bags/[id]', params: { id: bagId } }} />;
}
