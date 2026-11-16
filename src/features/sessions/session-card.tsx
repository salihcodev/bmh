import { StyleSheet, View } from 'react-native';

import { AppText, Badge, PressableCard } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import type { Session } from '@/domain/types';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { formatDateTime } from '@/utils/format';

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const { colors } = useAppTheme();
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
      <View style={[styles.fill, { backgroundColor: colors.primary, width: `${ratio * 100}%` }]} />
    </View>
  );
}

export function SessionCard({ session, onPress, operatorName }: { session: Session; onPress: () => void; operatorName?: string }) {
  const { t } = useTranslation();
  const done = (session.checkedCount ?? 0) + (session.ignoredCount ?? 0);
  return (
    <PressableCard onPress={onPress} style={styles.card}>
      <View style={styles.head}>
        <AppText variant="label" style={styles.flex} numberOfLines={1}>
          {session.name}
        </AppText>
        <Badge
          label={t(`sessions.status.${session.status}`)}
          tone={session.status === 'active' ? 'primary' : 'neutral'}
        />
      </View>
      <AppText variant="caption" muted numberOfLines={1}>
        {[session.cityName, session.areaNames?.join('، '), formatDateTime(session.createdAt?.toDate() ?? session.clientAt?.toDate())]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
      <ProgressBar done={done} total={session.beneficiaryCount} />
      <AppText variant="caption" muted>
        {[
          t('sessions.progress', { done, total: session.beneficiaryCount }),
          operatorName ? `${t('sessions.operator')}: ${operatorName}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  track: { height: 8, borderRadius: Radii.round, overflow: 'hidden', marginVertical: Spacing.xs },
  fill: { height: '100%', borderRadius: Radii.round },
});
