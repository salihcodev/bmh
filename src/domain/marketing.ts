import { z } from 'zod';

// Platform-wide marketing content (docs/firestore-schema.md). Written only by super admins
// (firestore.rules); every signed-in user reads it. Pure module: normalizers and helpers.

export type Language = 'ar' | 'en';
export type Localized = { ar: string; en: string };

const localized = z
  .object({ ar: z.string().catch(''), en: z.string().catch('') })
  .catch({ ar: '', en: '' });
const optionalLocalized = localized.optional().catch(undefined);
const localizedId = z
  .object({ ar: z.string().nullable().catch(null), en: z.string().nullable().catch(null) })
  .partial()
  .nullish()
  .transform((v) => v ?? null)
  .catch(null);
/** Firestore Timestamp, Date or millis -> millis. */
const time = z
  .unknown()
  .optional()
  .transform((value): number | null => {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    const v = value as { toMillis?: () => number; seconds?: number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return null;
  });

export function pick(text: Partial<Localized> | null | undefined, language: Language): string {
  if (!text) return '';
  return text[language] || text[language === 'ar' ? 'en' : 'ar'] || '';
}

const ctaSchema = z
  .object({
    label: localized,
    type: z.enum(['route', 'url']),
    target: z.string(),
  })
  .nullish()
  .transform((v) => v ?? null)
  .catch(null);

export const bannerSchema = z.object({
  title: localized,
  subtitle: localized,
  imagePublicId: localizedId,
  gradient: z
    .object({ from: z.string(), to: z.string() })
    .nullish()
    .transform((v) => v ?? null)
    .catch(null),
  cta: ctaSchema,
  order: z.number().catch(0),
  isActive: z.boolean().catch(false),
  startsAt: time,
  endsAt: time,
});
export type Banner = z.infer<typeof bannerSchema> & { id: string };

export const newsSchema = z.object({
  title: localized,
  summary: localized,
  body: localized,
  coverImagePublicId: localizedId,
  category: z.string().catch('general'),
  isPublished: z.boolean().catch(false),
  isPinned: z.boolean().catch(false),
  publishedAt: time,
});
export type NewsItem = z.infer<typeof newsSchema> & { id: string };

export const MARKETING_ICONS = ['heart', 'users', 'shield', 'wifi-off', 'file-down', 'sparkles', 'hand'] as const;

export const marketingCardSchema = z.object({
  type: z.enum(['stat', 'tip', 'feature']).catch('tip'),
  title: localized,
  subtitle: optionalLocalized,
  icon: z.enum(MARKETING_ICONS).catch('sparkles'),
  statKey: z.string().optional().catch(undefined),
  order: z.number().catch(0),
  isActive: z.boolean().catch(false),
});
export type MarketingCard = z.infer<typeof marketingCardSchema> & { id: string };

export const STAT_KEYS = ['usersCount', 'workspacesCount', 'membersCount', 'sessionsCount'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const platformStatsSchema = z.object({
  usersCount: z.number().nonnegative().catch(0),
  workspacesCount: z.number().nonnegative().catch(0),
  membersCount: z.number().nonnegative().catch(0),
  sessionsCount: z.number().nonnegative().catch(0),
  updatedAt: time,
});
export type PlatformStats = z.infer<typeof platformStatsSchema>;

export const supportConfigSchema = z.object({
  instapayLink: z.string().catch(''),
  instapayAddress: z.string().catch(''),
  message: localized,
  developerName: z.string().catch(''),
  developerWebsite: z.string().catch(''),
  isEnabled: z.boolean().catch(false),
});
export type SupportConfig = z.infer<typeof supportConfigSchema>;

/** Seed values that were never replaced are treated as missing. */
export function isPlaceholder(value: string | null | undefined): boolean {
  return !value || /^REPLACE(_|\/|$)/i.test(value.trim());
}

export function parseDoc<T>(schema: z.ZodType<T>, id: string, data: unknown): T & { id: string } {
  return { ...schema.parse(data ?? {}), id };
}

/** Active banners inside their schedule window, in order. startsAt/endsAt are filtered here, not in the query. */
export function visibleBanners(banners: Banner[], now: number): Banner[] {
  return banners
    .filter((b) => b.isActive && (b.startsAt == null || b.startsAt <= now) && (b.endsAt == null || b.endsAt > now))
    .sort((a, b) => a.order - b.order);
}

/** Pinned first, then newest. */
export function sortNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
}

// Internal destinations a banner may open. Content is admin-written, but it still only
// navigates inside the app or to https pages.
const ROUTE_ALIASES: Record<string, string> = {
  '/(tabs)/activities': '/activities',
  '/(tabs)/sessions': '/sessions',
  '/(tabs)/settings': '/settings',
  '/(tabs)/profile': '/profile',
  '/(tabs)': '/',
};
const ALLOWED_ROUTES = [/^\/$/, /^\/(activities|sessions|settings|profile|news|support|members|export|import|cities|beneficiaries|about)(\/[\w-]+)?$/];

export type ResolvedCta = { kind: 'route'; href: string } | { kind: 'url'; url: string } | null;

export function resolveCta(cta: { type: 'route' | 'url'; target: string } | null | undefined): ResolvedCta {
  if (!cta || isPlaceholder(cta.target)) return null;
  const target = cta.target.trim();
  if (cta.type === 'url') {
    try {
      const url = new URL(target);
      return url.protocol === 'https:' ? { kind: 'url', url: url.toString() } : null;
    } catch {
      return null;
    }
  }
  const href = ROUTE_ALIASES[target] ?? target.replace(/^\/\(app\)/, '').replace(/^\/\((tabs|ws)\)/, '') ?? target;
  const path = href === '' ? '/' : href;
  return ALLOWED_ROUTES.some((re) => re.test(path.split('?')[0]!)) ? { kind: 'route', href: path } : null;
}

export type BannerDraft = {
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  imageAr: string | null;
  imageEn: string | null;
  ctaType: 'none' | 'route' | 'url';
  ctaTarget: string;
  ctaLabelAr: string;
  ctaLabelEn: string;
  order: string;
  isActive: boolean;
};

/** What Manage writes to banners/{id} (schedule and gradient are console-only for now). */
export type BannerPayload = {
  title: Localized;
  subtitle: Localized;
  imagePublicId: { ar: string | null; en: string | null };
  cta: { label: Localized; type: 'route' | 'url'; target: string } | null;
  order: number;
  isActive: boolean;
};

export type BannerDraftErrors = Partial<Record<keyof BannerDraft, 'required' | 'invalidTarget' | 'invalidOrder'>>;

const TITLE_MAX = 80;
const SUBTITLE_MAX = 160;

/** Validates the Manage banner form and builds the Firestore payload. */
export function validateBannerDraft(draft: BannerDraft):
  | { ok: true; value: BannerPayload }
  | { ok: false; errors: BannerDraftErrors } {
  const errors: BannerDraftErrors = {};
  const trim = (s: string, max: number) => s.trim().slice(0, max);
  if (!draft.titleAr.trim()) errors.titleAr = 'required';
  if (!draft.titleEn.trim()) errors.titleEn = 'required';
  const order = Number(draft.order);
  if (!Number.isInteger(order) || order < 0 || order > 999) errors.order = 'invalidOrder';
  let cta: BannerPayload['cta'] = null;
  if (draft.ctaType !== 'none') {
    const candidate = { type: draft.ctaType, target: draft.ctaTarget.trim() };
    if (!resolveCta(candidate)) errors.ctaTarget = 'invalidTarget';
    if (!draft.ctaLabelAr.trim()) errors.ctaLabelAr = 'required';
    if (!draft.ctaLabelEn.trim()) errors.ctaLabelEn = 'required';
    cta = { ...candidate, label: { ar: trim(draft.ctaLabelAr, 40), en: trim(draft.ctaLabelEn, 40) } };
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title: { ar: trim(draft.titleAr, TITLE_MAX), en: trim(draft.titleEn, TITLE_MAX) },
      subtitle: { ar: trim(draft.subtitleAr, SUBTITLE_MAX), en: trim(draft.subtitleEn, SUBTITLE_MAX) },
      imagePublicId: { ar: draft.imageAr, en: draft.imageEn },
      cta,
      order,
      isActive: draft.isActive,
    },
  };
}

