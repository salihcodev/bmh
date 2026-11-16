import { router } from 'expo-router';
import { Building2 } from 'lucide-react-native';

import { AppHeader } from '@/components/layout/app-header';
import { Button, EmptyState, Screen } from '@/components/ui';
import { useTranslation } from '@/localization';

/** Shown where a workspace is required but the user has none (they chose "later" in onboarding). */
export function NoWorkspaceScreen({ title, back = false }: { title: string; back?: boolean }) {
  const { t } = useTranslation();
  return (
    <Screen
      header={<AppHeader title={title} back={back} />}
      footer={<Button title={t('noWorkspace.join')} variant="secondary" onPress={() => router.push('/join')} />}
    >
      <EmptyState
        icon={Building2}
        title={t('noWorkspace.title')}
        hint={t('noWorkspace.hint')}
        actionLabel={t('noWorkspace.create')}
        onAction={() => router.push('/onboarding/create')}
      />
    </Screen>
  );
}
