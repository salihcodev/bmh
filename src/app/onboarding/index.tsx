import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { ClipboardList, Compass, LogIn, Plus, ShieldCheck, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand/brand-mark';
import { AppText, Button, Card, GroupedList, Header, InlineBanner, ListRow, ProgressBar, Screen, SelectableCard, TextField } from '@/components/ui';
import type { OnboardingStep } from '@/domain/user';
import { onboardingStep } from '@/domain/user';
import { displayNameSchema, type DisplayNameInput } from '@/features/auth/schemas';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useFinishOnboarding } from '@/features/onboarding/use-finish-onboarding';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { authErrorMessage } from '@/services/firebase/auth-errors';
import { useConnectivity } from '@/services/sync/connectivity';
import { radii, spacing, useTheme } from '@/theme';

type Step = Exclude<OnboardingStep, 'done'>;
const STEPS: Step[] = ['intro', 'profile', 'workspace'];

/**
 * One resumable flow: intro, profile, workspace (create / join / later), done.
 * The step is saved on users/{uid}.onboarding once the profile exists.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const guard = useRouteGuard();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ step?: string }>();
  const requested = STEPS.find((s) => s === params.step);
  const saved: Step = guard.kind === 'onboarding' ? guard.step : (requested ?? 'workspace');
  const [local, setLocal] = useState<Step | null>(requested ?? null);
  const step = local ?? (profile ? (onboardingStep(profile) === 'done' ? 'workspace' : saved) : 'intro');
  const index = STEPS.indexOf(step);

  return (
    <Screen
      surface="white"
      header={
        <View>
          <Header
            title={t('onboardingFlow.stepOf', { current: index + 1, total: STEPS.length })}
            back={index > 0}
            onBack={() => setLocal(STEPS[index - 1] ?? 'intro')}
          />
          <View style={styles.progress}>
            <ProgressBar value={(index + 1) / STEPS.length} label={t('onboardingFlow.stepOf', { current: index + 1, total: STEPS.length })} />
          </View>
        </View>
      }
    >
      {step === 'intro' ? <IntroStep onNext={() => setLocal('profile')} /> : null}
      {step === 'profile' ? <ProfileStep onNext={() => setLocal('workspace')} /> : null}
      {step === 'workspace' ? <WorkspaceStep /> : null}
    </Screen>
  );
}

function IntroStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile, setOnboardingStep } = useAuth();
  const { signOut } = useSignOut();
  return (
    <View style={styles.step}>
      <Card tone="lime" style={styles.hero}>
        <BrandMark size={112} on={colors.accent} color={colors.onAccent} />
      </Card>
      <AppText variant="display">{t('onboardingFlow.introTitle')}</AppText>
      <AppText variant="bodyLg" weight="regular" muted>
        {t('onboardingFlow.introBody')}
      </AppText>
      <GroupedList variant="tiles">
        <ListRow icon={Users} label={t('onboardingFlow.introTeam')} hint={t('onboardingFlow.introTeamHint')} />
        <ListRow icon={ClipboardList} label={t('onboardingFlow.introField')} hint={t('onboardingFlow.introFieldHint')} />
        <ListRow icon={ShieldCheck} label={t('onboardingFlow.introPrivate')} hint={t('onboardingFlow.introPrivateHint')} />
      </GroupedList>
      <Button
        title={t('onboardingFlow.getStarted')}
        onPress={() => {
          if (profile) void setOnboardingStep('profile');
          onNext();
        }}
      />
      <Button title={t('auth.signOut')} variant="ghost" onPress={signOut} />
    </View>
  );
}

function ProfileStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const { user, profile, saveProfile, updateProfileFields } = useAuth();
  const isOnline = useConnectivity((state) => state.isOnline);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DisplayNameInput>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: profile?.displayName || user?.displayName || '' },
  });

  const submit = handleSubmit(async ({ displayName }) => {
    try {
      if (!profile) await saveProfile(displayName);
      await updateProfileFields({ displayName, onboarding: { step: 'workspace', completedAt: null } });
      onNext();
    } catch (error) {
      setError('root', { message: authErrorMessage(error) });
    }
  });

  return (
    <View style={styles.step}>
      <AppText variant="h1">{t('onboardingFlow.profileTitle')}</AppText>
      <AppText variant="body" muted>
        {t('onboardingFlow.profileHint')}
      </AppText>
      {!profile && !isOnline ? <InlineBanner tone="offline" message={t('auth.needsConnection')} /> : null}
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label={t('auth.displayName')}
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="go"
            onSubmitEditing={submit}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={errors.displayName?.message ? t(errors.displayName.message) : undefined}
          />
        )}
      />
      {errors.root?.message ? (
        <AppText variant="bodySm" tone="danger">
          {errors.root.message}
        </AppText>
      ) : null}
      <Button title={t('onboardingFlow.continue')} loading={isSubmitting} onPress={submit} />
    </View>
  );
}

function WorkspaceStep() {
  const { t } = useTranslation();
  const finish = useFinishOnboarding();
  const [choice, setChoice] = useState<'create' | 'join' | 'later'>('create');
  const next = () => {
    if (choice === 'create') router.push('/onboarding/create');
    else if (choice === 'join') router.push('/join');
    else return finish('/');
  };
  return (
    <View style={styles.step}>
      <AppText variant="h1">{t('onboardingFlow.workspaceTitle')}</AppText>
      <AppText variant="body" muted>
        {t('onboardingFlow.workspaceHint')}
      </AppText>
      <View>
        <SelectableCard
          icon={Plus}
          title={t('onboardingFlow.create')}
          hint={t('onboardingFlow.createHint')}
          selected={choice === 'create'}
          onPress={() => setChoice('create')}
        />
        <SelectableCard
          icon={LogIn}
          title={t('onboardingFlow.join')}
          hint={t('onboardingFlow.joinHint')}
          selected={choice === 'join'}
          onPress={() => setChoice('join')}
        />
        <SelectableCard
          icon={Compass}
          title={t('onboardingFlow.later')}
          hint={t('onboardingFlow.laterHint')}
          selected={choice === 'later'}
          onPress={() => setChoice('later')}
        />
      </View>
      <Button title={choice === 'later' ? t('onboardingFlow.finish') : t('onboardingFlow.continue')} onPress={next} />
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { paddingHorizontal: spacing[5], paddingBottom: spacing[2] },
  step: { gap: spacing[4], paddingTop: spacing[2] },
  hero: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[8], borderRadius: radii.xl, marginBottom: 0 },
});
