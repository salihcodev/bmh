import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { SearchX, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterGroup,
  InlineBanner,
  ListFooter,
  SearchField,
  SkeletonList,
  Switch,
  useDelayedLoading,
} from "@/components/ui";
import { planSearch } from "@/domain/search";
import { usePlaces } from "@/features/places/use-places";
import { useDebounced } from "@/hooks/use-debounced";
import { errorMessage } from "@/lib/action-feedback";
import { useTranslation } from "@/localization";
import { useConnectivity } from "@/services/sync/connectivity";
import { screenPadding, sizes, spacing } from "@/theme";

import { BeneficiaryRow } from "./beneficiary-row";
import { useBeneficiaryList } from "./use-beneficiaries";

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
  const [text, setText] = useState("");
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
  const showSkeleton = useDelayedLoading(list.status === "loading");
  const filtered = plan.kind !== "all" || !!cityId || !!areaId || archived;

  const activeFilters =
    (cityId && !fixedAreaId ? 1 : 0) +
    (areaId && !fixedAreaId ? 1 : 0) +
    (archived ? 1 : 0);
  const resetFilters = () => {
    setCityId(null);
    setAreaId(null);
    setArchived(false);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <SearchField
            placeholder={t("beneficiaries.searchPlaceholder")}
            value={text}
            onChangeText={setText}
            returnKeyType="search"
          />
        </View>
        <FilterButton activeCount={activeFilters} onReset={resetFilters}>
          {!fixedAreaId ? (
            <>
              <FilterGroup label={t("beneficiaries.city")}>
                <Chip
                  label={t("beneficiaries.filterCity")}
                  selected={!cityId}
                  onPress={() => {
                    setCityId(null);
                    setAreaId(null);
                  }}
                />
                {places.cities.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={cityId === c.id}
                    onPress={() => {
                      setCityId(c.id);
                      setAreaId(null);
                    }}
                  />
                ))}
              </FilterGroup>
              {cityId ? (
                <FilterGroup label={t("beneficiaries.area")}>
                  <Chip
                    label={t("beneficiaries.filterArea")}
                    selected={!areaId}
                    onPress={() => setAreaId(null)}
                  />
                  {places.areasOf(cityId, true).map((a) => (
                    <Chip
                      key={a.id}
                      label={a.name}
                      selected={areaId === a.id}
                      onPress={() => setAreaId(a.id)}
                    />
                  ))}
                </FilterGroup>
              ) : null}
            </>
          ) : null}
          <View style={styles.toggleRow}>
            <AppText variant="bodyLg" style={styles.flex}>
              {t("beneficiaries.showArchived")}
            </AppText>
            <Switch
              label={t("beneficiaries.showArchived")}
              value={archived}
              onValueChange={setArchived}
            />
          </View>
        </FilterButton>
      </View>
      {plan.kind === "invalidPhone" ? (
        <InlineBanner tone="warning" message={t("validation.phoneInvalid")} />
      ) : null}
      {/* One helper line. Every listener starts from the cache, so `fromCache` is briefly true on each
          load; tying the text to it swapped an animated banner in and out (FIX-04). */}
      <AppText variant="caption" tone="tertiary">
        {t(isOnline ? "beneficiaries.searchHint" : "beneficiaries.searchOfflineHint")}
      </AppText>
    </View>
  );

  if (list.status === "error") {
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
      {list.status === "loading" ? (
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
          renderItem={({ item }) => (
            <BeneficiaryRow
              item={item}
              onPress={() => router.push(`/beneficiaries/${item.id}`)}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            filtered ? (
              <EmptyState icon={SearchX} title={t("beneficiaries.noResults")} />
            ) : (
              <EmptyState
                icon={Users}
                title={emptyTitle}
                actionLabel={emptyAction?.label}
                onAction={emptyAction?.onPress}
              />
            )
          }
          ListFooterComponent={
            list.items?.length ? (
              <ListFooter
                loadingMore={list.loadingMore}
                error={list.moreError ? t("states.pageFailed") : null}
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
  header: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  toggleRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    minHeight: 44,
  },
  pad: { paddingHorizontal: screenPadding },
  list: {
    paddingHorizontal: screenPadding,
    paddingBottom: sizes.fab + spacing[10],
  },
  separator: { height: spacing[2] },
});
