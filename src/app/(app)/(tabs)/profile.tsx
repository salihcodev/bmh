import { router } from 'expo-router';
import { Building2, HandHeart, Info, LogOut, Palette, Pencil, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Card, GroupedList, Header, IconButton, ListRow, PromptSheet, Screen, SectionHeader } from '@/components/ui';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useCurrentUser } from '@/hooks/use-current-user';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { sizes, spacing } from '@/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, user, updateProfileFields } = useAuth();
  const { isSuperAdmin } = useCurrentUser();
  const { memberships, workspaces, workspaceId, switchWorkspace } = useWorkspace();
  const { signOut, busy, dialog } = useSignOut();
  const [editing, setEditing] = useState(false);
  const name = profile?.displayName || user?.displayName || '';
  const contact = user?.email || user?.phoneNumber || '';

  return (
    <Screen header={<Header large title={t('tabs.profile')} />} contentStyle={styles.content}>
      <Card style={styles.identity}>
        <Avatar name={name || contact || '?'} size={sizes.avatarLg} />
        <View style={styles.nameRow}>
          <AppText variant="h2" center>
            {name}
          </AppText>
          <IconButton icon={Pencil} variant="ghost" label={t('profile.editName')} onPress={() => setEditing(true)} />
        </View>
        {contact ? (
          <AppText variant="bodySm" tone="secondary" ltr center>
            {contact}
          </AppText>
        ) : null}
        {isSuperAdmin ? <Badge label={t('manage.tag')} tone="lime" /> : null}
      </Card>

      <View>
        <SectionHeader title={t('profile.workspaces')} />
        {memberships.length === 0 ? (
          <Card>
            <AppText variant="bodySm" tone="secondary" center>
              {t('profile.noWorkspaces')}
            </AppText>
          </Card>
        ) : (
          <GroupedList>
            {memberships.map(({ workspaceId: wid, member }) => (
              <ListRow
                key={wid}
                icon={Building2}
                label={workspaces[wid]?.name ?? '…'}
                hint={t(`workspace.role.${member.role}`)}
                right={wid === workspaceId ? <Badge label={t('profile.current')} tone="lime" /> : undefined}
                chevron={wid !== workspaceId}
                onPress={wid === workspaceId ? undefined : () => switchWorkspace(wid)}
              />
            ))}
          </GroupedList>
        )}
      </View>

      <View>
        <SectionHeader title={t('profile.preferences')} />
        <GroupedList>
          <ListRow icon={Palette} label={t('preferences.appearance')} onPress={() => router.push('/appearance')} />
          <ListRow icon={Settings} label={t('tabs.settings')} onPress={() => router.push('/settings')} />
          <ListRow icon={HandHeart} tile="lime" label={t('profile.support')} onPress={() => router.push('/support')} />
          <ListRow icon={Info} label={t('profile.about')} onPress={() => router.push('/about')} />
        </GroupedList>
      </View>

      <GroupedList>
        <ListRow
          icon={LogOut}
          label={busy ? t('preferences.signingOut') : t('auth.signOut')}
          destructive
          disabled={busy}
          chevron={false}
          onPress={signOut}
        />
      </GroupedList>

      <PromptSheet
        key={editing ? 'open' : 'closed'}
        visible={editing}
        title={t('profile.editName')}
        fields={[{ key: 'name', label: t('profile.nameLabel'), initial: name, max: 80 }]}
        onClose={() => setEditing(false)}
        onSubmit={async ({ name: next = '' }) => {
          try {
            await updateProfileFields({ displayName: next.trim() });
            emitActionFeedback({ message: t('profile.nameSaved'), kind: 'success' });
            setEditing(false);
          } catch (error) {
            emitActionFeedback({ message: errorMessage(error), kind: 'error' });
          }
        }}
      />
      {dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  identity: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[5] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
});
