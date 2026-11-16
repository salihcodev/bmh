import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/tokens';

/** Kept for existing call sites; same as useTheme(). */
export function useAppTheme(): { colors: ThemeColors; dark: boolean; scheme: 'light' | 'dark' } {
  const { colors, dark, scheme } = useTheme();
  return { colors, dark, scheme };
}
