import { useColorScheme } from 'react-native';

import { Colors, type ThemeColors } from '@/constants/theme';
import { usePreferences } from '@/store/preferences';

export function useAppTheme(): { colors: ThemeColors; dark: boolean; scheme: 'light' | 'dark' } {
  const systemScheme = useColorScheme();
  const preference = usePreferences((state) => state.theme);
  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  return { colors: Colors[scheme], dark: scheme === 'dark', scheme };
}
