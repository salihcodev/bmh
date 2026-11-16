import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { EventRecord } from '@/domain/types';
import { useTranslation } from '@/localization';
import { radii, spacing, useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

const DOT = 8;

export function EventRow({ event, extra }: { event: EventRecord; extra?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const when = event.createdAt?.toDate() ?? event.clientAt?.toDate() ?? null;
  return (
    <View style={[styles.row, { borderBottomColor: colors.divider }]}>
      <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.textPrimary }]} />
      <View style={styles.text}>
        <AppText variant="label">
          {t(`history.types.${event.type}`, { defaultValue: event.type })}
          {extra ? ` · ${extra}` : ''}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {[t('history.by', { name: event.actorName }), formatDateTime(when)].filter(Boolean).join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  dot: { width: DOT, height: DOT, borderRadius: radii.pill, borderWidth: 1, marginTop: spacing[1] + 2 },
  text: { flex: 1, gap: spacing[1] / 2 },
});
