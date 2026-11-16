import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, spacing, useTheme } from '@/theme';

/**
 * Rows grouped in one white rounded card with hairline dividers (settings reference),
 * or `tiles`: each row its own rounded tile with a gap (options-list reference).
 */
export function GroupedList({
  children,
  variant = 'card',
  style,
}: {
  children: ReactNode;
  variant?: 'card' | 'tiles';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  if (variant === 'tiles') {
    return (
      <View style={[styles.tiles, style]}>
        {items.map((child, index) => (
          <View key={child.key ?? index} style={[styles.tile, { backgroundColor: colors.surface }]}>
            {child}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, style]}>
      {items.map((child, index) => (
        <Fragment key={child.key ?? index}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, overflow: 'hidden', marginBottom: spacing[3] },
  divider: { height: StyleSheet.hairlineWidth, marginStart: spacing[4] + 40 + spacing[3] },
  tiles: { gap: spacing[2], marginBottom: spacing[3] },
  tile: { borderRadius: radii.lg, overflow: 'hidden' },
});
