/** Groups newest-first sessions by local calendar day for the history list. */

export type DayKey = 'today' | 'yesterday' | 'earlier';
export type DayGroup<T> = { id: string; kind: DayKey; date: Date; items: T[] };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayKind(date: Date, now: Date): DayKey {
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : 'earlier';
}

/**
 * Keeps input order (newest first) and starts a new group whenever the day changes.
 * Items without a date (pending server timestamp) count as today.
 */
export function groupByDay<T>(items: T[], dateOf: (item: T) => Date | null | undefined, now = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = dateOf(item) ?? now;
    const id = String(startOfDay(date));
    const last = groups[groups.length - 1];
    if (last && last.id === id) last.items.push(item);
    else groups.push({ id, kind: dayKind(date, now), date, items: [item] });
  }
  return groups;
}

/** Flattens groups into header + item rows for a single virtualized list. */
export type HistoryRow<T> = { type: 'header'; id: string; group: DayGroup<T> } | { type: 'item'; id: string; item: T; last: boolean; first: boolean };

export function toRows<T>(groups: DayGroup<T>[], idOf: (item: T) => string): HistoryRow<T>[] {
  const rows: HistoryRow<T>[] = [];
  for (const group of groups) {
    rows.push({ type: 'header', id: `h:${group.id}`, group });
    group.items.forEach((item, index) =>
      rows.push({ type: 'item', id: idOf(item), item, first: index === 0, last: index === group.items.length - 1 }),
    );
  }
  return rows;
}
