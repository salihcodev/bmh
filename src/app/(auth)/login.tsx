import type { AuthCredential } from '@react-native-firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Field, TextLink } from '@/components/ui';
import { AuthCard } from '@/features/auth/auth-card';
import { GoogleMark } from '@/features/auth/google-mark';
import { loginSchema, type LoginInput } from '@/features/auth/schemas';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { authErrorMessage, isGoogleLinkRequired } from '@/services/firebase/auth-errors';
import { isGoogleCancel } from '@/services/firebase/google';
import { spacing, useTheme } from '@/theme';

export default function LoginScreen() {
  const { signIn, signInWithGoogle, linkGoogleToPassword } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const [googleError, setGoogleError] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [linkCredential, setLinkCredential] = useState<AuthCredential | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linking, setLinking] = useState(false);

  const submit = handleSubmit(async (value) => {
    try {
      await signIn(value.email, value.password);
    } catch (error) {
      setError('root', { message: authErrorMessage(error) });
    }
  });

  const google = async () => {
    setGoogleError('');
    try {
      await signInWithGoogle();
    } catch (error) {
      if (isGoogleCancel(error)) return;
      if (isGoogleLinkRequired(error)) {
        setLinkEmail(error.email);
        setLinkCredential(error.credential);
        setLinkPassword('');
        setLinkError('');
        return;
      }
      setGoogleError(authErrorMessage(error, 'errors.auth.googleFailed'));
    }
  };

  const link = async () => {
    if (!linkCredential) return;
    setLinking(true);
    setLinkError('');
    try {
      await linkGoogleToPassword(linkEmail, linkPassword, linkCredential);
      setLinkCredential(null);
    } catch (error) {
      setLinkError(authErrorMessage(error));
    } finally {
      setLinking(false);
    }
  };

  return (
    <AuthCard title={t('app.name')} subtitle={t('app.tagline')}>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            ltr
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={errors.email?.message ? t(errors.email.message) : undefined}
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
            autoComplete="password"
            textContentType="password"
            ltr
            returnKeyType="go"
            onSubmitEditing={submit}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={errors.password?.message ? t(errors.password.message) : undefined}
          />
        )}
      />
      {errors.root?.message ? (
        <AppText variant="bodySm" tone="danger">
          {errors.root.message}
        </AppText>
      ) : null}
      <Button title={t('auth.login')} loadingTitle={t('auth.loggingIn')} loading={isSubmitting} onPress={submit} />
      <TextLink href="/(auth)/forgot-password" label={t('auth.forgotPassword')} />

      <View style={styles.or}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <AppText muted>{t('auth.or')}</AppText>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      {linkCredential ? (
        <View style={styles.linkBox}>
          <AppText variant="label">{t('auth.linkGoogleTitle')}</AppText>
          <AppText muted>{t('auth.linkGoogleHint', { email: linkEmail || t('auth.email') })}</AppText>
          <Field
            label={t('auth.password')}
            secureTextEntry
            autoComplete="password"
            ltr
            value={linkPassword}
            onChangeText={setLinkPassword}
            error={linkError || undefined}
          />
          <Button title={t('auth.link')} loadingTitle={t('auth.linking')} loading={linking} onPress={link} />
        </View>
      ) : (
        <>
          {googleError ? (
        <AppText variant="bodySm" tone="danger">
          {googleError}
        </AppText>
      ) : null}
          <Button title={t('auth.continueGoogle')} icon={<GoogleMark />} variant="secondary" onPress={google} />
          <TextLink href="/(auth)/phone" label={t('auth.continuePhone')} />
        </>
      )}

      <TextLink href="/(auth)/register" label={t('auth.noAccount')} />
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginVertical: spacing[1] },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  linkBox: { gap: spacing[2] },
});
