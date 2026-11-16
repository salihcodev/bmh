// Pure page state for cursor pagination: a live (or one-shot) first page plus appended pages.
// Kept free of Firebase so it is unit-tested in tests/pagination.test.ts.

export type PageStatus = 'loading' | 'empty' | 'ready' | 'error';

export type PageState<T, C> = {
  first: T[] | null;
  more: T[];
  cursor: C | null;
  done: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  fromCache: boolean;
  /** Error loading the first page (blocks the list). */
  error: unknown;
  /** Error loading a later page (shown in the footer; the list stays). */
  moreError: unknown;
};

export type PageAction<T, C> =
  | { type: 'reset' }
  | { type: 'refresh' }
  | { type: 'first'; items: T[]; cursor: C | null; pageSize: number; fromCache: boolean }
  | { type: 'firstError'; error: unknown }
  | { type: 'moreStart' }
  | { type: 'more'; items: T[]; cursor: C | null; pageSize: number }
  | { type: 'moreError'; error: unknown };

export function initialPageState<T, C>(): PageState<T, C> {
  return {
    first: null,
    more: [],
    cursor: null,
    done: false,
    loadingMore: false,
    refreshing: false,
    fromCache: false,
    error: null,
    moreError: null,
  };
}

export function pageReducer<T, C>(state: PageState<T, C>, action: PageAction<T, C>): PageState<T, C> {
  switch (action.type) {
    case 'reset':
      return initialPageState();
    case 'refresh':
      return { ...state, refreshing: true, moreError: null };
    case 'first':
      // A new first page (live update or refresh) drops appended pages: their cursor may be stale.
      return {
        ...state,
        first: action.items,
        more: [],
        cursor: action.cursor,
        done: action.items.length < action.pageSize,
        fromCache: action.fromCache,
        refreshing: false,
        loadingMore: false,
        error: null,
        moreError: null,
      };
    case 'firstError':
      return { ...state, error: action.error, refreshing: false };
    case 'moreStart':
      return { ...state, loadingMore: true, moreError: null };
    case 'more':
      return {
        ...state,
        more: [...state.more, ...action.items],
        cursor: action.cursor ?? state.cursor,
        done: action.items.length < action.pageSize,
        loadingMore: false,
      };
    case 'moreError':
      return { ...state, loadingMore: false, moreError: action.error };
  }
}

/** First page + appended pages, de-duplicated by id (a row can shift between pages while live). */
export function selectItems<T extends { id: string }>(state: PageState<T, unknown>): T[] | null {
  if (state.first === null) return null;
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...state.first, ...state.more]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function selectStatus(state: PageState<{ id: string }, unknown>): PageStatus {
  if (state.first === null) return state.error ? 'error' : 'loading';
  if (state.first.length === 0 && state.more.length === 0) return state.error ? 'error' : 'empty';
  return 'ready';
}

/** loadMore is allowed only once, with a cursor, when not finished and no first-page error. */
export function canLoadMore(state: PageState<unknown, unknown>): boolean {
  return state.first !== null && !!state.cursor && !state.done && !state.loadingMore && !state.error;
}
