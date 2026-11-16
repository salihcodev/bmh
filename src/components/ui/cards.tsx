import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconStroke, motion, radii, sizes, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';

/** Big number + label (platform stats, workspace counts). `tone="lime"` for the highlighted one. */
export function StatCard({
  value,
  label,
  icon: Icon,
  tone = 'surface',
  onPress,
}: {
  value: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'surface' | 'lime' | 'ink';
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const bg = { surface: colors.surface, lime: colors.accent, ink: colors.primary }[tone];
  const fg = { surface: colors.textPrimary, lime: colors.onAccent, ink: colors.onPrimary }[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${value} ${label}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stat,
        { backgroundColor: bg, transform: [{ scale: pressed ? motion.pressScale : 1 }] },
      ]}
    >
      {Icon ? <Icon size={sizes.icon} color={fg} strokeWidth={iconStroke} /> : null}
      <AppText variant="h1" ltr style={{ color: fg }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="bodySm" style={{ color: fg, opacity: tone === 'surface' ? 0.7 : 0.85 }} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Large radio-style tile (account type, workspace choice): selected gets an ink border and a lime check dot. */
export function SelectableCard({
  title,
  hint,
  icon: Icon,
  selected,
  onPress,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${title}, ${hint}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectable,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.textPrimary : colors.border,
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
        },
      ]}
    >
      {Icon ? (
        <View style={[styles.tile, { backgroundColor: selected ? colors.accent : colors.surfaceMuted }]}>
          <Icon size={sizes.icon} color={selected ? colors.onAccent : colors.textPrimary} strokeWidth={iconStroke} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <AppText variant="bodyLg" weight="bold">
          {title}
        </AppText>
        {hint ? (
          <AppText variant="bodySm" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.textPrimary : colors.border }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.textPrimary }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  stat: { flex: 1, minWidth: 140, borderRadius: radii.xl, padding: spacing[4], gap: spacing[1] },
  selectable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1.5,
    marginBottom: spacing[2],
  },
  tile: { width: sizes.iconTile, height: sizes.iconTile, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: radii.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
});
