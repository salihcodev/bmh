import type { Localized, NewsItem } from './marketing';

// News form in the dashboard (CONT-03): the draft the form edits and the validated payload that
// is written to news/{id}. Publishing (isPublished, publishedAt) is its own action, never part of
// an edit, because the rules give it its own permission key.

export const NEWS_CATEGORIES = ['general', 'announcement', 'feature', 'update', 'event', 'story'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_TITLE_MAX = 120;
export const NEWS_SUMMARY_MAX = 280;
export const NEWS_BODY_MAX = 8000;

export type NewsDraft = {
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  bodyAr: string;
  bodyEn: string;
  coverAr: string | null;
  coverEn: string | null;
  category: NewsCategory;
  isPinned: boolean;
  /** Only used when creating; an existing post is published or hidden from the list. */
  isPublished: boolean;
};

export type NewsPayload = {
  title: Localized;
  summary: Localized;
  body: Localized;
  coverImagePublicId: { ar: string | null; en: string | null };
  category: NewsCategory;
  isPinned: boolean;
};

export type NewsDraftErrors = Partial<Record<keyof NewsDraft, 'required'>>;

export function draftFromNews(item: NewsItem | null): NewsDraft {
  const category = NEWS_CATEGORIES.find((c) => c === item?.category) ?? 'general';
  return {
    titleAr: item?.title.ar ?? '',
    titleEn: item?.title.en ?? '',
    summaryAr: item?.summary.ar ?? '',
    summaryEn: item?.summary.en ?? '',
    bodyAr: item?.body.ar ?? '',
    bodyEn: item?.body.en ?? '',
    coverAr: item?.coverImagePublicId?.ar ?? null,
    coverEn: item?.coverImagePublicId?.en ?? null,
    category,
    isPinned: item?.isPinned ?? false,
    isPublished: item?.isPublished ?? false,
  };
}

/** Both languages are required for every text, so a reader never sees an empty post. */
export function validateNewsDraft(
  draft: NewsDraft,
): { ok: true; value: NewsPayload } | { ok: false; errors: NewsDraftErrors } {
  const errors: NewsDraftErrors = {};
  const required: (keyof NewsDraft)[] = ['titleAr', 'titleEn', 'summaryAr', 'summaryEn', 'bodyAr', 'bodyEn'];
  for (const key of required) {
    if (!String(draft[key]).trim()) errors[key] = 'required';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const cut = (value: string, max: number) => value.trim().slice(0, max);
  return {
    ok: true,
    value: {
      title: { ar: cut(draft.titleAr, NEWS_TITLE_MAX), en: cut(draft.titleEn, NEWS_TITLE_MAX) },
      summary: { ar: cut(draft.summaryAr, NEWS_SUMMARY_MAX), en: cut(draft.summaryEn, NEWS_SUMMARY_MAX) },
      body: { ar: cut(draft.bodyAr, NEWS_BODY_MAX), en: cut(draft.bodyEn, NEWS_BODY_MAX) },
      coverImagePublicId: { ar: draft.coverAr, en: draft.coverEn },
      category: draft.category,
      isPinned: draft.isPinned,
    },
  };
}
