import { StyleSheet, View } from 'react-native';

import { AppText, Badge, PressableCard, ProgressBar } from '@/components/ui';
import type { Session } from '@/domain/types';
import { useTranslation } from '@/localization';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

export function SessionCard({ session, onPress, operatorName }: { session: Session; onPress: () => void; operatorName?: string }) {
  const { t } = useTranslation();
  const done = (session.checkedCount ?? 0) + (session.ignoredCount ?? 0);
  const total = session.beneficiaryCount;
  return (
    <PressableCard onPress={onPress} style={styles.card} accessibilityLabel={`${session.name}, ${t('sessions.progress', { done, total })}`}>
      <View style={styles.head}>
        <AppText variant="bodyLg" weight="bold" style={styles.flex} numberOfLines={1}>
          {session.name}
        </AppText>
        <Badge label={t(`sessions.status.${session.status}`)} tone={session.status === 'active' ? 'lime' : 'neutral'} />
      </View>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {[session.cityName, session.areaNames?.join('، '), formatDateTime(session.createdAt?.toDate() ?? session.clientAt?.toDate())]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
      <ProgressBar value={total > 0 ? done / total : 0} label={t('sessions.progress', { done, total })} />
      <AppText variant="caption" tone="secondary">
        {[t('sessions.progress', { done, total }), operatorName ? `${t('sessions.operator')}: ${operatorName}` : null]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
