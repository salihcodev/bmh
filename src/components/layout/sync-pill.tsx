import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Sheet } from '@/components/ui';
import { useTranslation } from '@/localization';
import { outbox } from '@/services/sync/outbox-runtime';
import { useSyncStatus } from '@/services/sync/sync-status';
import { useSyncStore } from '@/services/sync/sync-store';
import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';

export function SyncPill({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const status = useSyncStatus();
  const [open, setOpen] = useState(false);

  const tone = {
    offline: { bg: colors.warningTint, fg: colors.warning, Icon: CloudOff },
    syncing: { bg: colors.infoTint, fg: colors.info, Icon: RefreshCw },
    synced: { bg: colors.successTint, fg: colors.success, Icon: CheckCircle2 },
    error: { bg: colors.dangerTint, fg: colors.danger, Icon: AlertTriangle },
  }[status.state];

  let label: string;
  if (status.state === 'error') label = t('sync.problem');
  else if (status.state === 'offline')
    label = status.waiting > 0 ? `${t('sync.offline')} · ${t('sync.waiting', { count: status.waiting })}` : t('sync.offline');
  else if (status.state === 'syncing')
    label = status.waiting > 0 ? t('sync.waiting', { count: status.waiting }) : t('sync.syncing');
  else label = t('sync.synced');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[compact ? styles.square : styles.pill, { backgroundColor: tone.bg }]}
      >
        <tone.Icon size={compact ? sizes.icon : sizes.iconSm - 2} color={tone.fg} strokeWidth={iconStroke} />
        {compact ? null : (
          <AppText variant="caption" weight="medium" numberOfLines={1} style={{ color: tone.fg }}>
            {label}
          </AppText>
        )}
      </Pressable>
      <SyncSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SyncSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const status = useSyncStatus();
  const dismiss = useSyncStore((state) => state.dismiss);
  const failedJobs = status.jobs.filter((job) => job.status === 'failed');
  const pendingJobs = status.jobs.filter((job) => job.status === 'pending');

  return (
    <Sheet visible={visible} title={t('sync.sheetTitle')} onClose={onClose}>
      <AppText muted>{t('sync.appOpenHint')}</AppText>
      {status.previousRunPending && status.isOnline ? <AppText muted>{t('sync.previousRun')}</AppText> : null}
      {status.waiting > 0 ? <AppText>{t('sync.waiting', { count: status.waiting })}</AppText> : null}

      {status.failures.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="label">{t('sync.failuresTitle')}</AppText>
          {status.failures.map((failure) => (
            <Card key={failure.id} style={styles.item}>
              <AppText variant="label">{failure.label}</AppText>
              <AppText variant="caption" style={{ color: colors.danger }}>
                {failure.message}
              </AppText>
              <View style={styles.actions}>
                {failure.retry ? (
                  <Button
                    compact
                    title={t('sync.retry')}
                    onPress={() => {
                      dismiss(failure.id);
                      failure.retry?.();
                    }}
                  />
                ) : null}
                <Button compact variant="secondary" title={t('sync.dismiss')} onPress={() => dismiss(failure.id)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {pendingJobs.length + failedJobs.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="label">{t('sync.outboxTitle')}</AppText>
          {[...failedJobs, ...pendingJobs].map((job) => (
            <Card key={job.id} style={styles.item}>
              <AppText variant="label">{job.type}</AppText>
              {job.lastError ? (
                <AppText variant="caption" style={{ color: colors.danger }}>
                  {job.lastError}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <Button compact title={t('sync.retry')} onPress={() => { outbox.retry(job.id); void outbox.flush(); }} />
                <Button compact variant="secondary" title={t('sync.dismiss')} onPress={() => outbox.dismiss(job.id)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {status.state === 'synced' ? <AppText>{t('sync.noIssues')}</AppText> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  square: { width: sizes.iconButton, height: sizes.iconButton, borderRadius: radii.iconButton, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.pill,
    maxWidth: 260,
    alignSelf: 'flex-start',
  },
  group: { gap: spacing[2], marginTop: spacing[2] },
  item: { gap: spacing[1], marginBottom: 0 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
});
