import { createContext, useContext } from 'react';

import { useTheme } from '@/theme';

/** What an input sits on: the grey canvas, or a white card, sheet or form screen. */
export type SurfaceLevel = 'canvas' | 'raised';

const SurfaceContext = createContext<SurfaceLevel>('raised');

export const SurfaceProvider = SurfaceContext.Provider;

/**
 * Input fill that contrasts with what it sits on: grey on white surfaces (the reference),
 * white with a hairline border on the grey canvas, where a grey fill would disappear.
 */
export function useFieldColors() {
  const { colors } = useTheme();
  const level = useContext(SurfaceContext);
  return level === 'canvas'
    ? { fill: colors.surface, border: colors.border }
    : { fill: colors.surfaceMuted, border: colors.surfaceMuted };
}
