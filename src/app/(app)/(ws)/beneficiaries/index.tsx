import { router } from 'expo-router';
import { UserPlus } from 'lucide-react-native';

import { AppHeader } from '@/components/layout/app-header';
import { EmptyState, Fab, Screen } from '@/components/ui';
import { BeneficiaryList } from '@/features/beneficiaries/beneficiary-list';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';

export default function BeneficiariesTab() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, workspace } = useActiveWorkspace();
  const canView = useCan('beneficiaries_view');
  const canCreate = useCan('beneficiaries_create');
  return (
    <Screen scroll={false} header={<AppHeader title={t('beneficiaries.title')} subtitle={workspace?.name} />}>
      {canView ? (
        <BeneficiaryList wid={wid} emptyTitle={t('beneficiaries.emptyAll')} />
      ) : (
        <EmptyState title={t('common.notAllowed')} />
      )}
      {canCreate ? (
        <Fab
          label={t('beneficiaries.new')}
          icon={<UserPlus size={20} color={colors.onPrimary} />}
          onPress={() => router.push('/beneficiaries/new')}
        />
      ) : null}
    </Screen>
  );
}
