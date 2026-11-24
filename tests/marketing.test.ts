import { describe, expect, it } from 'vitest';

import {
  bannerSchema,
  developerView,
  draftFromBanner,
  validateBannerDraft,
  greetingKey,
  isPlaceholder,
  newsSchema,
  parseDoc,
  pick,
  platformStatsSchema,
  resolveCta,
  safeGradient,
  sortNews,
  developerConfigSchema,
  visibleBanners,
  type Banner,
} from '@/domain/marketing';

const banner = (id: string, patch: Record<string, unknown> = {}): Banner =>
  parseDoc(bannerSchema, id, { title: { ar: 'ع', en: 'E' }, subtitle: {}, order: 1, isActive: true, ...patch });

describe('marketing normalizers', () => {
  it('fills missing fields with safe defaults instead of throwing', () => {
    const b = parseDoc(bannerSchema, 'x', { title: 'not an object', order: 'nope' });
    expect(b).toMatchObject({ id: 'x', title: { ar: '', en: '' }, order: 0, isActive: false, cta: null });
  });

  it('reads Firestore timestamps as millis', () => {
    const n = parseDoc(newsSchema, 'n', { publishedAt: { seconds: 10, nanoseconds: 0 }, isPublished: true });
    expect(n.publishedAt).toBe(10_000);
    const m = parseDoc(newsSchema, 'm', { publishedAt: { toMillis: () => 42 } });
    expect(m.publishedAt).toBe(42);
  });

  it('never shows negative stats', () => {
    expect(platformStatsSchema.parse({ usersCount: -5, workspacesCount: 3 })).toMatchObject({ usersCount: 0, workspacesCount: 3 });
  });

  it('reads the developer credit and ignores the old payment fields', () => {
    expect(developerConfigSchema.parse({})).toEqual({ developerName: '', developerWebsite: '' });
    expect(developerConfigSchema.parse({ developerName: 'Dev', instapayLink: 'https://x', isEnabled: true })).toEqual({
      developerName: 'Dev',
      developerWebsite: '',
    });
  });
});

describe('pick', () => {
  it('prefers the language and falls back to the other one', () => {
    expect(pick({ ar: 'مرحبا', en: 'Hi' }, 'en')).toBe('Hi');
    expect(pick({ ar: 'مرحبا', en: '' }, 'en')).toBe('مرحبا');
    expect(pick(null, 'ar')).toBe('');
  });
});

describe('visibleBanners', () => {
  it('keeps active banners inside their window, ordered', () => {
    const now = 1000;
    const list = [
      banner('late', { order: 3 }),
      banner('first', { order: 1 }),
      banner('off', { isActive: false }),
      banner('future', { startsAt: 2000 }),
      banner('expired', { endsAt: 500 }),
      banner('window', { order: 2, startsAt: 500, endsAt: 1500 }),
    ];
    expect(visibleBanners(list, now).map((b) => b.id)).toEqual(['first', 'window', 'late']);
  });
});

describe('sortNews', () => {
  it('puts pinned items first, then newest', () => {
    const items = [
      parseDoc(newsSchema, 'old', { publishedAt: 1 }),
      parseDoc(newsSchema, 'pinnedOld', { publishedAt: 0, isPinned: true }),
      parseDoc(newsSchema, 'new', { publishedAt: 5 }),
    ];
    expect(sortNews(items).map((n) => n.id)).toEqual(['pinnedOld', 'new', 'old']);
  });
});

describe('resolveCta', () => {
  it('maps legacy tab routes and strips groups', () => {
    expect(resolveCta({ type: 'route', target: '/(tabs)/activities' })).toEqual({ kind: 'route', href: '/activities' });
    expect(resolveCta({ type: 'route', target: '/(app)/members' })).toEqual({ kind: 'route', href: '/members' });
    expect(resolveCta({ type: 'route', target: '/news' })).toEqual({ kind: 'route', href: '/news' });
    expect(resolveCta({ type: 'route', target: '/store' })).toEqual({ kind: 'route', href: '/store' });
    expect(resolveCta({ type: 'route', target: '/export' })).toEqual({ kind: 'route', href: '/export' });
  });

  it('rejects routes outside the allowlist', () => {
    expect(resolveCta({ type: 'route', target: '/manage/users' })).toBeNull();
    expect(resolveCta({ type: 'route', target: 'javascript:alert(1)' })).toBeNull();
  });

  it('only opens https links', () => {
    expect(resolveCta({ type: 'url', target: 'https://asalih.vercel.app' })).toEqual({ kind: 'url', url: 'https://asalih.vercel.app/' });
    expect(resolveCta({ type: 'url', target: 'http://example.com' })).toBeNull();
    expect(resolveCta({ type: 'url', target: 'intent://x' })).toBeNull();
  });

  it('ignores unreplaced seed placeholders', () => {
    expect(isPlaceholder('REPLACE_WITH_INSTAPAY_LINK')).toBe(true);
    expect(isPlaceholder('REPLACE/banner.webp')).toBe(true);
    expect(isPlaceholder('https://ipn.eg/S/x')).toBe(false);
    expect(resolveCta({ type: 'url', target: 'REPLACE_WITH_URL' })).toBeNull();
  });
});

