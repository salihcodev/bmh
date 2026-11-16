import { router } from 'expo-router';
import { Navigation, NotebookPen, Phone, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, IconButton } from '@/components/ui';
import { formatCoords } from '@/domain/maps';
import { formatPhone } from '@/domain/phone';
import type { MapPin, Phone as PhoneType, SessionItem } from '@/domain/types';
import { openInMaps } from '@/features/pins/pins-section';
import { useTranslation } from '@/localization';
import { radii, spacing, useTheme } from '@/theme';

const STATUS_TONE = { pending: 'neutral', checked: 'success', ignored: 'warning' } as const;

/** The current beneficiary in field mode: big name, one-tap call, then the details a volunteer needs on the street. */
export function ItemCard({
  item,
  total,
  onCall,
  onNote,
  canViewDetails,
}: {
  item: SessionItem;
  total: number;
  onCall?: (phone: string) => void;
  onNote?: () => void;
  canViewDetails: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const phones = (item.phones ?? []) as PhoneType[];
  const others = phones.filter((p) => p.number !== item.primaryPhone);
  const pins = (item.mapPins ?? []) as MapPin[];

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <AppText variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
          {`#${item.order + 1} / ${total} · ${item.areaName}`}
        </AppText>
        <Badge label={t(`sessions.itemStatus.${item.status}`)} tone={STATUS_TONE[item.status]} />
      </View>
      <AppText variant="display">{item.fullName}</AppText>
      <AppText variant="bodyLg" tone="secondary">
        {t('beneficiaries.household', { count: item.householdCount })}
      </AppText>

      {item.primaryPhone ? (
        <View style={[styles.phone, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="h2" ltr style={styles.flex}>
            {formatPhone(item.primaryPhone)}
          </AppText>
          {onCall ? (
            <IconButton icon={Phone} variant="lime" round label={t('beneficiaries.call')} onPress={() => onCall(item.primaryPhone!)} />
          ) : null}
        </View>
      ) : (
        <AppText variant="bodySm" tone="secondary">
          {t('beneficiaries.noPrimaryPhone')}
        </AppText>
      )}
      {others.length > 0 ? (
        <View style={styles.block}>
          <AppText variant="caption" tone="secondary">
            {t('sessions.otherPhones')}
          </AppText>
          {others.map((p) => (
            <View key={p.id} style={styles.row}>
              <AppText variant="bodyLg" ltr style={styles.flex}>
                {formatPhone(p.number)}
                {p.label ? `  (${p.label})` : ''}
              </AppText>
              {onCall ? <IconButton icon={Phone} round label={t('beneficiaries.call')} onPress={() => onCall(p.number)} /> : null}
            </View>
          ))}
        </View>
      ) : null}

      <Info label={t('beneficiaries.pickupLocation')} value={item.pickupLocation} />
      <Info label={t('beneficiaries.residentialAddress')} value={item.residentialAddress} />
      <Info label={t('beneficiaries.notes')} value={item.notes} />
      {item.note ? (
        <View style={[styles.note, { backgroundColor: colors.accentTint }]}>
          <AppText variant="caption" tone="secondary">
            {t('sessions.note')}
          </AppText>
          <AppText variant="body">{item.note}</AppText>
        </View>
      ) : null}

      {pins.length > 0 ? (
        <View style={styles.wrap}>
          {pins.map((pin) => (
            <Button
              key={pin.id}
              compact
              fullWidth={false}
              variant="secondary"
              title={pin.label || formatCoords(pin)}
              icon={<Navigation />}
              onPress={() => openInMaps(pin)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.wrap}>
        {canViewDetails ? (
          <Button
            compact
            fullWidth={false}
            variant="ghost"
            title={t('common.viewDetails')}
            icon={<UserRound />}
            onPress={() => router.push(`/beneficiaries/${item.beneficiaryId}`)}
          />
        ) : null}
        {onNote ? <Button compact fullWidth={false} variant="ghost" title={t('sessions.note')} icon={<NotebookPen />} onPress={onNote} /> : null}
      </View>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.block}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="bodyLg">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  phone: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.md },
  block: { gap: spacing[1] / 2 },
  note: { gap: spacing[1] / 2, padding: spacing[3], borderRadius: radii.sm },
});
