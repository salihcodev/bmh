import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Chip, EmptyState, ErrorState, LoadingState, Row, SearchField, Select } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { planSearch } from '@/domain/search';
import { usePlaces } from '@/features/places/use-places';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebounced } from '@/hooks/use-debounced';
import { errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useConnectivity } from '@/services/sync/connectivity';

import { BeneficiaryRow } from './beneficiary-row';
import { useBeneficiaryList } from './use-beneficiaries';

const ALL = '__all__';

export function BeneficiaryList({
  wid,
  fixedAreaId,
  emptyTitle,
}: {
  wid: string;
  /** Area screens pin the area and hide place filters. */
  fixedAreaId?: string;
  emptyTitle: string;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const isOnline = useConnectivity((state) => state.isOnline);
  const places = usePlaces(wid);
  const [text, setText] = useState('');
  const [cityId, setCityId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const search = useDebounced(text, 300);
  const plan = useMemo(() => planSearch(search), [search]);

  const list = useBeneficiaryList(wid, {
    plan,
    cityId: fixedAreaId ? null : cityId,
    areaId: fixedAreaId ?? areaId,
    archived,
  });

  const header = (
    <View style={styles.header}>
      <SearchField
        placeholder={t('beneficiaries.searchPlaceholder')}
        value={text}
        onChangeText={setText}
        returnKeyType="search"
      />
      {!fixedAreaId ? (
        <Row gap={Spacing.sm}>
          <View style={styles.filter}>
            <Select
              label={t('beneficiaries.city')}
              value={cityId ?? ALL}
              options={[
                { value: ALL, label: t('beneficiaries.filterCity') },
                ...places.cities.map((c) => ({ value: c.id, label: c.name })),
              ]}
              onChange={(value) => {
                setCityId(value === ALL ? null : value);
                setAreaId(null);
              }}
            />
          </View>
          <View style={styles.filter}>
            <Select
              label={t('beneficiaries.area')}
              disabled={!cityId}
              value={areaId ?? ALL}
              options={[
                { value: ALL, label: t('beneficiaries.filterArea') },
                ...(cityId ? places.areasOf(cityId, true) : []).map((a) => ({ value: a.id, label: a.name })),
              ]}
              onChange={(value) => setAreaId(value === ALL ? null : value)}
            />
          </View>
        </Row>
      ) : null}
      <Row gap={Spacing.sm} wrap>
        <Chip label={t('beneficiaries.showArchived')} selected={archived} onPress={() => setArchived((v) => !v)} />
      </Row>
      <AppText variant="caption" muted>
        {!isOnline || list.fromCache ? t('beneficiaries.searchOfflineHint') : t('beneficiaries.searchHint')}
      </AppText>
      {plan.kind === 'invalidPhone' ? (
        <AppText variant="caption" style={{ color: colors.warning }}>
          {t('validation.phoneInvalid')}
        </AppText>
      ) : null}
    </View>
  );

  if (list.error && !list.items?.length) {
    return (
      <View style={styles.flex}>
        {header}
        <ErrorState message={errorMessage(list.error)} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {header}
      {list.items === null ? (
        <LoadingState />
      ) : (
        <FlashList
          data={list.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BeneficiaryRow item={item} onPress={() => router.push(`/beneficiaries/${item.id}`)} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => void list.loadMore()}
          ListEmptyComponent={
            <EmptyState title={plan.kind === 'all' ? emptyTitle : t('beneficiaries.noResults')} />
          }
          ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.xs },
  filter: { flex: 1 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
});
