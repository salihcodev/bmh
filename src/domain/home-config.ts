// Home layout stored at appConfig/home. The dashboard edits it; Home renders the visible
// sections in `order`, each capped by `count`. Missing or partial docs fall back to defaults.

export const HOME_SECTION_KEYS = [
  'banners',
  'stats',
  'quickLinks',
  'news',
  'messages',
  'featuredItems',
  'popularSuppliers',
  'topBags',
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export type HomeSection = {
  key: HomeSectionKey;
  visible: boolean;
  order: number;
  count: number;
};

/** Upper bound per section. The editor and the parser both clamp to this. */
export const HOME_COUNT_MAX: Record<HomeSectionKey, number> = {
  banners: 8,
  stats: 4,
  quickLinks: 6,
  news: 10,
  messages: 5,
  featuredItems: 12,
  popularSuppliers: 12,
  topBags: 5,
};

/** Sections that still wait on a later milestone (chat/system messages on Home). */
const LATER: ReadonlySet<HomeSectionKey> = new Set(['messages']);

export const HOME_SECTION_DEFAULTS: HomeSection[] = HOME_SECTION_KEYS.map((key, order) => ({
  key,
  visible: !LATER.has(key),
  order,
  count: key === 'news' ? 3 : key === 'quickLinks' ? 5 : HOME_COUNT_MAX[key],
}));

const DEFAULT_BY_KEY: Record<HomeSectionKey, HomeSection> = Object.fromEntries(
  HOME_SECTION_DEFAULTS.map((section) => [section.key, section]),
) as Record<HomeSectionKey, HomeSection>;

function isKey(value: unknown): value is HomeSectionKey {
  return typeof value === 'string' && (HOME_SECTION_KEYS as readonly string[]).includes(value);
}

function clampCount(key: HomeSectionKey, value: unknown, fallback: number): number {
  const count = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(HOME_COUNT_MAX[key], Math.max(1, count));
}

/**
 * Every known section, once, in display order. Unknown keys are dropped.
 * A missing doc, a partial list, or a bad count uses the default for that section.
 */
export function homeSections(raw: unknown): HomeSection[] {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { sections?: unknown }).sections)
      ? (raw as { sections: unknown[] }).sections
      : [];
  const byKey = new Map<HomeSectionKey, unknown>();
  for (const item of source) {
    if (!item || typeof item !== 'object' || !('key' in item)) continue;
    const key = (item as { key: unknown }).key;
    if (isKey(key)) byKey.set(key, item);
  }
  return HOME_SECTION_KEYS.map((key) => {
    const fallback = DEFAULT_BY_KEY[key];
    const item = byKey.get(key) as Partial<HomeSection> | undefined;
    const orderValue = item?.order;
    const order =
      typeof orderValue === 'number' && Number.isFinite(orderValue) ? Math.trunc(orderValue) : fallback.order;
    return {
      key,
      visible: typeof item?.visible === 'boolean' ? item.visible : fallback.visible,
      order,
      count: clampCount(key, item?.count, fallback.count),
    };
  }).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

export function visibleHomeSections(sections: HomeSection[]): HomeSection[] {
  return sections.filter((section) => section.visible);
}

export function patchHomeSection(
  sections: HomeSection[],
  key: HomeSectionKey,
  patch: Partial<Pick<HomeSection, 'visible' | 'count'>>,
): HomeSection[] {
  return sections.map((section) =>
    section.key === key
      ? {
          ...section,
          ...patch,
          count: clampCount(key, patch.count ?? section.count, section.count),
        }
      : section,
  );
}

/** Moves a section one step and rewrites `order` so the saved list matches the screen. */
export function moveHomeSection(sections: HomeSection[], key: HomeSectionKey, direction: -1 | 1): HomeSection[] {
  const ordered = [...sections].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const index = ordered.findIndex((section) => section.key === key);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ordered.length) return sections;
  const swapped = ordered.slice();
  const [item] = swapped.splice(index, 1);
  swapped.splice(next, 0, item!);
  return swapped.map((section, order) => ({ ...section, order }));
}
