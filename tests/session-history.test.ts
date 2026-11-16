import { describe, expect, it } from 'vitest';

import { dayKind, groupByDay, toRows } from '@/domain/session-history';

const now = new Date(2026, 10, 16, 10, 0);
const at = (d: number, h = 12) => new Date(2026, 10, d, h);

describe('session history grouping', () => {
  it('labels today, yesterday and earlier by calendar day', () => {
    expect(dayKind(at(16, 1), now)).toBe('today');
    expect(dayKind(at(15, 23), now)).toBe('yesterday');
    expect(dayKind(at(14), now)).toBe('earlier');
  });

  it('groups consecutive items of the same day and keeps order', () => {
    const items = [
      { id: 'a', d: at(16, 9) },
      { id: 'b', d: at(16, 8) },
      { id: 'c', d: at(15) },
      { id: 'd', d: at(10) },
      { id: 'e', d: at(10, 1) },
    ];
    const groups = groupByDay(items, (i) => i.d, now);
    expect(groups.map((g) => [g.kind, g.items.map((i) => i.id).join('')])).toEqual([
      ['today', 'ab'],
      ['yesterday', 'c'],
      ['earlier', 'de'],
    ]);
  });

  it('treats a missing date (pending server timestamp) as today', () => {
    const groups = groupByDay([{ id: 'x', d: null }], (i) => i.d, now);
    expect(groups[0].kind).toBe('today');
  });

  it('flattens to header and item rows with first/last flags', () => {
    const groups = groupByDay([{ id: 'a', d: at(16) }, { id: 'b', d: at(16) }], (i) => i.d, now);
    const rows = toRows(groups, (i) => i.id);
    expect(rows.map((r) => r.type)).toEqual(['header', 'item', 'item']);
    expect(rows[1]).toMatchObject({ first: true, last: false });
    expect(rows[2]).toMatchObject({ first: false, last: true });
  });
});
