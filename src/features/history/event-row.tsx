import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import type { EventRecord } from '@/domain/types';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';
import { formatDateTime } from '@/utils/format';

export function EventRow({ event, extra }: { event: EventRecord; extra?: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const when = event.createdAt?.toDate() ?? event.clientAt?.toDate() ?? null;
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      <View style={styles.text}>
        <AppText variant="label">
          {t(`history.types.${event.type}`, { defaultValue: event.type })}
          {extra ? ` · ${extra}` : ''}
        </AppText>
        <AppText variant="caption" muted>
          {[t('history.by', { name: event.actorName }), formatDateTime(when)].filter(Boolean).join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: Radii.pill, marginTop: 8 },
  text: { flex: 1, gap: 2 },
});
