import { afterEach, describe, expect, it } from 'vitest';

import { detectScript, resolveFontFamily, setFontLanguage } from '@/theme/font-resolver';
import { darkColors, lightColors, palette, type ThemeColors } from '@/theme/tokens';

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum]. 4.5 = body text (WCAG AA), 3 = large text / icons / UI parts.
const PAIRS: [keyof ThemeColors, keyof ThemeColors, number][] = [
  ['textPrimary', 'background', 4.5],
  ['textPrimary', 'surface', 4.5],
  ['textSecondary', 'background', 4.5],
  ['textSecondary', 'surface', 4.5],
  ['textTertiary', 'surface', 3],
  ['onPrimary', 'primary', 4.5],
  ['onAccent', 'accent', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'dangerTint', 4.5],
  ['warning', 'warningTint', 4.5],
  ['success', 'successTint', 4.5],
  ['info', 'infoTint', 4.5],
];

describe('color contrast', () => {
  for (const [name, colors] of [
    ['light', lightColors],
    ['dark', darkColors],
  ] as const) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${name}: ${fg} on ${bg} >= ${min}`, () => {
        expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
      });
    }
  }

  it('lime is never used for text on white (fails contrast); it always carries ink', () => {
    expect(contrast(palette.lime, palette.white)).toBeLessThan(3);
    expect(contrast(palette.ink, palette.lime)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the four reference colors exactly', () => {
    expect(palette).toEqual({ ink: '#202020', lime: '#C9F158', canvas: '#F2F3F5', white: '#FFFFFF' });
  });
});

describe('font resolver', () => {
  afterEach(() => setFontLanguage('ar'));

  it('detects Arabic in strings and nested children', () => {
    expect(detectScript('مرحبا')).toBe('arabic');
    expect(detectScript(['Hello ', 'عالم'])).toBe('arabic');
    expect(detectScript('Hello 123')).toBe('latin');
    expect(detectScript(42)).toBe('latin');
  });

  it('falls back to the UI language for non-text children', () => {
    setFontLanguage('ar');
    expect(detectScript(null)).toBe('arabic');
    setFontLanguage('en');
    expect(detectScript(undefined)).toBe('latin');
  });

  it('maps weights to bundled families', () => {
    expect(resolveFontFamily('regular', 'latin')).toBe('SpaceGrotesk_400Regular');
    expect(resolveFontFamily('semibold', 'latin')).toBe('SpaceGrotesk_700Bold');
    expect(resolveFontFamily('semibold', 'arabic')).toBe('IBMPlexSansArabic_600SemiBold');
    expect(resolveFontFamily('bold', 'arabic')).toBe('IBMPlexSansArabic_700Bold');
  });

  it("resolves 'locale' by the UI language", () => {
    setFontLanguage('en');
    expect(resolveFontFamily('medium', 'locale')).toBe('SpaceGrotesk_500Medium');
    setFontLanguage('ar');
    expect(resolveFontFamily('medium', 'locale')).toBe('IBMPlexSansArabic_500Medium');
  });

  it('never resolves to Cairo', () => {
    for (const script of ['latin', 'arabic', 'locale'] as const) {
      for (const weight of ['regular', 'medium', 'semibold', 'bold'] as const) {
        expect(resolveFontFamily(weight, script)).not.toMatch(/cairo/i);
      }
    }
  });
});
