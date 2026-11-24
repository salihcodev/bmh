import { CheckCircle2, CircleAlert, Clock, RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, confirmAsync, EmptyState, SectionHeader } from '@/components/ui';
import { canDiscard, groupJobs, type QueueGroups } from '@/domain/sync-queue';
import { useTranslation } from '@/localization';
import { SystemMessage } from '@/services/content/system-message';
import { outbox } from '@/services/sync/outbox-runtime';
import type { OutboxJob } from '@/services/sync/outbox';
import { useSyncStatus } from '@/services/sync/sync-status';
import { useSyncStore } from '@/services/sync/sync-store';
import { spacing, useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

export const SYNC_INFO_KEY = 'sync_queue_info';

/** Name of a queued job: a known type, or the label a generic write carries. */
function useJobLabel() {
  const { t } = useTranslation();
  return (job: OutboxJob) => {
    const own = job.type === 'generic_write' ? (job.payload as { label?: string } | null)?.label : undefined;
    return own || t(`sync.jobs.${job.type}`, { defaultValue: t('sync.jobs.unknown') });
  };
}

/** The whole queue: server rejections from this run, then every outbox job by state. */
export function QueueView() {
  const { t } = useTranslation();
  const status = useSyncStatus();
  const groups = groupJobs(status.jobs);
  const dismissFailure = useSyncStore((state) => state.dismiss);
  const { failures } = status;
  const empty =
    failures.length === 0 && groups.failed.length + groups.syncing.length + groups.pending.length + groups.done.length === 0;
  const retryable = groups.failed.length;

  return (
    <View style={styles.root}>
      <SystemMessage messageKey={SYNC_INFO_KEY} fallback={t('sync.queueInfo')} />
      {status.previousRunPending && status.isOnline ? (
        <AppText variant="bodySm" tone="secondary">
          {t('sync.previousRun')}
        </AppText>
      ) : null}

      {empty ? <EmptyState icon={CheckCircle2} title={t('sync.queueEmpty')} hint={t('sync.noIssues')} /> : null}

      {failures.length > 0 ? (
        <View style={styles.group}>
          <SectionHeader title={t('sync.failuresTitle')} />
          {failures.map((failure) => (
            <Card key={failure.id} style={styles.item}>
              <AppText variant="label">{failure.label}</AppText>
              <ErrorText message={failure.message} />
              <AppText variant="caption" tone="tertiary">
                {formatDateTime(new Date(failure.at))}
              </AppText>
              <View style={styles.actions}>
                {failure.retry ? (
                  <Button
                    compact
                    fullWidth={false}
                    title={t('sync.retry')}
                    onPress={() => {
                      dismissFailure(failure.id);
                      failure.retry?.();
                    }}
                  />
                ) : null}
                <Button compact fullWidth={false} variant="secondary" title={t('sync.dismiss')} onPress={() => dismissFailure(failure.id)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <JobGroup titleKey="sync.groups.failed" jobs={groups.failed} state="failed" />
      <JobGroup titleKey="sync.groups.syncing" jobs={groups.syncing} state="syncing" />
      <JobGroup titleKey="sync.groups.pending" jobs={groups.pending} state="pending" />
      <JobGroup titleKey="sync.groups.done" jobs={groups.done} state="done" />

      {retryable > 1 ? (
        <Button
          icon={<RefreshCw />}
          variant="secondary"
          title={t('sync.retryAll', { count: retryable })}
          onPress={() => {
            outbox.retry();
            void outbox.flush();
          }}
        />
      ) : null}
      {groups.done.length > 0 ? (
        <Button variant="ghost" title={t('sync.clearDone')} onPress={() => outbox.clearDone()} />
      ) : null}
    </View>
  );
}

function ErrorText({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <AppText variant="caption" style={{ color: colors.danger }}>
      {message}
    </AppText>
  );
}

type State = keyof QueueGroups;

function JobGroup({ titleKey, jobs, state }: { titleKey: string; jobs: OutboxJob[]; state: State }) {
  const { t } = useTranslation();
  if (jobs.length === 0) return null;
  return (
    <View style={styles.group}>
      <SectionHeader title={`${t(titleKey)} · ${jobs.length}`} />
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} state={state} />
      ))}
    </View>
  );
}

const BADGE: Record<State, 'danger' | 'info' | 'warning' | 'success'> = {
  failed: 'danger',
  syncing: 'info',
  pending: 'warning',
  done: 'success',
};

function JobCard({ job, state }: { job: OutboxJob; state: State }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = useJobLabel()(job);
  const Icon = state === 'failed' ? CircleAlert : state === 'done' ? CheckCircle2 : Clock;
  const tone = state === 'failed' ? colors.danger : state === 'done' ? colors.success : colors.textSecondary;
  const when = state === 'done' ? job.finishedAt : job.createdAt;

  const discard = async () => {
    const ok = await confirmAsync({
      title: t('sync.discardTitle'),
      message: t('sync.discardBody'),
      confirmLabel: t('sync.discard'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) outbox.discard(job.id);
  };

  return (
    <Card style={styles.item}>
      <View style={styles.head}>
        <Icon size={18} color={tone} />
        <AppText variant="label" style={styles.title} numberOfLines={2}>
          {label}
        </AppText>
        <Badge tone={BADGE[state]} label={t(`sync.states.${state}`)} />
      </View>
      {job.lastError && state !== 'done' ? <ErrorText message={job.lastError} /> : null}
      <AppText variant="caption" tone="tertiary">
        {[when ? formatDateTime(new Date(when)) : '', job.attempts > 0 && state !== 'done' ? t('sync.attempts', { count: job.attempts }) : '']
          .filter(Boolean)
          .join(' · ')}
      </AppText>
      {state === 'failed' || state === 'pending' ? (
        <View style={styles.actions}>
          <Button
            compact
            fullWidth={false}
            title={t('sync.retry')}
            onPress={() => {
              outbox.retry(job.id);
              void outbox.flush();
            }}
          />
          {canDiscard(job) ? (
            <Button compact fullWidth={false} variant="secondary" title={t('sync.discard')} onPress={discard} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  group: { gap: spacing[2] },
  item: { gap: spacing[1], marginBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
});
