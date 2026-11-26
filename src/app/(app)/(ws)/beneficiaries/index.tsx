import { router } from 'expo-router';
import { Map as MapIcon, UserPlus } from 'lucide-react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Fab, IconButton, NoPermissionState, Screen } from '@/components/ui';
import { BeneficiaryList } from '@/features/beneficiaries/beneficiary-list';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission } from '@/providers/workspace-provider';

export default function BeneficiariesScreen() {
  const { t } = useTranslation();
  const { wid, workspace } = useActiveWorkspace();
  const canView = usePermission('beneficiaries.view');
  const canCreate = usePermission('beneficiaries.create');
  const add = () => router.push('/beneficiaries/new');
  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title={t('beneficiaries.title')}
          subtitle={workspace?.name}
          back
          actions={
            canView ? (
              <IconButton icon={MapIcon} label={t('map.title')} onPress={() => router.push('/map')} />
            ) : undefined
          }
        />
      }
    >
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
