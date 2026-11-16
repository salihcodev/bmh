import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/ui';
import { spacing } from '@/theme';

import { SyncPill } from './sync-pill';

/** Workspace screen header: the design-system Header with the sync status in the trailing slot. */
export function AppHeader({
  title,
  subtitle,
  back = false,
  right,
  onTitlePress,
  large,
  tag,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  onTitlePress?: () => void;
  large?: boolean;
  tag?: string;
}) {
  return (
    <Header
      title={title}
      subtitle={subtitle}
      back={back}
      onTitlePress={onTitlePress}
      large={large ?? !back}
      tag={tag}
      trailing={
        <View style={styles.trailing}>
          {right}
          <SyncPill compact />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({ trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] } });
