import { SESSION_CONFIG } from './session-config';
import type { ItemStatus } from './types';

export type CountCheck = { state: 'none' } | { state: 'ok'; count: number } | { state: 'tooMany'; count: number };

/** `fetched` comes from a query with limit(max + 1), so max + 1 means "more than max". */
export function evaluateCount(fetched: number, max: number = SESSION_CONFIG.maxBeneficiaries): CountCheck {
  if (fetched <= 0) return { state: 'none' };
  if (fetched > max) return { state: 'tooMany', count: fetched };
  return { state: 'ok', count: fetched };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

type Orderable = { id: string; areaName: string; nameSearch: string };

/** Stable runner order: by area, then normalized name. */
export function orderForSession<T extends Orderable>(list: T[]): T[] {
  const unique = [...new Map(list.map((b) => [b.id, b])).values()];
  return unique.sort(
    (a, b) => a.areaName.localeCompare(b.areaName, 'ar') || a.nameSearch.localeCompare(b.nameSearch, 'ar') || a.id.localeCompare(b.id),
  );
}

type SnapshotSource = {
  id: string;
  fullName: string;
  householdCount: number;
  primaryPhone: string | null;
  phones: unknown[];
  areaId: string;
  areaName: string;
  pickupLocation?: string | null;
  residentialAddress?: string | null;
  notes?: string | null;
  mapPins: unknown[];
};

/** Item = field snapshot of the beneficiary at start. Later profile edits never rewrite it. */
export function buildItem(b: SnapshotSource, order: number) {
  return {
    beneficiaryId: b.id,
    order,
    fullName: b.fullName,
    householdCount: b.householdCount,
    primaryPhone: b.primaryPhone ?? null,
    phones: b.phones ?? [],
    areaId: b.areaId,
    areaName: b.areaName,
    pickupLocation: b.pickupLocation ?? null,
    residentialAddress: b.residentialAddress ?? null,
    notes: b.notes ?? null,
    mapPins: b.mapPins ?? [],
    status: 'pending' as ItemStatus,
    processedAt: null,
    processedBy: null,
    processedClientAt: null,
    note: null,
  };
}

/** Mirrors the item transition rules in firestore.rules. */
export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
  if (from === 'pending') return to === 'checked' || to === 'ignored';
  if (from === 'ignored') return to === 'pending';
  return false;
}

type CountableItem = { id: string; order: number; status: ItemStatus; householdCount?: number; areaName?: string };

export function countItems(items: CountableItem[]) {
  let checked = 0;
  let ignored = 0;
  let pending = 0;
  for (const item of items) {
    if (item.status === 'checked') checked += 1;
    else if (item.status === 'ignored') ignored += 1;
    else pending += 1;
  }
  return { checked, ignored, pending, total: items.length };
}

/** Next pending item after `afterOrder` (wrapping around), or null when all are processed. */
export function nextPendingId(items: CountableItem[], afterOrder = -1): string | null {
  const pending = items.filter((i) => i.status === 'pending').sort((a, b) => a.order - b.order);
  if (pending.length === 0) return null;
  return (pending.find((i) => i.order > afterOrder) ?? pending[0])!.id;
}

export function summarizeSession(items: CountableItem[]) {
  const counts = countItems(items);
  const byArea: Record<string, { checked: number; ignored: number; pending: number }> = {};
  let householdsChecked = 0;
  for (const item of items) {
    const key = item.areaName ?? '';
    byArea[key] ??= { checked: 0, ignored: 0, pending: 0 };
    byArea[key][item.status === 'checked' ? 'checked' : item.status === 'ignored' ? 'ignored' : 'pending'] += 1;
    if (item.status === 'checked') householdsChecked += item.householdCount ?? 0;
  }
  return { ...counts, householdsChecked, byArea };
}
