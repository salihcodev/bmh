import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, FileText, MapPinned, Pencil, Settings2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';

import { ScreenHeader } from '@/components/layout/screen-header';
import { EmptyState, Fab, GroupedList, IconButton, ListRow, LoadingState, NoPermissionState, PromptSheet, Screen, Sheet } from '@/components/ui';
import { BeneficiaryList } from '@/features/beneficiaries/beneficiary-list';
import { usePlaces } from '@/features/places/use-places';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermission } from '@/providers/workspace-provider';
import { renameArea, setAreaActive, updateAreaDescription } from '@/services/places/api';
import { OfflineError } from '@/services/sync/connectivity';

export default function AreaScreen() {
  const { t } = useTranslation();
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canManage = usePermission('areas.edit');
  const canCreate = usePermission('beneficiaries.create');
  const canView = usePermission('beneficiaries.view');
  const places = usePlaces(wid);
  const area = places.areaById.get(areaId);
  const [sheet, setSheet] = useState<'menu' | 'rename' | 'description' | null>(null);
  const addHere = () => router.push(`/beneficiaries/new?areaId=${areaId}`);

  if (places.loading || !area) {
    return (
      <Screen header={<ScreenHeader title={t('home.areasTitle')} back />}>
        {places.loading ? <LoadingState /> : <EmptyState icon={MapPinned} title={t('common.empty')} />}
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title={area.name}
          subtitle={`${area.cityName} · ${t('cities.beneficiaryCount', { count: area.beneficiaryCount ?? 0 })}`}
          back
          actions={
            canManage ? (
              <IconButton icon={Settings2} label={t('common.more')} onPress={() => setSheet('menu')} />
            ) : undefined
          }
        />
      }
    >
      {canView ? (
        <BeneficiaryList
          wid={wid}
          fixedAreaId={area.id}
          emptyTitle={t('beneficiaries.emptyArea')}
          emptyAction={canCreate && area.isActive ? { label: t('home.addBeneficiary'), onPress: addHere } : undefined}
        />
      ) : (
        <NoPermissionState />
      )}
      {canCreate && area.isActive ? <Fab label={t('home.addBeneficiary')} icon={<UserPlus />} onPress={addHere} /> : null}

      <Sheet visible={sheet === 'menu'} title={area.name} onClose={() => setSheet(null)}>
        <GroupedList>
          <ListRow icon={Pencil} label={t('cities.rename')} chevron onPress={() => setSheet('rename')} />
          <ListRow icon={FileText} label={t('cities.areaDescription')} chevron onPress={() => setSheet('description')} />
          <ListRow
            icon={area.isActive ? Archive : ArchiveRestore}
            label={area.isActive ? t('cities.archive') : t('cities.restore')}
            destructive={area.isActive}
            onPress={() => {
              setAreaActive(wid, area, !area.isActive, actor);
              setSheet(null);
            }}
          />
        </GroupedList>
      </Sheet>
      <PromptSheet
        key={`rename-${sheet}`}
        visible={sheet === 'rename'}
        title={t('cities.rename')}
        hint={t('auth.needsConnection')}
        fields={[{ key: 'name', label: t('cities.areaName'), initial: area.name }]}
        onClose={() => setSheet(null)}
        onSubmit={async ({ name = '' }) => {
          try {
            const count = await renameArea(wid, area, name, actor);
            emitActionFeedback({ message: t('cities.renamed', { count }), kind: 'success' });
            setSheet(null);
          } catch (error) {
            emitActionFeedback({
              message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
              kind: 'error',
            });
          }
        }}
      />
      <PromptSheet
        key={`desc-${sheet}`}
        visible={sheet === 'description'}
        title={t('cities.areaDescription')}
        fields={[
          { key: 'description', label: t('cities.areaDescription'), initial: area.description ?? '', multiline: true, required: false, max: 500 },
        ]}
        onClose={() => setSheet(null)}
        onSubmit={({ description = '' }) => {
          updateAreaDescription(wid, area, description, actor);
          setSheet(null);
        }}
      />
    </Screen>
  );
}
