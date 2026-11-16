import { router, useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/layout/app-header';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { toFormValues } from '@/domain/beneficiary';
import { BeneficiaryForm } from '@/features/beneficiaries/beneficiary-form';
import { confirmDuplicate, findPhoneConflict } from '@/features/beneficiaries/duplicate-check';
import { useBeneficiary } from '@/features/beneficiaries/use-beneficiaries';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { updateBeneficiary } from '@/services/beneficiaries/api';

export default function EditBeneficiaryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canEdit = useCan('beneficiaries_edit');
  const { beneficiary } = useBeneficiary(wid, id);

  return (
    <Screen header={<AppHeader title={t('beneficiaries.edit')} subtitle={beneficiary?.fullName} back />}>
      {!canEdit ? (
        <EmptyState title={t('common.notAllowed')} />
      ) : beneficiary === undefined ? (
        <LoadingState />
      ) : beneficiary === null ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <BeneficiaryForm
          wid={wid}
          defaultValues={toFormValues(beneficiary)}
          submitLabel={t('common.save')}
          onSubmit={async (value, place) => {
            const conflict = await findPhoneConflict(wid, value, beneficiary.id);
            if (conflict && !beneficiary.phoneDigits.includes(conflict.phone) && !(await confirmDuplicate(conflict.name))) {
              return;
            }
            updateBeneficiary(wid, beneficiary, value, place, actor);
            emitActionFeedback({ message: t('beneficiaries.saved'), kind: 'success' });
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
