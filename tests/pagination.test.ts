import { describe, expect, it } from 'vitest';

import {
  canLoadMore,
  initialPageState,
  pageReducer,
  selectItems,
  selectStatus,
  type PageAction,
  type PageState,
} from '@/lib/pagination';

type Item = { id: string };
type S = PageState<Item, string>;
const items = (...ids: string[]) => ids.map((id) => ({ id }));
const run = (actions: PageAction<Item, string>[], from: S = initialPageState()) =>
  actions.reduce<S>((s, a) => pageReducer(s, a), from);

describe('pagination reducer', () => {
  it('starts loading with nothing to load more', () => {
    const s = initialPageState<Item, string>();
    expect(selectStatus(s)).toBe('loading');
    expect(selectItems(s)).toBeNull();
    expect(canLoadMore(s)).toBe(false);
  });

  it('marks done when the first page is short', () => {
    const s = run([{ type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 3, fromCache: false }]);
    expect(s.done).toBe(true);
    expect(canLoadMore(s)).toBe(false);
    expect(selectStatus(s)).toBe('ready');
  });

  it('reports empty for an empty first page', () => {
    const s = run([{ type: 'first', items: [], cursor: null, pageSize: 3, fromCache: true }]);
    expect(selectStatus(s)).toBe('empty');
    expect(s.fromCache).toBe(true);
  });

  it('appends pages and stops on a short page', () => {
    const s = run([
      { type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 2, fromCache: false },
      { type: 'moreStart' },
      { type: 'more', items: items('c', 'd'), cursor: 'd', pageSize: 2 },
      { type: 'moreStart' },
      { type: 'more', items: items('e'), cursor: 'e', pageSize: 2 },
    ]);
    expect(selectItems(s)?.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(s.cursor).toBe('e');
    expect(s.done).toBe(true);
  });

  it('blocks a second loadMore while one is in flight', () => {
    const s = run([
      { type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 2, fromCache: false },
      { type: 'moreStart' },
    ]);
    expect(canLoadMore(s)).toBe(false);
  });

  it('keeps the cursor when a later page comes back empty', () => {
    const s = run([
      { type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 2, fromCache: false },
      { type: 'more', items: [], cursor: null, pageSize: 2 },
    ]);
    expect(s.cursor).toBe('b');
    expect(s.done).toBe(true);
  });

  it('de-duplicates rows that shifted between the live first page and appended pages', () => {
    const s = run([
      { type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 2, fromCache: false },
      { type: 'more', items: items('b', 'c'), cursor: 'c', pageSize: 2 },
    ]);
    expect(selectItems(s)?.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('a new live first page drops appended pages and their stale cursor', () => {
    const s = run([
      { type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 2, fromCache: false },
      { type: 'more', items: items('c', 'd'), cursor: 'd', pageSize: 2 },
      { type: 'first', items: items('z', 'a'), cursor: 'a', pageSize: 2, fromCache: false },
    ]);
    expect(selectItems(s)?.map((i) => i.id)).toEqual(['z', 'a']);
    expect(s.cursor).toBe('a');
    expect(s.done).toBe(false);
  });

  it('a later-page error keeps the list and can be retried', () => {
    const s = run([
      { type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 2, fromCache: false },
      { type: 'moreStart' },
      { type: 'moreError', error: new Error('offline') },
    ]);
    expect(selectStatus(s)).toBe('ready');
    expect(s.moreError).toBeInstanceOf(Error);
    expect(canLoadMore(s)).toBe(true);
    const retried = pageReducer(s, { type: 'moreStart' });
    expect(retried.moreError).toBeNull();
  });

  it('a first-page error before any data is an error state', () => {
    const s = run([{ type: 'firstError', error: new Error('permission-denied') }]);
    expect(selectStatus(s)).toBe('error');
    expect(canLoadMore(s)).toBe(false);
  });

  it('refresh clears the refreshing flag when the new first page arrives', () => {
    const s = run([
      { type: 'first', items: items('a'), cursor: 'a', pageSize: 2, fromCache: false },
      { type: 'refresh' },
    ]);
    expect(s.refreshing).toBe(true);
    const after = pageReducer(s, { type: 'first', items: items('a', 'b'), cursor: 'b', pageSize: 2, fromCache: false });
    expect(after.refreshing).toBe(false);
  });

  it('reset returns to the initial state', () => {
    const s = run([
      { type: 'first', items: items('a'), cursor: 'a', pageSize: 2, fromCache: false },
      { type: 'reset' },
    ]);
    expect(s).toEqual(initialPageState());
  });
});
