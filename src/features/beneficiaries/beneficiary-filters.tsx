import { StyleSheet, View } from 'react-native';

import { AppText, Chip, FilterButton, FilterGroup, Switch } from '@/components/ui';
import type { City } from '@/domain/types';
import { useTranslation } from '@/localization';
import { spacing } from '@/theme';

type Area = { id: string; name: string };

export function BeneficiaryFilters({
  cities,
  areas,
  cityId,
  areaId,
  archived,
  hidePlaces,
  onCity,
  onArea,
  onArchived,
  onReset,
}: {
  cities: City[];
  areas: Area[];
  cityId: string | null;
  areaId: string | null;
  archived: boolean;
  hidePlaces?: boolean;
  onCity: (id: string | null) => void;
  onArea: (id: string | null) => void;
  onArchived: (value: boolean) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const active = (cityId && !hidePlaces ? 1 : 0) + (areaId && !hidePlaces ? 1 : 0) + (archived ? 1 : 0);
  return (
    <FilterButton activeCount={active} onReset={onReset}>
      {!hidePlaces ? (
        <>
          <FilterGroup label={t('beneficiaries.city')}>
            <Chip
              label={t('beneficiaries.filterCity')}
              selected={!cityId}
              onPress={() => {
                onCity(null);
                onArea(null);
              }}
            />
            {cities.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={cityId === c.id}
                onPress={() => {
                  onCity(c.id);
                  onArea(null);
                }}
              />
            ))}
          </FilterGroup>
          {cityId ? (
            <FilterGroup label={t('beneficiaries.area')}>
              <Chip label={t('beneficiaries.filterArea')} selected={!areaId} onPress={() => onArea(null)} />
              {areas.map((a) => (
                <Chip key={a.id} label={a.name} selected={areaId === a.id} onPress={() => onArea(a.id)} />
              ))}
            </FilterGroup>
          ) : null}
        </>
      ) : null}
      <View style={styles.toggleRow}>
        <AppText variant="bodyLg" style={styles.flex}>
          {t('beneficiaries.showArchived')}
        </AppText>
        <Switch label={t('beneficiaries.showArchived')} value={archived} onValueChange={onArchived} />
      </View>
    </FilterButton>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toggleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: 44,
  },
});
