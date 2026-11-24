import { describe, expect, it } from 'vitest';

import { newsSchema, parseDoc, visibleBanners, bannerSchema } from '@/domain/marketing';
import { draftFromNews, validateNewsDraft } from '@/domain/news-admin';

const item = parseDoc(newsSchema, 'n1', {
  title: { ar: 'عنوان', en: 'Title' },
  summary: { ar: 'ملخص', en: 'Summary' },
  body: { ar: 'نص', en: 'Body' },
  coverImagePublicId: { ar: 'be-my-hand/news/a', en: null },
  category: 'event',
  isPublished: true,
  isPinned: true,
});

describe('validateNewsDraft', () => {
  it('builds a payload without any publishing fields', () => {
    const result = validateNewsDraft(draftFromNews(item));
    expect(result).toEqual({
      ok: true,
      value: {
        title: { ar: 'عنوان', en: 'Title' },
        summary: { ar: 'ملخص', en: 'Summary' },
        body: { ar: 'نص', en: 'Body' },
        coverImagePublicId: { ar: 'be-my-hand/news/a', en: null },
        category: 'event',
        isPinned: true,
      },
    });
  });

  it('asks for every text in both languages', () => {
    const draft = { ...draftFromNews(null), titleAr: 'ع', summaryAr: 'ع', bodyAr: 'ع' };
    expect(validateNewsDraft(draft)).toEqual({
      ok: false,
      errors: { titleEn: 'required', summaryEn: 'required', bodyEn: 'required' },
    });
  });

  it('trims and caps text, and maps an unknown category to general', () => {
    const draft = { ...draftFromNews(null), titleAr: ' ع ', titleEn: ' E ', summaryAr: 's', summaryEn: 's', bodyAr: 'b', bodyEn: 'b' };
    expect(validateNewsDraft(draft)).toMatchObject({ ok: true, value: { title: { ar: 'ع', en: 'E' }, category: 'general' } });
    const long = { ...draft, titleAr: 'x'.repeat(500) };
    const result = validateNewsDraft(long);
    expect(result.ok && result.value.title.ar.length).toBe(120);
    expect(draftFromNews({ ...item, category: 'weird' }).category).toBe('general');
  });
});

describe('deleted content', () => {
  it('news and banners read isDeleted, defaulting to false', () => {
    expect(item.isDeleted).toBe(false);
    expect(parseDoc(newsSchema, 'n2', { isDeleted: true }).isDeleted).toBe(true);
  });

  it('a deleted banner is never visible, even if it is still marked active', () => {
    const base = { title: { ar: 'ع', en: 'E' }, order: 1, isActive: true };
    const live = parseDoc(bannerSchema, 'b1', base);
    const gone = parseDoc(bannerSchema, 'b2', { ...base, isDeleted: true });
    expect(visibleBanners([live, gone], 1000).map((b) => b.id)).toEqual(['b1']);
  });
});