export function draftFromBanner(banner: Banner | null, nextOrder: number): BannerDraft {
  return {
    titleAr: banner?.title.ar ?? '',
    titleEn: banner?.title.en ?? '',
    subtitleAr: banner?.subtitle.ar ?? '',
    subtitleEn: banner?.subtitle.en ?? '',
    imageAr: banner?.imagePublicId?.ar ?? null,
    imageEn: banner?.imagePublicId?.en ?? null,
    ctaType: banner?.cta?.type ?? 'none',
    ctaTarget: banner?.cta?.target ?? '',
    ctaLabelAr: banner?.cta?.label.ar ?? '',
    ctaLabelEn: banner?.cta?.label.en ?? '',
    order: String(banner?.order ?? nextOrder),
    isActive: banner?.isActive ?? false,
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * Admin-set banner gradient, or null to use the theme fallback. Picks the text color (from the two
 * given) with the better worst-case contrast, and rejects gradients where neither reaches 4.5:1.
 */
export function safeGradient(
  gradient: { from: string; to: string } | null | undefined,
  dark: string,
  light: string,
): { from: string; to: string; text: string } | null {
  if (!gradient || !HEX.test(gradient.from) || !HEX.test(gradient.to)) return null;
  const worst = (text: string) => Math.min(contrastRatio(text, gradient.from), contrastRatio(text, gradient.to));
  const text = worst(dark) >= worst(light) ? dark : light;
  return worst(text) >= 4.5 ? { ...gradient, text } : null;
}

export function greetingKey(hour: number): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  if (hour >= 5 && hour < 12) return 'greetingMorning';
  if (hour >= 12 && hour < 18) return 'greetingAfternoon';
  return 'greetingEvening';
}

export type SupportView = {
  message: string;
  instapayLink: string | null;
  instapayAddress: string | null;
  developerName: string | null;
  developerWebsite: string | null;
  /** Payment details are shown only when enabled and at least one real identifier exists. */
  canDonate: boolean;
};

const httpsOnly = (value: string) => {
  if (isPlaceholder(value)) return null;
  try {
    return new URL(value.trim()).protocol === 'https:' ? value.trim() : null;
  } catch {
    return null;
  }
};

/** What the Support screen may show: placeholders and non-https links count as missing. */
export function supportView(config: SupportConfig | null, language: Language): SupportView {
  const link = config ? httpsOnly(config.instapayLink) : null;
  const address = config && !isPlaceholder(config.instapayAddress) ? config.instapayAddress.trim() : null;
  const enabled = !!config?.isEnabled;
  return {
    message: config ? pick(config.message, language) : '',
    instapayLink: enabled ? link : null,
    instapayAddress: enabled ? address : null,
    developerName: config && !isPlaceholder(config.developerName) ? config.developerName.trim() : null,
    developerWebsite: config ? httpsOnly(config.developerWebsite) : null,
    canDonate: enabled && !!(link || address),
  };
}
