import type { ConfirmationResult } from '@react-native-firebase/auth';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText, Button, Field } from '@/components/ui';
import { normalizePhone } from '@/domain/phone';
import { AuthCard } from '@/features/auth/auth-card';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { authErrorMessage } from '@/services/firebase/auth-errors';
import { normalizeDigits } from '@/utils/arabic';

export default function PhoneScreen() {
  const { sendPhoneCode, confirmPhoneCode } = useAuth();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const send = async () => {
    const parsed = normalizePhone(phone);
    if (!parsed.ok) {
      setError(t('validation.phoneInvalid'));
      return;
    }
    setSending(true);
    setError('');
    try {
      setConfirmation(await sendPhoneCode(parsed.e164));
      setCode('');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const confirm = async () => {
    if (!confirmation) return;
    const digits = normalizeDigits(code).replace(/\D/g, '');
    if (digits.length !== 6) {
      setError(t('validation.code'));
      return;
    }
    setConfirming(true);
    setError('');
    try {
      await confirmPhoneCode(confirmation, digits);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AuthCard title={t('auth.phoneTitle')} subtitle={confirmation ? t('auth.codeSent') : t('auth.phoneHint')}>
      {confirmation ? (
        <Field
          label={t('auth.code')}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          ltr
          maxLength={6}
          value={code}
          onChangeText={setCode}
          returnKeyType="go"
          onSubmitEditing={confirm}
        />
      ) : (
        <Field
          label={t('auth.phone')}
          placeholder="01xxxxxxxxx"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          ltr
          value={phone}
          onChangeText={setPhone}
          returnKeyType="go"
          onSubmitEditing={send}
        />
      )}
      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      {confirmation ? (
        <>
          <Button title={t('auth.confirmCode')} loadingTitle={t('auth.confirming')} loading={confirming} onPress={confirm} />
          <Button title={t('auth.resendCode')} variant="secondary" loading={sending} onPress={send} />
          <Button title={t('auth.changeNumber')} variant="ghost" onPress={() => { setConfirmation(null); setError(''); }} />
        </>
      ) : (
        <Button title={t('auth.sendCode')} loadingTitle={t('auth.sendingCode')} loading={sending} onPress={send} />
      )}
      <Link href="/(auth)/login" style={[styles.link, { color: colors.primary }]}>
        {t('auth.backToLogin')}
      </Link>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  link: { textAlign: 'center', paddingVertical: 10, fontSize: 14 },
});
