import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { usePreferences, type ThemePreference } from '@/store/preferences';

import { darkColors, lightColors, type ThemeColors } from './tokens';

export type Theme = { colors: ThemeColors; dark: boolean; scheme: 'light' | 'dark'; preference: ThemePreference };

const ThemeContext = createContext<Theme | null>(null);

function resolve(preference: ThemePreference, system: string | null | undefined): Theme {
  const scheme: 'light' | 'dark' = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return { colors: scheme === 'dark' ? darkColors : lightColors, dark: scheme === 'dark', scheme, preference };
}

/** Light / dark / system. Every component reads colors through useTheme(), never raw values. */
export function ThemeProvider({ children, override }: { children: ReactNode; override?: 'light' | 'dark' }) {
  const system = useColorScheme();
  const preference = usePreferences((state) => state.theme);
  const value = useMemo(() => resolve(override ?? preference, system), [override, preference, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  const system = useColorScheme();
  const preference = usePreferences((state) => state.theme);
  return context ?? resolve(preference, system);
}
