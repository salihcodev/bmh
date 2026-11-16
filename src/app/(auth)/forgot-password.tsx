import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';

import { AppText, Button, Field } from '@/components/ui';
import { AuthCard } from '@/features/auth/auth-card';
import { resetSchema, type ResetInput } from '@/features/auth/schemas';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { authErrorMessage } from '@/services/firebase/auth-errors';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const { colors } = useAppTheme();
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
    <AuthCard title={t('auth.resetTitle')} subtitle={t('auth.resetHint')}>
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
        <AppText style={{ color: sent === 'sent' ? colors.success : colors.warning }}>
          {t(sent === 'sent' ? 'auth.resetSent' : 'auth.resetQueued')}
        </AppText>
      ) : null}
      {errors.root?.message ? <AppText style={{ color: colors.danger }}>{errors.root.message}</AppText> : null}
      <Button title={t('auth.sendReset')} loading={isSubmitting} onPress={submit} />
      <Link href="/(auth)/login" style={[styles.link, { color: colors.primary }]}>
        {t('auth.backToLogin')}
      </Link>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  link: { textAlign: 'center', paddingVertical: 10, fontSize: 14 },
});
