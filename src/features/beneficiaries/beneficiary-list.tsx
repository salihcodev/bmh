import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { SearchX, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  InlineBanner,
  ListFooter,
  SearchField,
  Select,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import { planSearch } from '@/domain/search';
import { usePlaces } from '@/features/places/use-places';
import { useDebounced } from '@/hooks/use-debounced';
import { errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useConnectivity } from '@/services/sync/connectivity';
import { screenPadding, sizes, spacing } from '@/theme';

import { BeneficiaryRow } from './beneficiary-row';
import { useBeneficiaryList } from './use-beneficiaries';

const ALL = '__all__';

export function BeneficiaryList({
  wid,
  fixedAreaId,
  emptyTitle,
  emptyAction,
}: {
  wid: string;
  /** Area screens pin the area and hide place filters. */
  fixedAreaId?: string;
  emptyTitle: string;
  emptyAction?: { label: string; onPress: () => void };
}) {
  const { t } = useTranslation();
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
  const showSkeleton = useDelayedLoading(list.status === 'loading');
  const filtered = plan.kind !== 'all' || !!cityId || !!areaId || archived;

  const header = (
    <View style={styles.header}>
      <SearchField
        placeholder={t('beneficiaries.searchPlaceholder')}
        value={text}
        onChangeText={setText}
        returnKeyType="search"
      />
      {!fixedAreaId ? (
        <View style={styles.filters}>
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
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip label={t('beneficiaries.showArchived')} selected={archived} onPress={() => setArchived((v) => !v)} />
      </View>
      {plan.kind === 'invalidPhone' ? <InlineBanner tone="warning" message={t('validation.phoneInvalid')} /> : null}
      {!isOnline || list.fromCache ? (
        <InlineBanner tone="offline" message={t('beneficiaries.searchOfflineHint')} />
      ) : (
        <AppText variant="caption" tone="tertiary">
          {t('beneficiaries.searchHint')}
        </AppText>
      )}
    </View>
  );

  if (list.status === 'error') {
    return (
      <View style={styles.flex}>
        {header}
        <ErrorState message={errorMessage(list.error)} onRetry={list.refresh} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {header}
      {list.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : (
        <FlashList
          data={list.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => <BeneficiaryRow item={item} onPress={() => router.push(`/beneficiaries/${item.id}`)} />}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            filtered ? (
              <EmptyState icon={SearchX} title={t('beneficiaries.noResults')} />
            ) : (
              <EmptyState icon={Users} title={emptyTitle} actionLabel={emptyAction?.label} onAction={emptyAction?.onPress} />
            )
          }
          ListFooterComponent={
            list.items?.length ? (
              <ListFooter
                loadingMore={list.loadingMore}
                error={list.moreError ? t('states.pageFailed') : null}
                done={list.done}
                onRetry={list.loadMore}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: screenPadding, paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[2] },
  filters: { flexDirection: 'row', gap: spacing[2] },
  filter: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: sizes.fab + spacing[10] },
  separator: { height: spacing[2] },
});
