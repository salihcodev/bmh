import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { sizes } from '@/theme';

import { AppText } from './app-text';

/** Inline text action (bold, 44pt target). Navigates to `href` or runs `onPress`. */
export function TextLink({ label, href, onPress, replace = false }: { label: string; href?: Href; onPress?: () => void; replace?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        if (onPress) onPress();
        else if (href) (replace ? router.replace : router.push)(href);
      }}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      <AppText variant="body" weight="bold" center>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({ link: { minHeight: sizes.minTouch, justifyContent: 'center' } });
