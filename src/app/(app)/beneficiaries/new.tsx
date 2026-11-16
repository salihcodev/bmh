import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { BeneficiaryForm, emptyBeneficiary } from '@/features/beneficiaries/beneficiary-form';
import { confirmDuplicate, findPhoneConflict } from '@/features/beneficiaries/duplicate-check';
import { usePlaces } from '@/features/places/use-places';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { createBeneficiary } from '@/services/beneficiaries/api';

export default function NewBeneficiaryScreen() {
  const { t } = useTranslation();
  const { areaId } = useLocalSearchParams<{ areaId?: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canCreate = useCan('beneficiaries_create');
  const places = usePlaces(wid);
  const area = areaId ? places.areaById.get(areaId) : undefined;
  const defaults = useMemo(
    () => emptyBeneficiary(area ? { cityId: area.cityId, areaId: area.id } : {}),
    [area],
  );

  return (
    <Screen header={<AppHeader title={t('beneficiaries.new')} subtitle={area?.name} back />}>
      {!canCreate ? (
        <EmptyState title={t('common.notAllowed')} />
      ) : places.loading ? (
        <LoadingState />
      ) : places.activeCities.length === 0 ? (
        <EmptyState
          title={t('cities.noCities')}
          actionLabel={t('home.manageAreas')}
          onAction={() => router.replace('/(app)/cities')}
        />
      ) : (
        <BeneficiaryForm
          key={area?.id ?? 'global'}
          wid={wid}
          defaultValues={defaults}
          submitLabel={t('common.save')}
          onSubmit={async (value, place) => {
            const conflict = await findPhoneConflict(wid, value);
            if (conflict && !(await confirmDuplicate(conflict.name))) return;
            const id = createBeneficiary(wid, value, place, actor);
            emitActionFeedback({ message: t('beneficiaries.created'), kind: 'success' });
            router.replace(`/(app)/beneficiaries/${id}`);
          }}
        />
      )}
    </Screen>
  );
}
