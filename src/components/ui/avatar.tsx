import { Pencil } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconStroke, radii, sizes, useTheme } from '@/theme';

import { AppText } from './app-text';

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0] ?? '')[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1] ?? '')[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Initials avatar (no photo uploads on the free plan). Lime ring when active, optional edit badge. */
export function Avatar({
  name,
  size = sizes.avatarSm,
  active = false,
  onEdit,
  editLabel,
}: {
  name: string;
  size?: number;
  active?: boolean;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const { colors } = useTheme();
  const ring = active ? Math.max(2, Math.round(size / 24)) : 0;
  const inner = size - ring * 2 - (active ? 4 : 0);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: radii.pill, borderWidth: ring, borderColor: colors.accent },
      ]}
    >
      <View style={[styles.inner, { width: inner, height: inner, backgroundColor: colors.surfaceMuted }]}>
        <AppText
          weight="bold"
          style={{ fontSize: Math.round(inner * 0.36), lineHeight: Math.round(inner * 0.48), color: colors.textPrimary }}
        >
          {initialsOf(name)}
        </AppText>
      </View>
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editLabel ?? name}
          onPress={onEdit}
          hitSlop={8}
          style={[styles.edit, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Pencil size={sizes.iconSm} color={colors.textPrimary} strokeWidth={iconStroke} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  inner: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  edit: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 32,
    height: 32,
    borderRadius: radii.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