describe('safeGradient', () => {
  const ink = '#202020';
  const white = '#FFFFFF';
  it('picks the readable text color', () => {
    expect(safeGradient({ from: '#C9F158', to: '#B5E040' }, ink, white)?.text).toBe(ink);
    expect(safeGradient({ from: '#202020', to: '#2A3112' }, ink, white)?.text).toBe(white);
  });

  it('rejects invalid or unreadable gradients', () => {
    expect(safeGradient({ from: 'red', to: '#000000' }, ink, white)).toBeNull();
    expect(safeGradient({ from: '#FFFFFF', to: '#000000' }, ink, white)).toBeNull();
    expect(safeGradient(null, ink, white)).toBeNull();
  });
});

describe('validateBannerDraft', () => {
  const base = draftFromBanner(null, 5);

  it('starts hidden with the next order', () => {
    expect(base).toMatchObject({ order: '5', isActive: false, ctaType: 'none' });
  });

  it('requires both titles and a valid order', () => {
    const result = validateBannerDraft({ ...base, order: '-1' });
    expect(result).toEqual({ ok: false, errors: { titleAr: 'required', titleEn: 'required', order: 'invalidOrder' } });
  });

  it('validates the CTA destination and labels', () => {
    const draft = { ...base, titleAr: 'ع', titleEn: 'E', ctaType: 'url' as const, ctaTarget: 'http://x.com' };
    expect(validateBannerDraft(draft)).toEqual({
      ok: false,
      errors: { ctaTarget: 'invalidTarget', ctaLabelAr: 'required', ctaLabelEn: 'required' },
    });
  });

  it('builds the payload and round-trips an existing banner', () => {
    const draft = {
      ...base,
      titleAr: ' عنوان ',
      titleEn: 'Title',
      imageAr: 'abc',
      ctaType: 'route' as const,
      ctaTarget: '/news',
      ctaLabelAr: 'اقرأ',
      ctaLabelEn: 'Read',
      isActive: true,
    };
    const result = validateBannerDraft(draft);
    expect(result).toEqual({
      ok: true,
      value: {
        title: { ar: 'عنوان', en: 'Title' },
        subtitle: { ar: '', en: '' },
        imagePublicId: { ar: 'abc', en: null },
        cta: { type: 'route', target: '/news', label: { ar: 'اقرأ', en: 'Read' } },
        order: 5,
        isActive: true,
      },
    });
    if (result.ok) {
      const again = draftFromBanner({ ...result.value, id: 'b', startsAt: null, endsAt: null, gradient: null }, 0);
      expect(again).toEqual({ ...draft, titleAr: 'عنوان' });
    }
  });
});

describe('greetingKey', () => {
  it('picks the greeting by hour', () => {
    expect(greetingKey(8)).toBe('greetingMorning');
    expect(greetingKey(14)).toBe('greetingAfternoon');
    expect(greetingKey(22)).toBe('greetingEvening');
    expect(greetingKey(2)).toBe('greetingEvening');
  });
});

describe('developerView', () => {
  it('shows a real name and an https website', () => {
    expect(developerView({ developerName: 'Dev', developerWebsite: 'https://example.dev' })).toEqual({ name: 'Dev', website: 'https://example.dev' });
  });

  it('treats seed placeholders and non-https links as missing', () => {
    expect(developerView({ developerName: 'REPLACE_WITH_DEVELOPER_NAME', developerWebsite: 'http://insecure.example' })).toEqual({ name: null, website: null });
    expect(developerView({ developerName: '', developerWebsite: 'javascript:alert(1)' }).website).toBeNull();
    expect(developerView({ developerName: '', developerWebsite: 'not a url' }).website).toBeNull();
  });

  it('handles a missing config', () => {
    expect(developerView(null)).toEqual({ name: null, website: null });
  });
});
