import { useLocalSearchParams } from 'expo-router';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/screen-header';
import { MapScreen } from '@/features/map/map-screen';
import { sessionMapPoints } from '@/features/map/session-points';
import { useSession, useSessionItems } from '@/features/sessions/use-sessions';
import { useTranslation } from '@/localization';
import { useActiveWorkspace } from '@/providers/workspace-provider';

export default function SessionMapRoute() {
  const { t } = useTranslation();
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { wid } = useActiveWorkspace();
  const session = useSession(wid, sid);
  const { items, error, retry } = useSessionItems(wid, sid);

  if (session === undefined || items === null) {
    return (
      <Screen scroll={false} header={<ScreenHeader title={t('map.sessionTitle')} back />}>
        {session === null ? <EmptyState title={t('common.empty')} /> : error ? null : <LoadingState />}
      </Screen>
    );
  }

  const { points, missingCount } = sessionMapPoints(items);
  return (
    <MapScreen
      title={session?.name ?? t('map.sessionTitle')}
      points={points}
      missingCount={missingCount}
      status={error ? 'error' : 'ready'}
      sessionMode
      onRetry={retry}
    />
  );
}
