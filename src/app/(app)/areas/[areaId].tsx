import { router, useLocalSearchParams } from 'expo-router';
import { Settings2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { Button, EmptyState, Fab, IconButton, LoadingState, PromptSheet, Screen, Sheet } from '@/components/ui';
import { BeneficiaryList } from '@/features/beneficiaries/beneficiary-list';
import { usePlaces } from '@/features/places/use-places';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { renameArea, setAreaActive, updateAreaDescription } from '@/services/places/api';
import { OfflineError } from '@/services/sync/connectivity';

export default function AreaScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('areas_manage');
  const canCreate = useCan('beneficiaries_create');
  const canView = useCan('beneficiaries_view');
  const places = usePlaces(wid);
  const area = places.areaById.get(areaId);
  const [sheet, setSheet] = useState<'menu' | 'rename' | 'description' | null>(null);

  if (places.loading || !area) {
    return (
      <Screen header={<AppHeader title={t('home.areasTitle')} back />}>
        {places.loading ? <LoadingState /> : <EmptyState title={t('common.empty')} />}
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      header={
        <AppHeader
          title={area.name}
          subtitle={`${area.cityName} · ${t('cities.beneficiaryCount', { count: area.beneficiaryCount ?? 0 })}`}
          back
          right={
            canManage ? (
              <IconButton icon={Settings2} label={t('common.more')} onPress={() => setSheet('menu')} />
            ) : undefined
          }
        />
      }
    >
      {canView ? <BeneficiaryList wid={wid} fixedAreaId={area.id} emptyTitle={t('beneficiaries.emptyArea')} /> : null}
      {canCreate && area.isActive ? (
        <Fab
          label={t('home.addBeneficiary')}
          icon={<UserPlus size={20} color={colors.onPrimary} />}
          onPress={() => router.push(`/(app)/beneficiaries/new?areaId=${area.id}`)}
        />
      ) : null}

      <Sheet visible={sheet === 'menu'} title={area.name} onClose={() => setSheet(null)}>
        <Button title={t('cities.rename')} variant="secondary" onPress={() => setSheet('rename')} />
        <Button title={t('cities.areaDescription')} variant="secondary" onPress={() => setSheet('description')} />
        <Button
          title={area.isActive ? t('cities.archive') : t('cities.restore')}
          variant={area.isActive ? 'danger' : 'secondary'}
          onPress={() => {
            setAreaActive(wid, area, !area.isActive);
            setSheet(null);
          }}
        />
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
          updateAreaDescription(wid, area, description);
          setSheet(null);
        }}
      />
    </Screen>
  );
}
