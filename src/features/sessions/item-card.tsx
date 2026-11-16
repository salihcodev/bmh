import { router } from 'expo-router';
import { Navigation, NotebookPen, Phone, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatCoords } from '@/domain/maps';
import { formatPhone } from '@/domain/phone';
import type { MapPin, Phone as PhoneType, SessionItem } from '@/domain/types';
import { openInMaps } from '@/features/pins/pins-section';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';

const STATUS_TONE = { pending: 'neutral', checked: 'success', ignored: 'warning' } as const;

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
  const { colors } = useAppTheme();
  const phones = (item.phones ?? []) as PhoneType[];
  const others = phones.filter((p) => p.number !== item.primaryPhone);
  const pins = (item.mapPins ?? []) as MapPin[];

  return (
    <Card style={styles.card}>
      <Row>
        <AppText variant="caption" muted style={styles.flex}>
          {`#${item.order + 1} / ${total} · ${item.areaName}`}
        </AppText>
        <Badge label={t(`sessions.itemStatus.${item.status}`)} tone={STATUS_TONE[item.status]} />
      </Row>
      <AppText variant="title" style={styles.name}>
        {item.fullName}
      </AppText>
      <AppText muted>{t('beneficiaries.household', { count: item.householdCount })}</AppText>

      {item.primaryPhone ? (
        <Row>
          <AppText variant="heading" ltr style={styles.flex}>
            {formatPhone(item.primaryPhone)}
          </AppText>
          {onCall ? (
            <Button compact title={t('beneficiaries.call')} icon={<Phone size={16} />} onPress={() => onCall(item.primaryPhone!)} />
          ) : null}
        </Row>
      ) : (
        <AppText muted>{t('beneficiaries.noPrimaryPhone')}</AppText>
      )}
      {others.length > 0 ? (
        <View style={styles.block}>
          <AppText variant="caption" muted>
            {t('sessions.otherPhones')}
          </AppText>
          {others.map((p) => (
            <Row key={p.id}>
              <AppText ltr style={styles.flex}>
                {formatPhone(p.number)}
                {p.label ? `  (${p.label})` : ''}
              </AppText>
              {onCall ? (
                <Button compact variant="secondary" title={t('beneficiaries.call')} onPress={() => onCall(p.number)} />
              ) : null}
            </Row>
          ))}
        </View>
      ) : null}

      <Info label={t('beneficiaries.pickupLocation')} value={item.pickupLocation} />
      <Info label={t('beneficiaries.residentialAddress')} value={item.residentialAddress} />
      <Info label={t('beneficiaries.notes')} value={item.notes} />
      <Info label={t('sessions.note')} value={item.note} color={colors.accent} />

      {pins.length > 0 ? (
        <Row wrap>
          {pins.map((pin) => (
            <Button
              key={pin.id}
              compact
              variant="secondary"
              title={pin.label || formatCoords(pin)}
              icon={<Navigation size={16} />}
              onPress={() => openInMaps(pin)}
            />
          ))}
        </Row>
      ) : null}

      <Row wrap>
        {canViewDetails ? (
          <Button
            compact
            variant="ghost"
            title={t('common.viewDetails')}
            icon={<UserRound size={16} />}
            onPress={() => router.push(`/beneficiaries/${item.beneficiaryId}`)}
          />
        ) : null}
        {onNote ? (
          <Button compact variant="ghost" title={t('sessions.note')} icon={<NotebookPen size={16} />} onPress={onNote} />
        ) : null}
      </Row>
    </Card>
  );
}

function Info({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  if (!value) return null;
  return (
    <View style={styles.block}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText style={color ? { color } : undefined}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  flex: { flex: 1 },
  name: { lineHeight: 38 },
  block: { gap: 2 },
});
