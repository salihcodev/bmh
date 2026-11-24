import { describe, expect, it } from 'vitest';

import {
  draftFromSupportMethod,
  emptySupportDraft,
  nextSupportOrder,
  normalizeSupportMethod,
  safeHttpsUrl,
  swapOrders,
  validateSupportDraft,
  visibleSupportMethods,
} from '@/domain/support-method';

const method = (id: string, overrides: Record<string, unknown> = {}) =>
  normalizeSupportMethod(id, {
    title: { ar: 'إنستا باي', en: 'InstaPay' },
    description: { ar: '', en: '' },
    copyValue: 'name@instapay',
    linkUrl: 'https://ipn.eg/S/x/instapay/y',
    order: 0,
    isActive: true,
    isDeleted: false,
    ...overrides,
  });

describe('normalizeSupportMethod', () => {
  it('reads a document', () => {
    expect(method('a')).toMatchObject({
      id: 'a',
      title: { ar: 'إنستا باي', en: 'InstaPay' },
      copyValue: 'name@instapay',
      linkUrl: 'https://ipn.eg/S/x/instapay/y',
      copyLabel: null,
      imagePublicId: null,
      isActive: true,
    });
  });

  it('drops seed placeholders and unsafe links', () => {
    expect(method('a', { copyValue: 'REPLACE_WITH_INSTAPAY_ADDRESS' }).copyValue).toBeNull();
    expect(method('a', { linkUrl: 'http://insecure.example' }).linkUrl).toBeNull();
    expect(method('a', { linkUrl: 'javascript:alert(1)' }).linkUrl).toBeNull();
    expect(safeHttpsUrl('REPLACE_WITH_INSTAPAY_LINK')).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
  });

  it('survives garbage', () => {
    expect(normalizeSupportMethod('x', null)).toMatchObject({ order: 0, isActive: false, isDeleted: false, copyValue: null });
  });
});

describe('visibleSupportMethods', () => {
  it('lists active, undeleted, actionable methods in order', () => {
    const list = visibleSupportMethods([
      method('late', { order: 2 }),
      method('early', { order: 1 }),
      method('hidden', { isActive: false }),
      method('deleted', { isDeleted: true }),
      method('empty', { copyValue: '', linkUrl: '' }),
      method('untitled', { title: { ar: '', en: '' } }),
    ]);
    expect(list.map((m) => m.id)).toEqual(['early', 'late']);
  });
});

describe('validateSupportDraft', () => {
  const valid = () => ({ ...emptySupportDraft(), titleAr: 'فودافون كاش', titleEn: 'Vodafone Cash', copyValue: ' 01000000000 ' });

  it('builds the payload the rules accept', () => {
    expect(validateSupportDraft(valid())).toEqual({
      ok: true,
      value: {
        title: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
        description: { ar: '', en: '' },
        imagePublicId: null,
        copyValue: '01000000000',
        copyLabel: null,
        linkUrl: null,
      },
    });
  });

  it('requires both titles and something to copy or open', () => {
    expect(validateSupportDraft({ ...emptySupportDraft(), titleAr: 'ع' })).toMatchObject({
      ok: false,
      errors: { titleEn: 'required', copyValue: 'nothingToDo' },
    });
  });

  it('accepts a link alone, https only', () => {
    const base = { ...emptySupportDraft(), titleAr: 'ع', titleEn: 'E' };
    expect(validateSupportDraft({ ...base, linkUrl: 'https://ipn.eg/x' })).toMatchObject({ ok: true, value: { linkUrl: 'https://ipn.eg/x', copyValue: null } });
    expect(validateSupportDraft({ ...base, linkUrl: 'http://ipn.eg/x' })).toMatchObject({ ok: false, errors: { linkUrl: 'invalidLink' } });
    expect(validateSupportDraft({ ...base, linkUrl: 'javascript:alert(1)' })).toMatchObject({ ok: false, errors: { linkUrl: 'invalidLink' } });
  });

  it('wants the copy label in both languages or neither', () => {
    expect(validateSupportDraft({ ...valid(), copyLabelAr: 'العنوان' })).toMatchObject({ ok: false, errors: { copyLabelEn: 'bothLanguages' } });
    expect(validateSupportDraft({ ...valid(), copyLabelAr: 'العنوان', copyLabelEn: 'Address' })).toMatchObject({
      ok: true,
      value: { copyLabel: { ar: 'العنوان', en: 'Address' } },
    });
  });

  it('round-trips an existing method', () => {
    const draft = draftFromSupportMethod(method('a', { copyLabel: { ar: 'العنوان', en: 'Address' }, imagePublicId: 'be-my-hand/support/qr' }));
    expect(validateSupportDraft(draft)).toMatchObject({ ok: true, value: { imagePublicId: 'be-my-hand/support/qr', copyValue: 'name@instapay' } });
  });
});

describe('ordering', () => {
  const sorted = [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
  ];

  it('picks the next order after the last, capped at 999', () => {
    expect(nextSupportOrder([])).toBe(0);
    expect(nextSupportOrder(sorted)).toBe(3);
    expect(nextSupportOrder([{ order: 999 }])).toBe(999);
  });

  it('swaps two neighbours and does nothing at the ends', () => {
    expect(swapOrders(sorted, 'b', 'up')).toEqual([{ id: 'b', order: 0 }, { id: 'a', order: 1 }]);
    expect(swapOrders(sorted, 'b', 'down')).toEqual([{ id: 'b', order: 2 }, { id: 'c', order: 1 }]);
    expect(swapOrders(sorted, 'a', 'up')).toEqual([]);
    expect(swapOrders(sorted, 'c', 'down')).toEqual([]);
    expect(swapOrders(sorted, 'zzz', 'up')).toEqual([]);
  });

  it('still changes something when two methods share an order', () => {
    const tied = [
      { id: 'a', order: 1 },
      { id: 'b', order: 1 },
    ];
    expect(swapOrders(tied, 'b', 'up')).toEqual([{ id: 'b', order: 1 }, { id: 'a', order: 2 }]);
    expect(swapOrders(tied, 'a', 'down')).toEqual([{ id: 'b', order: 1 }, { id: 'a', order: 2 }]);
  });
});
