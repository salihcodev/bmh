import { describe, expect, it } from 'vitest';

import {
  draftFromMessage,
  emptyMessageDraft,
  inWindow,
  isVisible,
  matchesAudience,
  normalizeSystemMessage,
  resolveMessageText,
  resolveMessageTitle,
  validateMessageDraft,
  type Reader,
} from '@/domain/system-message';

const NOW = 1_000_000;
const reader: Reader = { userType: 'member', roleIds: ['workspace-admin'] };

function message(overrides: Record<string, unknown> = {}) {
  return normalizeSystemMessage('sync_queue_info', {
    category: 'info-text',
    type: 'info',
    title: { ar: 'عنوان', en: 'Title' },
    text: { ar: 'نص', en: 'Text' },
    placement: 'sync-sheet',
    audience: { kind: 'all', values: [] },
    isPublished: true,
    isDeleted: false,
    ...overrides,
  });
}

describe('normalizeSystemMessage', () => {
  it('reads a full document, including Firestore timestamps', () => {
    const m = message({ startsAt: { toMillis: () => 5 }, endsAt: { seconds: 9 } });
    expect(m).toMatchObject({ key: 'sync_queue_info', category: 'info-text', startsAt: 5, endsAt: 9000, isPublished: true });
  });

  it('degrades unknown values to the safe reading', () => {
    const m = normalizeSystemMessage('x', { category: 'weird', type: 'loud', text: 'nope', isPublished: 'yes' });
    expect(m).toMatchObject({
      category: 'message',
      type: 'info',
      text: { ar: '', en: '' },
      audience: { kind: 'all', values: [] },
      isPublished: false,
      title: null,
    });
  });
});

describe('windows and audiences', () => {
  it('applies start and end, with the end exclusive', () => {
    expect(inWindow({ startsAt: null, endsAt: null }, NOW)).toBe(true);
    expect(inWindow({ startsAt: NOW + 1, endsAt: null }, NOW)).toBe(false);
    expect(inWindow({ startsAt: NOW, endsAt: null }, NOW)).toBe(true);
    expect(inWindow({ startsAt: null, endsAt: NOW }, NOW)).toBe(false);
  });

  it('matches by user type or role, and never widens an empty targeted audience', () => {
    expect(matchesAudience({ kind: 'all', values: [] }, reader)).toBe(true);
    expect(matchesAudience({ kind: 'userType', values: ['member'] }, reader)).toBe(true);
    expect(matchesAudience({ kind: 'userType', values: ['supplier'] }, reader)).toBe(false);
    expect(matchesAudience({ kind: 'userType', values: [] }, reader)).toBe(false);
    expect(matchesAudience({ kind: 'role', values: ['workspace-admin'] }, reader)).toBe(true);
    expect(matchesAudience({ kind: 'role', values: ['viewer'] }, reader)).toBe(false);
    expect(matchesAudience({ kind: 'userType', values: ['member'] }, { userType: null, roleIds: [] })).toBe(false);
  });

  it('is visible only when published, not deleted, in window and addressed to the reader', () => {
    expect(isVisible(message(), reader, NOW)).toBe(true);
    expect(isVisible(message({ isPublished: false }), reader, NOW)).toBe(false);
    expect(isVisible(message({ isDeleted: true }), reader, NOW)).toBe(false);
    expect(isVisible(message({ endsAt: NOW - 1 }), reader, NOW)).toBe(false);
    expect(isVisible(message({ audience: { kind: 'userType', values: ['supplier'] } }), reader, NOW)).toBe(false);
  });
});

describe('resolveMessageText', () => {
  it('uses the admin text in the reader language', () => {
    expect(resolveMessageText(message(), reader, NOW, 'en', 'fallback')).toBe('Text');
    expect(resolveMessageText(message(), reader, NOW, 'ar', 'fallback')).toBe('نص');
  });

  it('falls back to the app string when nothing applies', () => {
    expect(resolveMessageText(null, reader, NOW, 'en', 'fallback')).toBe('fallback');
    expect(resolveMessageText(message({ isPublished: false }), reader, NOW, 'en', 'fallback')).toBe('fallback');
    expect(resolveMessageText(message({ text: { ar: '', en: '' } }), reader, NOW, 'en', 'fallback')).toBe('fallback');
  });

  it('uses the other language when the reader language is empty', () => {
    expect(resolveMessageText(message({ text: { ar: 'نص', en: '' } }), reader, NOW, 'en', 'fallback')).toBe('نص');
  });

  it('resolves the optional title', () => {
    expect(resolveMessageTitle(message(), 'en')).toBe('Title');
    expect(resolveMessageTitle(message({ title: null }), 'en')).toBeNull();
    expect(resolveMessageTitle(null, 'en')).toBeNull();
  });
});

describe('validateMessageDraft', () => {
  const valid = () => ({
    ...emptyMessageDraft('alert'),
    key: 'maintenance_notice',
    textAr: 'صيانة',
    textEn: 'Maintenance',
    placement: 'home-top',
  });

  it('builds the payload the rules accept', () => {
    const result = validateMessageDraft({ ...valid(), titleAr: 'تنبيه', titleEn: 'Notice', type: 'warning' }, { isNew: true });
    expect(result).toEqual({
      ok: true,
      value: {
        key: 'maintenance_notice',
        category: 'alert',
        type: 'warning',
        title: { ar: 'تنبيه', en: 'Notice' },
        text: { ar: 'صيانة', en: 'Maintenance' },
        placement: 'home-top',
        audience: { kind: 'all', values: [] },
        isPublished: false,
      },
    });
  });

  it('requires both languages for the text and a placement', () => {
    const result = validateMessageDraft({ ...valid(), textEn: ' ', placement: '' }, { isNew: true });
    expect(result).toMatchObject({ ok: false, errors: { textEn: 'required', placement: 'required' } });
  });

  it('allows no title, but not a title in one language only', () => {
    expect(validateMessageDraft(valid(), { isNew: true })).toMatchObject({ ok: true, value: { title: null } });
    expect(validateMessageDraft({ ...valid(), titleAr: 'عنوان' }, { isNew: true })).toMatchObject({
      ok: false,
      errors: { titleEn: 'bothLanguages' },
    });
  });

  it('validates the key only for new messages', () => {
    expect(validateMessageDraft({ ...valid(), key: 'Bad Key' }, { isNew: true })).toMatchObject({ ok: false, errors: { key: 'invalidKey' } });
    expect(validateMessageDraft({ ...valid(), key: 'new' }, { isNew: true })).toMatchObject({ ok: false, errors: { key: 'invalidKey' } });
    expect(validateMessageDraft({ ...valid(), key: '' }, { isNew: true })).toMatchObject({ ok: false, errors: { key: 'required' } });
    expect(validateMessageDraft({ ...valid(), key: '' }, { isNew: false })).toMatchObject({ ok: true });
  });

  it('requires values for a targeted audience', () => {
    const targeted = { ...valid(), audienceKind: 'userType' as const };
    expect(validateMessageDraft(targeted, { isNew: true })).toMatchObject({ ok: false, errors: { audienceValues: 'audienceEmpty' } });
    expect(validateMessageDraft({ ...targeted, audienceValues: ['member'] }, { isNew: true })).toMatchObject({
      ok: true,
      value: { audience: { kind: 'userType', values: ['member'] } },
    });
  });

  it('round-trips an existing message through the draft', () => {
    const existing = message({ category: 'message' });
    const result = validateMessageDraft(draftFromMessage(existing), { isNew: false });
    expect(result).toMatchObject({ ok: true, value: { category: 'message', placement: 'sync-sheet', isPublished: true } });
  });
});
