import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';

import { AppText, Button, Field } from '@/components/ui';
import { LoadingState } from '@/components/ui/states';
import { AuthCard } from '@/features/auth/auth-card';
import { displayNameSchema, type DisplayNameInput } from '@/features/auth/schemas';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { authErrorMessage } from '@/services/firebase/auth-errors';

export default function CompleteProfileScreen() {
  const { user, profile, profileReady, saveProfile } = useAuth();
  const { signOut } = useSignOut();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DisplayNameInput>({ resolver: zodResolver(displayNameSchema), defaultValues: { displayName: '' } });

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!profileReady) return <LoadingState />;
  if (profile) return <Redirect href="/" />;

  const submit = handleSubmit(async ({ displayName }) => {
    try {
      await saveProfile(displayName);
    } catch (error) {
      setError('root', { message: authErrorMessage(error) });
    }
  });

  return (
    <AuthCard title={t('auth.completeTitle')} subtitle={t('auth.completeHint')}>
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <Field
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
      {errors.root?.message ? <AppText style={{ color: colors.danger }}>{errors.root.message}</AppText> : null}
      <Button title={t('auth.saveProfile')} loading={isSubmitting} onPress={submit} />
      <Button title={t('auth.signOut')} variant="ghost" onPress={signOut} />
    </AuthCard>
  );
}
