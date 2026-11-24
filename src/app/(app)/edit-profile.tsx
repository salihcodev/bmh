import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Avatar, Button, Card, Field, Screen } from '@/components/ui';
import { normalizePhone } from '@/domain/phone';
import type { ProfilePatch } from '@/domain/user';
import { ChangeAvatarSheet } from '@/features/profile/change-avatar-sheet';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { sizes, spacing } from '@/theme';

const NAME_MAX = 80;

/** One place to edit the profile: photo, display name and contact phone. */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { profile, user, updateProfileFields } = useAuth();
  const initialName = profile?.displayName || user?.displayName || '';
  const initialPhone = profile?.phone ?? '';
  const signInPhone = user?.phoneNumber ?? null;
  const email = user?.email ?? profile?.email ?? '';
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(signInPhone ?? initialPhone);
  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [changingAvatar, setChangingAvatar] = useState(false);

  const save = async () => {
    const nextName = name.trim();
    const nameProblem = nextName ? undefined : t('profile.nameRequired');
    let nextPhone: string | null = null;
    let phoneProblem: string | undefined;
    if (!signInPhone && phone.trim()) {
      const parsed = normalizePhone(phone);
      if (parsed.ok) nextPhone = parsed.e164;
      else phoneProblem = t('validation.phoneInvalid');
    }
    setNameError(nameProblem);
    setPhoneError(phoneProblem);
    if (nameProblem || phoneProblem) return;

    const patch: ProfilePatch = {};
    if (nextName !== initialName) patch.displayName = nextName;
    if (!signInPhone && nextPhone !== (profile?.phone ?? null)) patch.phone = nextPhone;
    try {
      if (Object.keys(patch).length > 0) {
        await updateProfileFields(patch);
        emitActionFeedback({ message: t('profile.saved'), kind: 'success' });
      }
      router.back();
    } catch (error) {
      emitActionFeedback({ message: errorMessage(error), kind: 'error' });
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={t('profile.edit')} back />}
      contentStyle={styles.content}
      footer={<Button title={t('common.save')} onPress={save} />}
    >
      <Card style={styles.photo}>
        <Avatar name={name || email || '?'} publicId={profile?.avatarPublicId} size={sizes.avatarLg} />
        <Button
          title={t('profile.changePhoto')}
          icon={<Camera />}
          variant="secondary"
          compact
          fullWidth={false}
          style={styles.center}
          onPress={() => setChangingAvatar(true)}
        />
      </Card>
      <Card style={styles.card}>
        <Field
          label={t('profile.nameLabel')}
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          error={nameError}
        />
        <Field
          label={t('profile.phoneLabel')}
          value={phone}
          onChangeText={setPhone}
          ltr
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder={t('beneficiaries.phonePlaceholder')}
          editable={!signInPhone}
          hint={signInPhone ? t('profile.phoneLocked') : undefined}
          error={phoneError}
        />
        {email ? (
          <Field label={t('profile.emailLabel')} value={email} ltr editable={false} hint={t('profile.emailLocked')} />
        ) : null}
      </Card>
      <ChangeAvatarSheet visible={changingAvatar} onClose={() => setChangingAvatar(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  photo: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[5], marginBottom: 0 },
  card: { paddingBottom: spacing[1], marginBottom: 0 },
  center: { alignSelf: 'center' },
});
