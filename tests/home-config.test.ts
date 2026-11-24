import { describe, expect, it } from 'vitest';

import {
  HOME_SECTION_DEFAULTS,
  HOME_SECTION_KEYS,
  homeSections,
  moveHomeSection,
  patchHomeSection,
  visibleHomeSections,
} from '@/domain/home-config';

describe('homeSections', () => {
  it('uses defaults when the doc is missing', () => {
    const sections = homeSections(null);
    expect(sections.map((section) => section.key)).toEqual([...HOME_SECTION_KEYS]);
    expect(visibleHomeSections(sections).map((section) => section.key)).toEqual(
      HOME_SECTION_DEFAULTS.filter((section) => section.visible).map((section) => section.key),
    );
  });

  it('keeps a saved order, fills gaps, and clamps counts', () => {
    const sections = homeSections({
      sections: [
        { key: 'news', visible: true, order: 0, count: 99 },
        { key: 'banners', visible: false, order: 2, count: 0 },
        { key: 'unknown', visible: true, order: 1, count: 3 },
      ],
    });
    const news = sections.find((section) => section.key === 'news');
    const banners = sections.find((section) => section.key === 'banners');
    expect(news).toMatchObject({ order: 0, count: 10, visible: true });
    expect(banners).toMatchObject({ order: 2, visible: false, count: 1 });
    expect(sections.some((section) => (section.key as string) === 'unknown')).toBe(false);
    expect(sections[0]?.key).toBe('news');
  });

  it('moves a section and renumbers order', () => {
    const start = homeSections(null);
    const moved = moveHomeSection(start, 'news', -1);
    const keys = moved.map((section) => section.key);
    const from = start.findIndex((section) => section.key === 'news');
    expect(keys[from - 1]).toBe('news');
    expect(moved.map((section) => section.order)).toEqual(moved.map((_, index) => index));
    expect(moveHomeSection(start, start[0]!.key, -1)).toBe(start);
  });

  it('patches visibility and count without dropping sections', () => {
    const start = homeSections(null);
    const next = patchHomeSection(start, 'topBags', { visible: true, count: 2 });
    expect(next).toHaveLength(start.length);
    expect(next.find((section) => section.key === 'topBags')).toMatchObject({ visible: true, count: 2 });
  });
});
