import { useMemo } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { EventRow } from '@/features/history/event-row';
import { usePagedEvents } from '@/features/history/use-paged-events';
import { errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace } from '@/providers/workspace-provider';
import { refs } from '@/services/firebase/refs';

export default function AuditScreen() {
  const { t } = useTranslation();
  const { wid } = useActiveWorkspace();
  const ref = useMemo(() => (wid ? refs.audit(wid) : null), [wid]);
  const { events, loading, done, error, loadMore, refresh } = usePagedEvents(ref);

  return (
    <Screen header={<AppHeader title={t('workspace.auditLog')} back />} refreshing={loading} onRefresh={refresh}>
      {error ? (
        <ErrorState message={errorMessage(error)} retryLabel={t('common.retry')} onRetry={refresh} />
      ) : events.length === 0 && loading ? (
        <LoadingState />
      ) : events.length === 0 ? (
        <EmptyState title={t('home.noActivity')} />
      ) : (
        <Card>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
          {!done ? <Button title={t('common.loadMore')} variant="ghost" onPress={loadMore} /> : null}
        </Card>
      )}
    </Screen>
  );
}
