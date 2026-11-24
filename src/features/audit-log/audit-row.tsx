import {
  ArrowRight,
  Ban,
  Building2,
  Check,
  HandHeart,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  MessageSquareText,
  Newspaper,
  RefreshCw,
  ScrollText,
  Settings2,
  Shield,
  Trash2,
  UserCog,
  type LucideIcon,
} from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import { auditIcon, auditSeverity, type AuditEntry, type AuditIcon, type RowDensity, type Severity } from '@/domain/audit-log';
import { useTranslation } from '@/localization';
import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

const ICONS: Record<AuditIcon, LucideIcon> = {
  image: ImageIcon,
  layout: LayoutTemplate,
  newspaper: Newspaper,
  message: MessageSquareText,
  heart: HandHeart,
  user: UserCog,
  shield: Shield,
  layers: Layers,
  building: Building2,
  settings: Settings2,
  refresh: RefreshCw,
  trash: Trash2,
  ban: Ban,
  check: Check,
  log: ScrollText,
};

/** One log entry. Compact is a single line of what happened; detailed adds the target, the change and the device. */
export const AuditRow = memo(function AuditRow({ entry, density }: { entry: AuditEntry; density: RowDensity }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const Icon = ICONS[entry.icon ?? auditIcon(entry.action, entry.targetType)];
  const severity: Severity = auditSeverity(entry.action);
  const tone = {
    danger: { bg: colors.dangerTint, fg: colors.danger },
    warning: { bg: colors.warningTint, fg: colors.warning },
    neutral: { bg: colors.surfaceMuted, fg: colors.textPrimary },
  }[severity];
  const action = t(`manage.audit.actions.${entry.action}`, { defaultValue: t('manage.audit.actions.unknown') });
  const actor = entry.actorName || entry.actorId;
  const when = entry.createdAt ? formatDateTime(new Date(entry.createdAt)) : '';
  const entity = t(`manage.audit.entities.${entry.targetType}`, { defaultValue: entry.targetType });
  const target = entry.targetName ? `${entry.targetName} · ${entry.targetId}` : entry.targetId;
  const detailed = density === 'detailed';
  const changed = detailed && entry.summary ? Object.keys({ ...entry.summary.before, ...entry.summary.after }) : [];

  return (
    <View
      accessible
      accessibilityLabel={[action, t('manage.audit.by', { name: actor }), when].filter(Boolean).join(', ')}
      style={[styles.row, detailed ? styles.rowDetailed : styles.rowCompact, { backgroundColor: colors.surface }]}
    >
      {detailed ? (
        <Avatar name={actor} publicId={entry.actorAvatarPublicId} size={sizes.avatarSm} />
      ) : (
        <View style={[styles.tile, { backgroundColor: tone.bg }]}>
          <Icon color={tone.fg} size={sizes.icon} strokeWidth={iconStroke} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.head}>
          {detailed ? <Icon color={tone.fg} size={sizes.iconSm} strokeWidth={iconStroke} /> : null}
          <AppText variant="body" weight="semibold" style={styles.title} numberOfLines={detailed ? 2 : 1}>
            {action}
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {[t('manage.audit.by', { name: actor }), when].filter(Boolean).join(' · ')}
        </AppText>
        {detailed ? (
          <>
            <AppText variant="caption" tone="tertiary" numberOfLines={2}>
              {`${entity} · ${target}`}
            </AppText>
            {entry.workspaceId ? (
              <AppText variant="caption" tone="tertiary" ltr numberOfLines={1}>
                {t('manage.audit.inWorkspace', { id: entry.workspaceId })}
              </AppText>
            ) : null}
            {changed.map((key) => (
              <Change key={key} name={key} before={entry.summary?.before?.[key]} after={entry.summary?.after?.[key]} />
            ))}
            {entry.platform ? (
              <AppText variant="caption" tone="tertiary" ltr numberOfLines={1}>
                {[entry.platform, entry.appVersion].filter(Boolean).join(' ')}
              </AppText>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
});

function Change({ name, before, after }: { name: string; before?: string; after?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.change}>
      <AppText variant="caption" tone="secondary" ltr>
        {name}
      </AppText>
      {before !== undefined ? (
        <AppText variant="caption" ltr style={[styles.chip, { backgroundColor: colors.dangerTint, color: colors.danger }]} numberOfLines={1}>
          {before || '∅'}
        </AppText>
      ) : null}
      {before !== undefined && after !== undefined ? <ArrowRight size={sizes.iconSm} color={colors.textTertiary} strokeWidth={iconStroke} /> : null}
      {after !== undefined && after !== '' ? (
        <AppText variant="caption" ltr style={[styles.chip, { backgroundColor: colors.successTint, color: colors.success }]} numberOfLines={1}>
          {after}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg },
  rowCompact: { alignItems: 'center' },
  rowDetailed: { alignItems: 'flex-start' },
  tile: { width: sizes.iconTile, height: sizes.iconTile, borderRadius: radii.iconButton, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: spacing[1], minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flexShrink: 1 },
  change: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing[2], borderRadius: radii.pill, overflow: 'hidden', maxWidth: 180 },
});
