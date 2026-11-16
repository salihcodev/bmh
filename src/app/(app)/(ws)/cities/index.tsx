import { router } from 'expo-router';
import { Building, Plus } from 'lucide-react-native';
import { useState } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { Badge, Button, Card, EmptyState, LoadingState, NavRow, PromptSheet, Screen } from '@/components/ui';
import { usePlaces } from '@/features/places/use-places';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { createCity } from '@/services/places/api';

export default function CitiesScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('areas_manage');
  const places = usePlaces(wid);
  const [adding, setAdding] = useState(false);

  return (
    <Screen header={<AppHeader title={t('cities.title')} back />}>
      {canManage ? (
        <Button title={t('cities.addCity')} icon={<Plus size={18} />} onPress={() => setAdding(true)} />
      ) : null}
      {places.loading ? (
        <LoadingState />
      ) : places.cities.length === 0 ? (
        <EmptyState title={t('cities.noCities')} />
      ) : (
        <Card style={{ marginTop: 16 }}>
          {places.cities.map((city) => {
            const areas = places.areasOf(city.id);
            const people = areas.reduce((sum, a) => sum + (a.beneficiaryCount ?? 0), 0);
            return (
              <NavRow
                key={city.id}
                icon={<Building size={20} color={colors.primary} />}
                label={city.name}
                hint={`${t('sessions.areasSelected', { count: areas.length })} · ${t('cities.beneficiaryCount', { count: people })}`}
                right={city.isArchived ? <Badge label={t('cities.archived')} tone="warning" /> : undefined}
                onPress={() => router.push(`/cities/${city.id}`)}
              />
            );
          })}
        </Card>
      )}
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
