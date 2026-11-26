import { MapPinOff, ShieldOff, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useTranslation } from '@/localization';
import { screenPadding, spacing } from '@/theme';
import type { LocationPermissionState } from '@/features/map/types/map.types';

export function MapPermissionBanner({
  permission,
  onSettings,
}: {
  permission: LocationPermissionState;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  if (permission === 'granted' || permission === 'unknown') return null;
  const key =
    permission === 'blocked' ? 'map.permissionBlocked' : permission === 'gpsOff' ? 'map.gpsOff' : 'map.permissionDenied';
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <AppText variant="bodySm" tone="secondary">
        {t(key)}
      </AppText>
      {permission === 'blocked' || permission === 'gpsOff' ? (
        <Button compact fullWidth={false} variant="ghost" title={t('map.openSettings')} onPress={onSettings} />
      ) : null}
    </View>
  );
}

export function MapEmptyPins() {
  const { t } = useTranslation();
  return <EmptyState icon={MapPinOff} title={t('map.emptyPins')} />;
}

export function MapOfflineTiles({ onOpenList }: { onOpenList: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={WifiOff}
      title={t('map.offlineTiles')}
      hint={t('map.offlineTilesHint')}
      actionLabel={t('map.showList')}
      onAction={onOpenList}
    />
  );
}

export function MapRoutingOffline() {
  const { t } = useTranslation();
  return (
    <View style={styles.banner}>
      <AppText variant="bodySm" tone="secondary">
        {t('map.routingOffline')}
      </AppText>
    </View>
  );
}

export function MapLoading() {
  return <LoadingState />;
}

export function MapLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return <ErrorState message={t('map.loadFailed')} onRetry={onRetry} />;
}

export function MapNoPermission() {
  const { t } = useTranslation();
  return <EmptyState icon={ShieldOff} title={t('common.notAllowed')} />;
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
});
