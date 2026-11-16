import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  NavRow,
  PromptSheet,
  Row,
  Screen,
  Section,
} from '@/components/ui';
import { usePlaces } from '@/features/places/use-places';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { createArea, renameCity, setCityArchived } from '@/services/places/api';
import { OfflineError } from '@/services/sync/connectivity';

export default function CityScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const { wid, actor } = useActiveWorkspace();
  const canManage = useCan('areas_manage');
  const places = usePlaces(wid);
  const city = places.cityById.get(cityId);
  const [sheet, setSheet] = useState<'area' | 'rename' | null>(null);

  if (places.loading) {
    return (
      <Screen header={<AppHeader title={t('cities.title')} back />}>
        <LoadingState />
      </Screen>
    );
  }
  if (!city) {
    return (
      <Screen header={<AppHeader title={t('cities.title')} back />}>
        <EmptyState title={t('common.empty')} />
      </Screen>
    );
  }

  const areas = places.areasOf(city.id, true);

  return (
    <Screen header={<AppHeader title={city.name} back />}>
      {canManage ? (
        <Row wrap>
          <Button compact title={t('cities.addArea')} icon={<Plus size={16} />} onPress={() => setSheet('area')} />
          <Button
            compact
            variant="secondary"
            title={t('cities.rename')}
            icon={<Pencil size={16} />}
            onPress={() => setSheet('rename')}
          />
          <Button
            compact
            variant={city.isArchived ? 'secondary' : 'danger'}
            title={city.isArchived ? t('cities.restore') : t('cities.archive')}
            onPress={() => setCityArchived(wid, city, !city.isArchived)}
          />
        </Row>
      ) : null}
      <Section title={t('home.areasTitle')}>
        {areas.length === 0 ? (
          <AppText muted>{t('cities.noAreasInCity')}</AppText>
        ) : (
          <Card>
            {areas.map((area) => (
              <NavRow
                key={area.id}
                icon={<MapPin size={20} color={colors.primary} />}
                label={area.name}
                hint={t('cities.beneficiaryCount', { count: area.beneficiaryCount ?? 0 })}
                right={!area.isActive ? <Badge label={t('cities.archived')} tone="warning" /> : undefined}
                onPress={() => router.push(`/(app)/areas/${area.id}`)}
              />
            ))}
          </Card>
        )}
      </Section>

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
