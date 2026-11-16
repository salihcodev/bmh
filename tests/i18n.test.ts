import { describe, expect, it } from 'vitest';

import ar from '@/localization/ar.json';
import arPlatform from '@/localization/ar.platform.json';
import en from '@/localization/en.json';
import enPlatform from '@/localization/en.platform.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('translations', () => {
  it('platform files only add new top-level namespaces (a spread would overwrite existing ones)', () => {
    expect(Object.keys(enPlatform).filter((k) => k in en)).toEqual([]);
    expect(Object.keys(arPlatform).filter((k) => k in ar)).toEqual([]);
  });

  it('Arabic and English have the same keys (ignoring plural forms only Arabic uses)', () => {
    const base = (list: string[]) => [...new Set(list.map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort();
    expect(base(keys({ ...ar, ...arPlatform }))).toEqual(base(keys({ ...en, ...enPlatform })));
  });

  it('has no empty strings', () => {
    for (const source of [ar, en, arPlatform, enPlatform]) {
      const empty = keys(source).filter((k) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], source) === '');
      expect(empty).toEqual([]);
    }
  });
});
