import { FlashList } from '@shopify/flash-list';
import { Download, Rows3, ScrollText, StretchHorizontal } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  BottomSheet,
  Chip,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterGroup,
  IconButton,
  ListFooter,
  ListRow,
  GroupedList,
  Screen,
  SearchBar,
  SelectField,
  SkeletonList,
  useDelayedLoading,
  useToast,
} from '@/components/ui';
import {
  activeFilterCount,
  ADMIN_ACTIONS,
  ADMIN_TARGETS,
  AUDIT_EXPORT_COLUMNS,
  auditExportRow,
  DATE_RANGES,
  distinctActors,
  EMPTY_AUDIT_FILTERS,
  hasAuditFilters,
  matchesAuditFilters,
  rangeStart,
  serverFilter,
  type AuditEntry,
  type AuditFilters,
  type DateRange,
} from '@/domain/audit-log';
import type { ExportDoc, ExportFormat } from '@/domain/export';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useDebounced } from '@/hooks/use-debounced';
import { errorMessage } from '@/lib/action-feedback';
import { isRTLLanguage, useTranslation } from '@/localization';
import { logAuditExport } from '@/services/admin/admin-writes';
import { useAdminAudit } from '@/services/admin/use-admin';
import { shareExport } from '@/services/export/api';
import { usePreferences } from '@/store/preferences';
import { screenPadding, spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

import { AuditRow } from './audit-row';

const ANY = '__any__';
/** While filters hide everything the server returned, keep paging up to this many times. */
const MAX_AUTO_PAGES = 8;
const MIN_VISIBLE = 12;

/** Start of a date range as of this moment. Called from handlers, so the render stays pure. */
function startOf(range: DateRange): number | null {
  return rangeStart(range, Date.now());
}

export function AuditLogScreen() {
  const { t, i18n } = useTranslation();
  const { can } = useCurrentUser();
  const { run } = useAdminAction();
  const { showToast } = useToast();
  const density = usePreferences((state) => state.auditDensity);
  const setDensity = usePreferences((state) => state.setAuditDensity);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [exportOpen, setExportOpen] = useState(false);
  const search = useDebounced(filters.search, 250);
  // One fixed start per range choice, so the query is not rebuilt as the minutes pass.
  const [since, setSince] = useState<number | null>(null);
  const page = useAdminAudit(filters, since);
  const showSkeleton = useDelayedLoading(page.status === 'loading');
  const applied = useMemo(() => ({ ...filters, search }), [filters, search]);

  const label = (action: string) => t(`manage.audit.actions.${action}`, { defaultValue: t('manage.audit.actions.unknown') });
  const entity = (type: string) => t(`manage.audit.entities.${type}`, { defaultValue: type });

  const loaded = useMemo(() => page.items ?? [], [page.items]);
  const rows = useMemo(
    () => loaded.filter((entry) => matchesAuditFilters(entry, applied, since, label(entry.action))),
    // `label` depends on the language only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, applied, since, i18n.language],
  );

  // Filters Firestore cannot run (a second equality, the search) can hide a whole page: keep paging.
  const autoPages = useRef(0);
  const filterKey = `${serverFilter(applied)?.value ?? ''}|${applied.actorId}|${applied.action}|${applied.entity}|${applied.range}|${applied.search}`;
  useEffect(() => {
    autoPages.current = 0;
  }, [filterKey]);
  useEffect(() => {
    if (page.status !== 'ready' || page.done || page.loadingMore || page.moreError) return;
    if (loaded.length === 0 || rows.length >= MIN_VISIBLE || autoPages.current >= MAX_AUTO_PAGES) return;
    if (!hasAuditFilters(applied)) return;
    autoPages.current += 1;
    void page.loadMore();
  }, [page, loaded.length, rows.length, applied]);

  const actors = useMemo(() => {
    const list = distinctActors(loaded);
    if (filters.actorId && !list.some((actor) => actor.id === filters.actorId)) list.push({ id: filters.actorId, name: filters.actorId });
    return list;
  }, [loaded, filters.actorId]);

  const patch = (change: Partial<AuditFilters>) => setFilters((current) => ({ ...current, ...change }));
  const chooseRange = (range: DateRange) => {
    setFilters((current) => ({ ...current, range }));
    setSince(startOf(range));
  };
  const resetFilters = (keepSearch: boolean) => {
    setFilters((current) => ({ ...EMPTY_AUDIT_FILTERS, search: keepSearch ? current.search : '' }));
    setSince(null);
  };
  const filtered = hasAuditFilters(filters);

  const doExport = async (format: ExportFormat) => {
    setExportOpen(false);
    if (rows.length === 0) {
      showToast({ kind: 'warning', message: t('manage.audit.exportEmpty') });
      return;
    }
    try {
      await shareExport(buildDoc(rows, t, label, entity), format, {
        baseName: t('manage.audit.title'),
        rtl: isRTLLanguage(i18n.language === 'en' ? 'en' : 'ar'),
        dialogTitle: t('manage.audit.title'),
      });
      await run((actor) => logAuditExport(actor, { format, rows: rows.length, filtered }));
    } catch (error) {
      showToast({
        kind: 'error',
        message: error instanceof Error && error.message === 'share_unavailable' ? t('export.shareUnavailable') : errorMessage(error),
      });
    }
  };

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title={t('manage.audit.title')}
          subtitle={t('manage.audit.subtitle')}
          back
          actions={
            <>
              <IconButton
                icon={density === 'compact' ? StretchHorizontal : Rows3}
                label={t(density === 'compact' ? 'manage.audit.showDetailed' : 'manage.audit.showCompact')}
                onPress={() => setDensity(density === 'compact' ? 'detailed' : 'compact')}
              />
              {can('logs.export') ? (
                <IconButton icon={Download} label={t('manage.audit.export')} onPress={() => setExportOpen(true)} />
              ) : null}
            </>
          }
        />
      }
    >
      <View style={styles.bar}>
        <View style={styles.search}>
          <SearchBar
            value={filters.search}
            onChangeText={(value) => patch({ search: value })}
            placeholder={t('manage.audit.search')}
          />
        </View>
        <FilterButton activeCount={activeFilterCount(filters)} onReset={() => resetFilters(true)}>
          <FilterGroup label={t('manage.audit.filterDate')}>
            {DATE_RANGES.map((range: DateRange) => (
              <Chip key={range} label={t(`manage.audit.range.${range}`)} selected={filters.range === range} onPress={() => chooseRange(range)} />
            ))}
          </FilterGroup>
          <FilterGroup label={t('manage.audit.filterEntity')}>
            {ADMIN_TARGETS.map((target) => (
              <Chip
                key={target}
                label={entity(target)}
                selected={filters.entity === target}
                onPress={() => patch({ entity: filters.entity === target ? null : target })}
              />
            ))}
          </FilterGroup>
          <SelectField
            label={t('manage.audit.filterAction')}
            value={filters.action ?? ANY}
            options={[{ value: ANY, label: t('manage.audit.anyAction') }, ...ADMIN_ACTIONS.map((action) => ({ value: action, label: label(action) }))]}
            onChange={(value) => patch({ action: value === ANY ? null : value })}
          />
          <SelectField
            label={t('manage.audit.filterActor')}
            value={filters.actorId ?? ANY}
            options={[{ value: ANY, label: t('manage.audit.anyActor') }, ...actors.map((actor) => ({ value: actor.id, label: actor.name }))]}
            onChange={(value) => patch({ actorId: value === ANY ? null : value })}
          />
        </FilterButton>
      </View>

      {page.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : page.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={page.refresh} />
      ) : (
        <FlashList
          data={rows}
          extraData={density}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          onEndReached={page.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={page.refreshing}
          onRefresh={page.refresh}
          renderItem={({ item }) => <AuditRow entry={item} density={density} />}
          ListEmptyComponent={
            <EmptyState
              icon={ScrollText}
              title={t(filtered ? 'manage.audit.noMatches' : 'manage.audit.empty')}
              actionLabel={filtered ? t('common.resetFilters') : undefined}
              onAction={filtered ? () => resetFilters(false) : undefined}
            />
          }
          ListFooterComponent={
            loaded.length ? (
              <ListFooter
                loadingMore={page.loadingMore}
                error={page.moreError ? t('states.pageFailed') : null}
                done={page.done}
                onRetry={page.loadMore}
              />
            ) : null
          }
        />
      )}

      <BottomSheet visible={exportOpen} title={t('manage.audit.export')} onClose={() => setExportOpen(false)}>
        <View style={styles.sheet}>
          <AppText variant="bodySm" tone="secondary">
            {t('manage.audit.exportHint', { count: rows.length })}
          </AppText>
          <GroupedList>
            {(['xlsx', 'csv', 'pdf'] as const).map((format) => (
              <ListRow key={format} label={format.toUpperCase()} chevron onPress={() => void doExport(format)} />
            ))}
          </GroupedList>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function buildDoc(
  rows: AuditEntry[],
  t: (key: string, options?: Record<string, unknown>) => string,
  actionLabel: (action: string) => string,
  entityLabel: (type: string) => string,
): ExportDoc {
  const helpers = { actionLabel, entityLabel, dateTime: (ms: number) => formatDateTime(new Date(ms)) };
  return {
    title: t('manage.audit.title'),
    generatedAt: formatDateTime(new Date()),
    sections: [
      {
        columns: AUDIT_EXPORT_COLUMNS.map((key) => ({ key, label: t(`manage.audit.columns.${key}`) })),
        rows: rows.map((entry) => auditExportRow(entry, helpers)),
      },
    ],
  };
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: screenPadding, paddingBottom: spacing[3] },
  search: { flex: 1 },
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[10] },
  separator: { height: spacing[2] },
  sheet: { gap: spacing[3] },
});
