import { Redirect } from 'expo-router';

import { BrandLoading } from '@/components/brand/brand-loading';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Screen } from '@/components/ui';
import { routeFor } from '@/domain/route-guard';
import { QueueView } from '@/features/sync/queue-view';
import { useRouteGuard } from '@/hooks/use-route-guard';
import { useTranslation } from '@/localization';

/**
 * The sync queue as a screen (the sheet from the header chip links here). It sits outside the app
 * and dashboard groups because both sides open it, including staff who never see the app tabs.
 */
export default function SyncQueueRoute() {
  const { t } = useTranslation();
  const guard = useRouteGuard();
  if (guard.kind === 'loading') return <BrandLoading />;
  if (guard.kind !== 'app' && guard.kind !== 'dashboard') return <Redirect href={routeFor(guard)!} />;
  return (
    <Screen header={<ScreenHeader title={t('sync.queueTitle')} back sync={false} />}>
      <QueueView />
    </Screen>
  );
}
