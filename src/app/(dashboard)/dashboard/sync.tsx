import { Smartphone, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  ListFooter,
  LoadingState,
  Screen,
  StatCard,
  type BadgeTone,
} from '@/components/ui';
import { healthState, healthTotals, type HealthState } from '@/domain/sync-queue';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { deleteSyncHealth } from '@/services/admin/admin-writes';
import { useSyncHealth, type SyncHealthDevice } from '@/services/admin/use-admin';
import { spacing } from '@/theme';
import { formatDateTime, formatNumber } from '@/utils/format';

const TONE: Record<HealthState, BadgeTone> = { failing: 'danger', backlog: 'warning', ok: 'success', stale: 'neutral' };

export default function SyncHealthRoute() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('sync-queue.view')} fallback="/dashboard">
      <SyncHealthScreen />
    </PermissionGate>
  );
}

function SyncHealthScreen() {
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const { run } = useAdminAction();
  const page = useSyncHealth();
  const [clearing, setClearing] = useState<SyncHealthDevice | null>(null);
  const devices = useMemo(() => page.items ?? [], [page.items]);
  // Read once per mount (and on refresh) so a card's state does not flip while it is on screen.
  const [now] = useState(() => Date.now());
  const totals = useMemo(() => healthTotals(devices, now), [devices, now]);
  const canClear = can('sync-queue.manage');

  return (
    <Screen
      header={<ScreenHeader title={t('dashboard.syncTitle')} subtitle={t('dashboard.syncSubtitle')} back />}
      contentStyle={styles.content}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
    >
      <AppText variant="body" tone="secondary">
        {t('dashboard.syncBody')}
      </AppText>
      {page.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={page.refresh} />
      ) : page.status === 'loading' ? (
        <LoadingState />
      ) : (
        <>
          <View style={styles.stats}>
            <View style={styles.tile}>
              <StatCard value={formatNumber(totals.devices)} label={t('dashboard.syncDevices')} tone="lime" />
            </View>
            <View style={styles.tile}>
              <StatCard value={formatNumber(totals.pending)} label={t('dashboard.syncPending')} tone="surface" />
            </View>
            <View style={styles.tile}>
              <StatCard value={formatNumber(totals.failed)} label={t('dashboard.syncFailed')} tone="surface" />
            </View>
          </View>
          {devices.length === 0 ? (
            <EmptyState icon={Smartphone} title={t('dashboard.syncEmpty')} />
          ) : (
            devices.map((device) => (
              <DeviceCard key={device.id} device={device} now={now} onClear={canClear ? () => setClearing(device) : undefined} />
            ))
          )}
          {devices.length > 0 ? <ListFooter loadingMore={page.loadingMore} error={null} done={page.done} onRetry={page.loadMore} /> : null}
        </>
      )}
      <ConfirmDialog
        visible={!!clearing}
        title={t('dashboard.syncClearTitle')}
        message={t('dashboard.syncClearBody')}
        confirmLabel={t('dashboard.syncClear')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setClearing(null)}
        onConfirm={async () => {
          const device = clearing;
          setClearing(null);
          if (device) await run((actor) => deleteSyncHealth(actor, device.id, device.deviceId), t('dashboard.deletedDone'));
        }}
      />
    </Screen>
  );
}

function DeviceCard({ device, now, onClear }: { device: SyncHealthDevice; now: number; onClear?: () => void }) {
  const { t } = useTranslation();
  const state = healthState(device, now);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="label" ltr numberOfLines={1}>
            {`${device.platform || '?'} ${device.appVersion}`.trim()}
          </AppText>
          <AppText variant="caption" tone="tertiary" ltr numberOfLines={1}>
            {`${device.uid.slice(0, 8)}… · ${device.deviceId}`}
          </AppText>
        </View>
        <Badge tone={TONE[state]} label={t(`dashboard.syncState.${state}`)} />
        {onClear && state === 'stale' ? (
          <IconButton icon={Trash2} label={t('dashboard.syncClear')} onPress={onClear} />
        ) : null}
      </View>
      <AppText variant="bodySm" tone="secondary">
        {t('dashboard.syncCounts', { pending: formatNumber(device.pending), failed: formatNumber(device.failed) })}
      </AppText>
      <AppText variant="caption" tone="tertiary">
        {device.updatedAt ? t('dashboard.syncUpdated', { time: formatDateTime(new Date(device.updatedAt)) }) : ''}
        {device.oldestPendingAt ? ` · ${t('dashboard.syncOldest', { time: formatDateTime(new Date(device.oldestPendingAt)) })}` : ''}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  stats: { flexDirection: 'row', gap: spacing[2] },
  tile: { flex: 1, minWidth: 0 },
  card: { gap: spacing[2], marginBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  titles: { flex: 1, gap: spacing[1] },
});
