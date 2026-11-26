import { MapScreen } from '@/features/map/map-screen';
import { useMapBeneficiaries } from '@/features/map/hooks/useMapBeneficiaries';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission } from '@/providers/workspace-provider';

export default function WorkspaceMapRoute() {
  const { t } = useTranslation();
  const { wid } = useActiveWorkspace();
  const canView = usePermission('beneficiaries.view');
  const list = useMapBeneficiaries(wid, canView);
  return (
    <MapScreen
      title={t('map.title')}
      points={list.points}
      missingCount={list.missingPin.length}
      status={list.status}
      sessionMode={false}
    />
  );
}
