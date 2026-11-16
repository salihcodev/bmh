import { router } from 'expo-router';
import { Palette, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, GroupedList, Header, ListRow, Screen } from '@/components/ui';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { sizes, spacing } from '@/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, user } = useAuth();
  const name = profile?.displayName || user?.displayName || '';
  const contact = user?.email || user?.phoneNumber || '';
  return (
    <Screen header={<Header large title={t('tabs.profile')} />} contentStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar name={name || contact || '?'} size={sizes.avatarLg} />
        <AppText variant="h2" center>
          {name}
        </AppText>
        {contact ? (
          <AppText variant="bodySm" tone="secondary" ltr center>
            {contact}
          </AppText>
        ) : null}
      </View>
      <GroupedList>
        <ListRow icon={Palette} label={t('settings.title')} onPress={() => router.push('/appearance')} />
        <ListRow icon={Settings} label={t('tabs.settings')} onPress={() => router.push('/settings')} />
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  identity: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
});
