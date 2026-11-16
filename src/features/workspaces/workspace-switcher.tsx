import { router } from 'expo-router';
import { Building2, Check, Plus, UserPlus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { BottomSheet, GroupedList, ListRow } from '@/components/ui';
import { useTranslation } from '@/localization';
import { useWorkspace } from '@/providers/workspace-provider';
import { iconStroke, sizes, spacing, useTheme } from '@/theme';

/** Bottom sheet listing the user's verified memberships, plus create/join. */
export function WorkspaceSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { memberships, workspaces, workspaceId, switchWorkspace } = useWorkspace();
  const go = (path: '/onboarding/create' | '/join') => {
    onClose();
    router.push(path);
  };
  return (
    <BottomSheet visible={visible} title={t('workspace.switch')} onClose={onClose}>
      <View style={styles.body}>
      <GroupedList>
        {memberships.map(({ workspaceId: wid, member }) => (
          <ListRow
            key={wid}
            icon={Building2}
            tile={wid === workspaceId ? 'lime' : 'muted'}
            label={workspaces[wid]?.name ?? '…'}
            hint={t(`workspace.role.${member.role}`)}
            right={wid === workspaceId ? <Check color={colors.textPrimary} size={sizes.icon} strokeWidth={iconStroke} /> : undefined}
            accessibilityLabel={workspaces[wid]?.name}
            onPress={() => {
              if (wid !== workspaceId) switchWorkspace(wid);
              onClose();
            }}
          />
        ))}
      </GroupedList>
      <GroupedList>
        <ListRow icon={Plus} label={t('workspace.create')} chevron onPress={() => go('/onboarding/create')} />
        <ListRow icon={UserPlus} label={t('workspace.join')} chevron onPress={() => go('/join')} />
      </GroupedList>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: spacing[4] } });
