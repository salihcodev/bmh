import { MapPinned, Navigation, Phone, X } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card } from '@/components/ui';
import { directionsUrl, mapsUrl } from '@/domain/maps';
import type { MapPoint, MapRoute } from '@/features/map/types/map.types';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { spacing } from '@/theme';
import { formatDate, formatNumber } from '@/utils/format';
import type { Coords } from '@/features/map/utils/coordinates';

function formatKm(meters: number): string {
  const km = meters / 1000;
  return formatNumber(Math.round(km * 10) / 10);
}

function formatMinutes(seconds: number): string {
  return formatNumber(Math.max(1, Math.round(seconds / 60)));
}

export function SelectedLocationCard({
  point,
  origin,
  route,
  routing,
  missingPin,
  onShowRoute,
  onClear,
}: {
  point: MapPoint;
  origin: Coords | null;
  route: MapRoute | null;
  routing: boolean;
  missingPin?: boolean;
  onShowRoute: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const visitTone = point.visit === 'visited' ? 'success' : point.visit === 'ignored' ? 'warning' : 'neutral';

  const openMaps = () => {
    const url = origin ? directionsUrl(origin, point.coords) : mapsUrl(point.coords);
    void Linking.openURL(url);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <AppText variant="h3" style={styles.flex} numberOfLines={2}>
          {point.name}
        </AppText>
        {point.visit ? <Badge label={t(`map.visit.${point.visit}`)} tone={visitTone} /> : null}
      </View>
      {point.address ? (
        <AppText variant="bodySm" tone="secondary" numberOfLines={2}>
          {point.address}
        </AppText>
      ) : null}
      {missingPin ? (
        <AppText variant="caption" tone="warning">
          {t('map.noValidPin')}
        </AppText>
      ) : null}
      {point.lastAssistanceAt ? (
        <AppText variant="caption" tone="tertiary">
          {t('beneficiaries.lastAssistance', { date: formatDate(point.lastAssistanceAt) })}
        </AppText>
      ) : null}

      {route ? (
        <AppText variant="body">
          {route.kind === 'osrm' && route.durationS != null
            ? t('map.routeSummary', { km: formatKm(route.distanceM), minutes: formatMinutes(route.durationS) })
            : t('map.straightLine', { km: formatKm(route.distanceM) })}
        </AppText>
      ) : null}
      {routing ? <AppText variant="caption" tone="secondary">{t('map.routing')}</AppText> : null}
      {route?.kind === 'fallback' ? (
        <AppText variant="caption" tone="secondary">
          {t(`map.fallback.${route.reason ?? 'network'}`)}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button
          compact
          fullWidth={false}
          variant="lime"
          title={t('map.showRoute')}
          icon={<Navigation />}
          onPress={onShowRoute}
          loading={routing}
        />
        <Button compact fullWidth={false} variant="ghost" title={t('common.clear')} icon={<X />} onPress={onClear} />
        <Button compact fullWidth={false} variant="secondary" title={t('map.openInMaps')} icon={<MapPinned />} onPress={openMaps} />
        {point.phone ? (
          <Button
            compact
            fullWidth={false}
            variant="ghost"
            title={t('beneficiaries.call')}
            icon={<Phone />}
            onPress={() => {
              Linking.openURL(`tel:${point.phone}`).catch(() =>
                emitActionFeedback({ message: t('errors.generic'), kind: 'error' }),
              );
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
