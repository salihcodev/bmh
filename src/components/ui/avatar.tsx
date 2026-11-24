import { Image } from 'expo-image';
import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { cld } from '@/services/media/cloudinary';
import { iconStroke, motion, radii, sizes, useTheme } from '@/theme';

import { AppText } from './app-text';

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0] ?? '')[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1] ?? '')[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Profile photo from Cloudinary when `publicId` is set, initials otherwise (and when the image
 * fails to load, e.g. offline on first view). Lime ring when active, optional edit badge.
 */
export function Avatar({
  name,
  publicId,
  size = sizes.avatarSm,
  active = false,
  onEdit,
  editLabel,
}: {
  name: string;
  publicId?: string | null;
  size?: number;
  active?: boolean;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const { colors } = useTheme();
  const uri = cld(publicId, size > 64 ? 'avatar' : 'avatarSm');
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!uri && failedUri !== uri;
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
        {showImage ? (
          <Image
            source={{ uri }}
            contentFit="cover"
            cachePolicy="disk"
            transition={motion.base}
            onError={() => setFailedUri(uri)}
            style={{ width: inner, height: inner }}
            accessible={false}
          />
        ) : (
          <AppText
            weight="bold"
            style={{ fontSize: Math.round(inner * 0.36), lineHeight: Math.round(inner * 0.48), color: colors.textPrimary }}
          >
            {initialsOf(name)}
          </AppText>
        )}
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
  inner: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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
