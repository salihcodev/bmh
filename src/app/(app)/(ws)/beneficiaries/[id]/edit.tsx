import { router, useLocalSearchParams } from 'expo-router';
import { UserX } from 'lucide-react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { EmptyState, LoadingState, NoPermissionState, Screen } from '@/components/ui';
import { toFormValues } from '@/domain/beneficiary';
import { BeneficiaryForm } from '@/features/beneficiaries/beneficiary-form';
import { confirmDuplicate, findPhoneConflict } from '@/features/beneficiaries/duplicate-check';
import { useBeneficiary } from '@/features/beneficiaries/use-beneficiaries';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission } from '@/providers/workspace-provider';
import { updateBeneficiary } from '@/services/beneficiaries/api';

export default function EditBeneficiaryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canEdit = usePermission('beneficiaries.edit');
  const { beneficiary } = useBeneficiary(wid, id);
  const header = <ScreenHeader title={t('beneficiaries.edit')} subtitle={beneficiary?.fullName} back />;

  if (!canEdit || !beneficiary) {
    return (
      <Screen scroll={false} header={header}>
        {!canEdit ? (
          <NoPermissionState />
        ) : beneficiary === undefined ? (
          <LoadingState />
        ) : (
          <EmptyState icon={UserX} title={t('common.empty')} />
        )}
      </Screen>
    );
  }

  return (
    <BeneficiaryForm
      wid={wid}
      header={header}
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
  );
}
