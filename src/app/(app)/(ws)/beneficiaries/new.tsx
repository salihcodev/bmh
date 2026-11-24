import { router, useLocalSearchParams } from 'expo-router';
import { MapPinned } from 'lucide-react-native';
import { useMemo } from 'react';

import { ScreenHeader } from '@/components/layout/screen-header';
import { EmptyState, LoadingState, NoPermissionState, Screen } from '@/components/ui';
import { BeneficiaryForm, emptyBeneficiary } from '@/features/beneficiaries/beneficiary-form';
import { confirmDuplicate, findPhoneConflict } from '@/features/beneficiaries/duplicate-check';
import { usePlaces } from '@/features/places/use-places';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission } from '@/providers/workspace-provider';
import { createBeneficiary } from '@/services/beneficiaries/api';

export default function NewBeneficiaryScreen() {
  const { t } = useTranslation();
  const { areaId } = useLocalSearchParams<{ areaId?: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canCreate = usePermission('beneficiaries.create');
  const places = usePlaces(wid);
  const area = areaId ? places.areaById.get(areaId) : undefined;
  const defaults = useMemo(
    () => emptyBeneficiary(area ? { cityId: area.cityId, areaId: area.id } : {}),
    [area],
  );
  const header = <ScreenHeader title={t('beneficiaries.new')} subtitle={area?.name} back />;

  if (!canCreate || places.loading || places.activeCities.length === 0) {
    return (
      <Screen scroll={false} header={header}>
        {!canCreate ? (
          <NoPermissionState />
        ) : places.loading ? (
          <LoadingState />
        ) : (
          <EmptyState
            icon={MapPinned}
            title={t('cities.noCities')}
            actionLabel={t('home.manageAreas')}
            onAction={() => router.replace('/cities')}
          />
        )}
      </Screen>
    );
  }

  return (
    <BeneficiaryForm
      key={area?.id ?? 'global'}
      wid={wid}
      header={header}
      defaultValues={defaults}
      submitLabel={t('common.save')}
      onSubmit={async (value, place) => {
        const conflict = await findPhoneConflict(wid, value);
        if (conflict && !(await confirmDuplicate(conflict.name))) return;
        const id = createBeneficiary(wid, value, place, actor);
        emitActionFeedback({ message: t('beneficiaries.created'), kind: 'success' });
        router.replace(`/beneficiaries/${id}`);
      }}
    />
  );
}
