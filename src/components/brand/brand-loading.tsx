import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { motion, spacing, useTheme } from '@/theme';

import { BrandMark } from './brand-mark';

/**
 * Continues the native splash (same background and mark) while auth and profile load,
 * then fades in a spinner if loading takes longer than a second.
 */
export function BrandLoading() {
  const { colors, dark } = useTheme();
  const [spinner] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const timer = setTimeout(
      () => Animated.timing(spinner, { toValue: 1, duration: motion.base, useNativeDriver: true }).start(),
      1000,
    );
    return () => clearTimeout(timer);
  }, [spinner]);
  const background = dark ? colors.background : colors.accent;
  return (
    <View accessibilityRole="progressbar" style={[styles.wrap, { backgroundColor: background }]}>
      <BrandMark size={120} on={background} color={dark ? colors.accent : colors.onAccent} />
      <Animated.View style={{ opacity: spinner }}>
        <ActivityIndicator color={dark ? colors.accent : colors.onAccent} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[6] },
});
