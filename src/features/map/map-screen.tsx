import { Crosshair, Map as MapIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText, IconButton, NoPermissionState, Screen } from '@/components/ui';
import { mapConfig } from '@/features/map/config/map.config';
import { MapCanvas, type MapCanvasHandle } from '@/features/map/components/map-canvas';
import {
  MapEmptyPins,
  MapLoadError,
  MapLoading,
  MapOfflineTiles,
  MapPermissionBanner,
} from '@/features/map/components/map-state-views';
import { SelectedLocationCard } from '@/features/map/components/selected-location-card';
import { useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { useMapRoute } from '@/features/map/hooks/useMapRoute';
import type { MapPoint } from '@/features/map/types/map.types';
import { straightLineFallback } from '@/features/map/services/routing.service';
import { useTranslation } from '@/localization';
import { usePermission } from '@/providers/workspace-provider';
import { useConnectivity } from '@/services/sync/connectivity';
import { iconStroke, screenPadding, sizes, spacing, useTheme } from '@/theme';
import { formatNumber } from '@/utils/format';

export function MapScreen({
  title,
  points,
  missingCount,
  status,
  sessionMode,
  onRetry,
}: {
  title: string;
  points: MapPoint[];
  missingCount: number;
  status: 'loading' | 'error' | 'ready';
  sessionMode: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const canView = usePermission('beneficiaries.view');
  const isOnline = useConnectivity((s) => s.isOnline);
  const location = useCurrentLocation();
  const canvas = useRef<MapCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wantRoute, setWantRoute] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  const selected = points.find((p) => p.id === selectedId) ?? null;
  const dest = selected?.coords ?? null;
  const { route, loading: routing, clear } = useMapRoute(location.coords, dest, wantRoute && !!selected);

  useEffect(() => {
    if (!route || !location.coords || !dest) return;
    canvas.current?.fitRoute(location.coords, dest);
  }, [route, location.coords, dest]);

  const offlineList = !isOnline || tilesFailed;

  const sorted = useMemo(() => {
    if (!location.coords) return points;
    return [...points].sort((a, b) => {
      const da = straightLineFallback(location.coords!, a.coords, 'offline').distanceM;
      const db = straightLineFallback(location.coords!, b.coords, 'offline').distanceM;
      return da - db;
    });
  }, [points, location.coords]);

  if (!canView) {
    return (
      <Screen scroll={false} header={<ScreenHeader title={title} back />}>
        <NoPermissionState />
      </Screen>
    );
  }

  if (status === 'loading') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={title} back />}>
        <MapLoading />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false} header={<ScreenHeader title={title} back />}>
        <MapLoadError onRetry={onRetry ?? (() => undefined)} />
      </Screen>
    );
  }

  const clearSelection = () => {
    setSelectedId(null);
    setWantRoute(false);
    clear();
  };

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title={title}
          back
          actions={
            location.coords ? (
              <IconButton
                icon={Crosshair}
                label={t('map.myLocation')}
                onPress={() => canvas.current?.locate(location.coords!)}
              />
            ) : undefined
          }
        />
      }
      contentStyle={styles.fill}
    >
      <MapPermissionBanner permission={location.permission} onSettings={location.openSettings} />
      {missingCount > 0 ? (
        <AppText variant="caption" tone="tertiary" style={styles.hint}>
          {t('map.missingPins', { count: missingCount })}
        </AppText>
      ) : null}

      {offlineList ? (
        points.length === 0 ? (
          <MapEmptyPins />
        ) : (
          <View style={styles.fill}>
            <MapOfflineTiles onOpenList={() => undefined} />
            <FlashList
              data={sorted}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const km = location.coords
                  ? formatNumber(
                      Math.round(
                        (straightLineFallback(location.coords, item.coords, 'offline').distanceM / 1000) * 10,
                      ) / 10,
                    )
                  : null;
                return (
                  <View style={styles.row}>
                    <AppText variant="body" weight="semibold">
                      {item.name}
                    </AppText>
                    {km ? (
                      <AppText variant="caption" tone="secondary">
                        {t('map.straightLine', { km })}
                      </AppText>
                    ) : null}
                  </View>
                );
              }}
            />
          </View>
        )
      ) : points.length === 0 ? (
        <MapEmptyPins />
      ) : (
        <View style={styles.fill}>
          <MapCanvas
            ref={canvas}
            points={points}
            selectedId={selectedId}
            user={location.coords}
            center={location.center}
            routeGeometry={route?.geometry ?? null}
            sessionMode={sessionMode}
            onSelect={(id) => {
              setSelectedId(id);
              setWantRoute(false);
              clear();
            }}
            onTilesFailed={() => setTilesFailed(true)}
          />
          <View style={styles.overlay} pointerEvents="box-none">
            {selected ? (
              <SelectedLocationCard
                point={selected}
                origin={location.coords}
                route={route}
                routing={routing}
                onShowRoute={() => setWantRoute(true)}
                onClear={clearSelection}
              />
            ) : (
              <View style={styles.legend}>
                <MapIcon size={sizes.iconSm} color={colors.textTertiary} strokeWidth={iconStroke} />
                <AppText variant="caption" tone="secondary">
                  {t('map.tapHint')}
                </AppText>
                <AppText variant="caption" tone="tertiary">
                  {mapConfig.attribution}
                </AppText>
              </View>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hint: { paddingHorizontal: screenPadding, paddingBottom: spacing[2] },
  overlay: {
    position: 'absolute',
    left: screenPadding,
    right: screenPadding,
    bottom: spacing[4],
    gap: spacing[2],
  },
  legend: { gap: spacing[1] },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[8] },
  row: { paddingVertical: spacing[3], gap: spacing[1] },
});
