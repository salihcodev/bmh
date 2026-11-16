import { router } from 'expo-router';
import { UserPlus } from 'lucide-react-native';

import { AppHeader } from '@/components/layout/app-header';
import { Fab, NoPermissionState, Screen } from '@/components/ui';
import { BeneficiaryList } from '@/features/beneficiaries/beneficiary-list';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';

export default function BeneficiariesScreen() {
  const { t } = useTranslation();
  const { wid, workspace } = useActiveWorkspace();
  const canView = useCan('beneficiaries_view');
  const canCreate = useCan('beneficiaries_create');
  const add = () => router.push('/beneficiaries/new');
  return (
    <Screen scroll={false} header={<AppHeader title={t('beneficiaries.title')} subtitle={workspace?.name} back />}>
      {canView ? (
        <BeneficiaryList
          wid={wid}
          emptyTitle={t('beneficiaries.emptyAll')}
          emptyAction={canCreate ? { label: t('beneficiaries.new'), onPress: add } : undefined}
        />
      ) : (
        <NoPermissionState />
      )}
      {canCreate ? <Fab label={t('beneficiaries.new')} icon={<UserPlus />} onPress={add} /> : null}
    </Screen>
  );
}
