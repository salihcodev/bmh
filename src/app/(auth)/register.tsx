import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';

import { AppText, Button, Field } from '@/components/ui';
import { AuthCard } from '@/features/auth/auth-card';
import { registerSchema, type RegisterInput } from '@/features/auth/schemas';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { authErrorMessage } from '@/services/firebase/auth-errors';

export default function RegisterScreen() {
  const { register } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const submit = handleSubmit(async (value) => {
    try {
      await register(value);
    } catch (error) {
      setError('root', { message: authErrorMessage(error) });
    }
  });

  const fieldError = (key: keyof RegisterInput) => {
    const message = errors[key]?.message;
    return message ? t(message) : undefined;
  };

  return (
    <AuthCard title={t('auth.register')} subtitle={t('auth.needsConnection')}>
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <Field
            label={t('auth.displayName')}
            autoComplete="name"
            autoCapitalize="words"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldError('displayName')}
          />
        )}
      />
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
            error={fieldError('email')}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field
            label={t('auth.password')}
            secureTextEntry
            autoComplete="new-password"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldError('password')}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <Field
            label={t('auth.confirmPassword')}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={submit}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={fieldError('confirmPassword')}
          />
        )}
      />
      {errors.root?.message ? <AppText style={{ color: colors.danger }}>{errors.root.message}</AppText> : null}
      <Button title={t('auth.register')} loadingTitle={t('auth.registering')} loading={isSubmitting} onPress={submit} />
      <Link href="/(auth)/login" style={[styles.link, { color: colors.primary }]}>
        {t('auth.haveAccount')}
      </Link>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  link: { textAlign: 'center', paddingVertical: 10, fontSize: 14 },
});
