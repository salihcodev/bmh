import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppText, Button, Field, InlineBanner, TextLink } from '@/components/ui';
import { AuthCard } from '@/features/auth/auth-card';
import { resetSchema, type ResetInput } from '@/features/auth/schemas';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { authErrorMessage } from '@/services/firebase/auth-errors';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const { t } = useTranslation();
  const [sent, setSent] = useState<false | 'sent' | 'queued'>(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({ resolver: zodResolver(resetSchema), defaultValues: { email: '' } });

  const submit = handleSubmit(async ({ email }) => {
    try {
      setSent(await resetPassword(email));
    } catch (error) {
      // Do not reveal whether the email exists.
      if ((error as { code?: string })?.code === 'auth/user-not-found') {
        setSent('sent');
        return;
      }
      setError('root', { message: authErrorMessage(error) });
    }
  });

  return (
    <AuthCard back title={t('auth.resetTitle')} subtitle={t('auth.resetHint')}>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label={t('auth.email')}
            keyboardType="email-address"
            autoComplete="email"
            ltr
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={errors.email?.message ? t(errors.email.message) : undefined}
          />
        )}
      />
      {sent ? (
        <InlineBanner
          tone={sent === 'sent' ? 'success' : 'offline'}
          message={t(sent === 'sent' ? 'auth.resetSent' : 'auth.resetQueued')}
        />
      ) : null}
      {errors.root?.message ? (
        <AppText variant="bodySm" tone="danger">
          {errors.root.message}
        </AppText>
      ) : null}
      <Button title={t('auth.sendReset')} loading={isSubmitting} onPress={submit} />
      <TextLink href="/(auth)/login" label={t('auth.backToLogin')} />
    </AuthCard>
  );
}
