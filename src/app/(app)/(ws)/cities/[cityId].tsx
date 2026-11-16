import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, MapPin, MapPinned, Pencil, Plus, Settings2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Fab,
  GroupedList,
  IconButton,
  ListRow,
  LoadingState,
  PromptSheet,
  Screen,
  SectionHeader,
  Sheet,
} from '@/components/ui';
import { usePlaces } from '@/features/places/use-places';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { createArea, renameCity, setCityArchived } from '@/services/places/api';
import { OfflineError } from '@/services/sync/connectivity';
import { spacing } from '@/theme';

export default function CityScreen() {
  const { t } = useTranslation();
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('areas_manage');
  const places = usePlaces(wid);
  const city = places.cityById.get(cityId);
  const [sheet, setSheet] = useState<'menu' | 'area' | 'rename' | 'archive' | null>(null);

  if (places.loading || places.error || !city) {
    return (
      <Screen scroll={false} header={<AppHeader title={t('cities.title')} back />}>
        {places.loading ? (
          <LoadingState />
        ) : places.error ? (
          <ErrorState message={t('states.loadFailed')} onRetry={places.retry} />
        ) : (
          <EmptyState icon={MapPinned} title={t('common.empty')} />
        )}
      </Screen>
    );
  }

  const areas = places.areasOf(city.id, true);

  return (
    <Screen
      header={
        <AppHeader
          title={city.name}
          subtitle={city.isArchived ? t('cities.archived') : undefined}
          back
          right={
            canManage ? (
              <IconButton icon={Settings2} label={t('common.more')} onPress={() => setSheet('menu')} />
            ) : undefined
          }
        />
      }
      contentStyle={styles.content}
    >
      <View>
        <SectionHeader title={t('home.areasTitle')} />
        {areas.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={t('cities.noAreasInCity')}
            actionLabel={canManage ? t('cities.addArea') : undefined}
            onAction={canManage ? () => setSheet('area') : undefined}
          />
        ) : (
          <GroupedList>
            {areas.map((area) => (
              <ListRow
                key={area.id}
                icon={MapPin}
                label={area.name}
                hint={t('cities.beneficiaryCount', { count: area.beneficiaryCount ?? 0 })}
                right={!area.isActive ? <Badge label={t('cities.archived')} tone="warning" /> : undefined}
                onPress={() => router.push(`/areas/${area.id}`)}
              />
            ))}
          </GroupedList>
        )}
      </View>

      {canManage && areas.length > 0 ? <Fab label={t('cities.addArea')} icon={<Plus />} onPress={() => setSheet('area')} /> : null}

      <Sheet visible={sheet === 'menu'} title={city.name} onClose={() => setSheet(null)}>
        <GroupedList>
          <ListRow icon={Plus} label={t('cities.addArea')} chevron onPress={() => setSheet('area')} />
          <ListRow icon={Pencil} label={t('cities.rename')} chevron onPress={() => setSheet('rename')} />
          <ListRow
            icon={city.isArchived ? ArchiveRestore : Archive}
            label={city.isArchived ? t('cities.restore') : t('cities.archive')}
            destructive={!city.isArchived}
            onPress={() => setSheet('archive')}
          />
        </GroupedList>
      </Sheet>
      <ConfirmDialog
        visible={sheet === 'archive'}
        title={city.isArchived ? t('cities.restore') : t('cities.archive')}
        confirmLabel={city.isArchived ? t('cities.restore') : t('cities.archive')}
        cancelLabel={t('common.cancel')}
        destructive={!city.isArchived}
        onCancel={() => setSheet(null)}
        onConfirm={() => {
          setCityArchived(wid, city, !city.isArchived);
          setSheet(null);
        }}
      />
      <PromptSheet
        key={`area-${sheet}`}
        visible={sheet === 'area'}
        title={t('cities.addArea')}
        fields={[
          { key: 'name', label: t('cities.areaName') },
          { key: 'description', label: t('cities.areaDescription'), multiline: true, required: false, max: 500 },
        ]}
        onClose={() => setSheet(null)}
        onSubmit={({ name = '', description }) => {
          createArea(wid, city, { name, description }, actor);
          emitActionFeedback({ message: t('cities.saved'), kind: 'success' });
          setSheet(null);
        }}
      />
      <PromptSheet
        key={`rename-${sheet}`}
        visible={sheet === 'rename'}
        title={t('cities.rename')}
        hint={t('auth.needsConnection')}
        fields={[{ key: 'name', label: t('cities.cityName'), initial: city.name }]}
        onClose={() => setSheet(null)}
        onSubmit={async ({ name = '' }) => {
          try {
            const count = await renameCity(wid, city, name, actor);
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
});
