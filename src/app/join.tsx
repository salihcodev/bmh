import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText, Button, Card, Field, LoadingState, Screen } from '@/components/ui';
import { env } from '@/config/env';
import { inviteLink } from '@/domain/invite';
import type { Invite } from '@/domain/types';
import { roleLabel } from '@/features/members/roles';
import { useFinishOnboarding } from '@/features/onboarding/use-finish-onboarding';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { OfflineError } from '@/services/sync/connectivity';
import { lookupInvite, redeemInvite } from '@/services/workspaces/api';
import { spacing } from '@/theme';

type Found = { workspaceId: string; code: string; invite: Invite };

export default function JoinScreen() {
  const { t } = useTranslation();
  const finish = useFinishOnboarding();
  const { user, loading } = useAuth();
  const { actor, memberships, switchWorkspace } = useWorkspace();
  const params = useLocalSearchParams<{ w?: string; c?: string }>();
  const [input, setInput] = useState(params.w && params.c ? inviteLink(params.w, params.c, env.linkDomain) : '');
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  // Deep links arrive before sign-in too; the user signs in and opens the link again.
  if (!user) return <Redirect href="/(auth)/login" />;

  const describe = (exc: unknown) => (exc instanceof OfflineError ? t('errors.offline') : errorMessage(exc));

  const check = async () => {
    setError(null);
    setFound(null);
    try {
      const result = await lookupInvite(input);
      if (!result.ok) {
        setError(
          t(
            result.reason === 'used'
              ? 'onboarding.inviteUsed'
              : result.reason === 'expired'
                ? 'onboarding.inviteExpired'
                : 'onboarding.invalidInvite',
          ),
        );
        return;
      }
      if (memberships.some((m) => m.workspaceId === result.workspaceId)) {
        setError(t('onboarding.alreadyMember'));
        return;
      }
      setFound(result);
    } catch (exc) {
      setError(describe(exc));
    }
  };

  const join = async () => {
    if (!found || !actor) return;
    try {
      await redeemInvite(found.workspaceId, found.code, found.invite, actor);
      switchWorkspace(found.workspaceId, { name: found.invite.workspaceName });
      emitActionFeedback({ message: t('onboarding.joined', { name: found.invite.workspaceName }), kind: 'success' });
      finish();
    } catch (exc) {
      setError(describe(exc));
    }
  };

  return (
    <Screen header={<ScreenHeader title={t('onboarding.joinTitle')} back />}>
      <Card>
        <AppText muted style={styles.gap}>
          {t('onboarding.joinHint')}
        </AppText>
        <Field
          label={t('onboarding.inviteInput')}
          ltr
          autoCorrect={false}
          value={input}
          onChangeText={(text) => {
            setInput(text);
            setFound(null);
          }}
        />
        {error ? (
          <AppText variant="bodySm" tone="danger" style={styles.gap}>
            {error}
          </AppText>
        ) : null}
        {found ? (
          <>
            <AppText variant="heading" style={styles.gap}>
              {t('onboarding.invitedTo', {
                name: found.invite.workspaceName,
                role: roleLabel(t, found.invite.roleId, { name: found.invite.roleName }),
              })}
            </AppText>
            <Button title={t('onboarding.join')} loadingTitle={t('onboarding.joining')} onPress={join} />
          </>
        ) : (
          <Button title={t('common.next')} disabled={!input.trim()} onPress={check} />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { marginBottom: spacing[3] } });
