import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/localization';
import { screenPadding, sizes, spacing } from '@/theme';

import { AppText } from './app-text';
import { Badge } from './chip';
import { IconButton } from './icon-button';

/**
 * Screen header from the reference: outlined 44x44 back button at the start (mirrored in RTL),
 * centered title, trailing slot at the end. `large` puts a big start-aligned title under the bar.
 */
export function Header({
  title,
  subtitle,
  back = false,
  onBack,
  trailing,
  large = false,
  tag,
  onTitlePress,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  trailing?: ReactNode;
  large?: boolean;
  /** Small lime tag next to the title, e.g. "SUPER ADMIN". */
  tag?: string;
  onTitlePress?: () => void;
}) {
  const { t } = useTranslation();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const start = back ? (
    <IconButton icon={ChevronLeft} label={t('common.back')} onPress={goBack} mirror />
  ) : (
    <View style={styles.slot} />
  );
  const end = <View style={[styles.slot, styles.end]}>{trailing}</View>;

  if (large) {
    return (
      <View style={styles.wrap}>
        {back || trailing ? (
          <View style={styles.bar}>
            {start}
            <View style={styles.flex} />
            {end}
          </View>
        ) : null}
        <Pressable disabled={!onTitlePress} onPress={onTitlePress} style={styles.large}>
          <View style={styles.titleLine}>
            <AppText variant="h1" accessibilityRole="header" numberOfLines={2} style={styles.shrink}>
              {title}
            </AppText>
            {tag ? <Badge label={tag} tone="lime" /> : null}
          </View>
          {subtitle ? (
            <AppText variant="body" muted numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.bar]}>
      {start}
      <Pressable
        disabled={!onTitlePress}
        onPress={onTitlePress}
        accessibilityRole={onTitlePress ? 'button' : 'header'}
        style={styles.center}
      >
        <View style={styles.titleLine}>
          <AppText variant="h3" numberOfLines={1} center style={styles.shrink}>
            {title}
          </AppText>
          {tag ? <Badge label={tag} tone="lime" /> : null}
        </View>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1} center>
            {subtitle}
          </AppText>
        ) : null}
      </Pressable>
      {end}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: screenPadding, paddingVertical: spacing[2] },
  bar: { minHeight: sizes.iconButton + spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  slot: { minWidth: sizes.iconButton, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  end: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  flex: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], maxWidth: '100%' },
  shrink: { flexShrink: 1 },
  large: { paddingTop: spacing[2], paddingBottom: spacing[2], gap: spacing[1] },
});
