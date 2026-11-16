import { describe, expect, it } from 'vitest';

import {
  buildItem,
  canTransition,
  chunk,
  countItems,
  evaluateCount,
  nextPendingId,
  orderForSession,
  summarizeSession,
} from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';

describe('session setup', () => {
  it('blocks above the limit using limit(max + 1)', () => {
    expect(SESSION_CONFIG.maxBeneficiaries).toBe(100);
    expect(evaluateCount(0)).toEqual({ state: 'none' });
    expect(evaluateCount(1)).toEqual({ state: 'ok', count: 1 });
    expect(evaluateCount(100)).toEqual({ state: 'ok', count: 100 });
    expect(evaluateCount(101)).toEqual({ state: 'tooMany', count: 101 });
  });

  it('chunks area ids for Firestore `in` (max 30)', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `a${i}`);
    expect(chunk(ids, 30).map((c) => c.length)).toEqual([30, 30, 5]);
  });

  it('orders by area then normalized name, stably', () => {
    const list = [
      { id: '3', areaName: 'B', nameSearch: 'a' },
      { id: '1', areaName: 'A', nameSearch: 'z' },
      { id: '2', areaName: 'A', nameSearch: 'b' },
    ];
    expect(orderForSession(list).map((b) => b.id)).toEqual(['2', '1', '3']);
  });

  it('never snapshots the same beneficiary twice', () => {
    const b = { id: '1', areaName: 'A', nameSearch: 'a' };
    expect(orderForSession([b, { ...b }, { id: '2', areaName: 'A', nameSearch: 'b' }]).map((x) => x.id)).toEqual(['1', '2']);
  });

  it('builds a pending snapshot item keyed by beneficiary', () => {
    const item = buildItem(
      { id: 'b1', fullName: 'X', householdCount: 2, primaryPhone: null, phones: [], areaId: 'a', areaName: 'A', mapPins: [] },
      4,
    );
    expect(item).toMatchObject({ beneficiaryId: 'b1', order: 4, status: 'pending', processedAt: null, note: null });
  });
});

describe('session runner', () => {
  const items = [
    { id: 'a', order: 0, status: 'checked' as const, householdCount: 3, areaName: 'A' },
    { id: 'b', order: 1, status: 'pending' as const, householdCount: 2, areaName: 'A' },
    { id: 'c', order: 2, status: 'ignored' as const, householdCount: 1, areaName: 'B' },
    { id: 'd', order: 3, status: 'pending' as const, householdCount: 4, areaName: 'B' },
  ];

  it('mirrors rule transitions', () => {
    expect(canTransition('pending', 'checked')).toBe(true);
    expect(canTransition('pending', 'ignored')).toBe(true);
    expect(canTransition('ignored', 'pending')).toBe(true);
    expect(canTransition('checked', 'pending')).toBe(false);
    expect(canTransition('checked', 'ignored')).toBe(false);
    expect(canTransition('ignored', 'checked')).toBe(false);
  });

  it('advances to the next pending item and wraps', () => {
    expect(nextPendingId(items)).toBe('b');
    expect(nextPendingId(items, 1)).toBe('d');
    expect(nextPendingId(items, 3)).toBe('b');
    expect(nextPendingId(items.map((i) => ({ ...i, status: 'checked' as const })))).toBeNull();
  });

  it('counts and summarizes from items', () => {
    expect(countItems(items)).toEqual({ checked: 1, ignored: 1, pending: 2, total: 4 });
    const summary = summarizeSession(items);
    expect(summary.householdsChecked).toBe(3);
    expect(summary.byArea).toEqual({ A: { checked: 1, ignored: 0, pending: 1 }, B: { checked: 0, ignored: 1, pending: 1 } });
  });
});
