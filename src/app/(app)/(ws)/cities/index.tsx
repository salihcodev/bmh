import { router } from 'expo-router';
import { Building, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  Badge,
  EmptyState,
  ErrorState,
  Fab,
  GroupedList,
  ListRow,
  PromptSheet,
  Screen,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { usePlaces } from '@/features/places/use-places';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { createCity } from '@/services/places/api';
import { spacing } from '@/theme';

export default function CitiesScreen() {
  const { t } = useTranslation();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('areas_manage');
  const places = usePlaces(wid);
  const showSkeleton = useDelayedLoading(places.loading);
  const [adding, setAdding] = useState(false);

  return (
    <Screen header={<AppHeader title={t('cities.title')} back />} scroll={!places.loading && places.cities.length > 0}>
      {places.loading ? (
        showSkeleton ? <SkeletonList /> : null
      ) : places.error ? (
        <ErrorState message={t('states.loadFailed')} onRetry={places.retry} />
      ) : places.cities.length === 0 ? (
        <EmptyState
          icon={Building}
          title={t('cities.noCities')}
          actionLabel={canManage ? t('cities.addCity') : undefined}
          onAction={canManage ? () => setAdding(true) : undefined}
        />
      ) : (
        <View style={styles.gap}>
          <GroupedList>
            {places.cities.map((city) => {
              const areas = places.areasOf(city.id);
              const people = areas.reduce((sum, a) => sum + (a.beneficiaryCount ?? 0), 0);
              return (
                <ListRow
                  key={city.id}
                  icon={Building}
                  label={city.name}
                  hint={`${t('sessions.areasSelected', { count: areas.length })} · ${t('cities.beneficiaryCount', { count: people })}`}
                  right={city.isArchived ? <Badge label={t('cities.archived')} tone="warning" /> : undefined}
                  onPress={() => router.push(`/cities/${city.id}`)}
                />
              );
            })}
          </GroupedList>
        </View>
      )}
      {canManage && places.cities.length > 0 ? <Fab label={t('cities.addCity')} icon={<Plus />} onPress={() => setAdding(true)} /> : null}
      <PromptSheet
        key={adding ? 'open' : 'closed'}
        visible={adding}
        title={t('cities.addCity')}
        fields={[{ key: 'name', label: t('cities.cityName') }]}
        onClose={() => setAdding(false)}
        onSubmit={({ name = '' }) => {
          createCity(wid, name, actor);
          emitActionFeedback({ message: t('cities.saved'), kind: 'success' });
          setAdding(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing[4] },
});
