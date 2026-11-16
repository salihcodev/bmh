import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Simulates offline Firestore: every commit() stays pending (as the native SDK
 * does until the server acknowledges). The runner must still return at once,
 * and the queued batches flush later when the server answers.
 */

type Op = { kind: 'set' | 'update'; path: string; data: Record<string, unknown> };
type Batch = { ops: Op[]; commit: () => Promise<void> };

const pending: { batch: Batch; resolve: () => void; reject: (e: unknown) => void }[] = [];
let autoId = 0;

vi.mock('@react-native-firebase/firestore', () => {
  const path = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'object' && p && 'path' in p ? (p as { path: string }).path : String(p))).filter(Boolean).join('/');
  return {
    collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    doc: (first: unknown, ...parts: string[]) =>
      parts.length === 0
        ? { path: `${(first as { path: string }).path}/auto${++autoId}`, id: `auto${autoId}` }
        : { path: path(parts), id: parts[parts.length - 1] },
    writeBatch: () => {
      const batch: Batch = {
        ops: [],
        commit: () => new Promise<void>((resolve, reject) => pending.push({ batch, resolve, reject })),
      };
      return Object.assign(batch, {
        set: (ref: { path: string }, data: Record<string, unknown>) => batch.ops.push({ kind: 'set', path: ref.path, data }),
        update: (ref: { path: string }, data: Record<string, unknown>) => batch.ops.push({ kind: 'update', path: ref.path, data }),
      });
    },
    increment: (n: number) => ({ increment: n }),
    serverTimestamp: () => 'SERVER_TS',
    Timestamp: { now: () => 'CLIENT_TS' },
    getDocsFromServer: vi.fn(),
    limit: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
  };
});
vi.mock('@/services/firebase/client', () => ({ db: {} }));
vi.mock('@/localization', () => ({ i18n: { t: (key: string) => key } }));
vi.mock('@/services/sync/connectivity', () => ({ requireOnline: vi.fn() }));

const { processItem, reopenItem } = await import('@/services/sessions/api');
const { updateBeneficiary } = await import('@/services/beneficiaries/api');
const { useSyncStore } = await import('@/services/sync/sync-store');
const { nextPendingId } = await import('@/domain/session');

const session = { id: 's1', name: 'S' } as never;
const ctx = { wid: 'w1', session, actor: { uid: 'op', name: 'Op' }, logHistory: true };
const item = (id: string, status: 'pending' | 'checked' | 'ignored' = 'pending') => ({ id, status }) as never;

beforeEach(() => {
  pending.length = 0;
  useSyncStore.setState(useSyncStore.getInitialState());
});

describe('Check / Ignore offline', () => {
  it('returns immediately while the commit is still pending, then syncs later', async () => {
    const result = processItem(ctx, item('b1'), 'checked');
    expect(result).toBeUndefined();
    expect(pending).toHaveLength(1);
    expect(useSyncStore.getState().pending).toBe(1);

    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSyncStore.getState().pending).toBe(0);
  });

  it('queues several actions in a row without waiting (operator keeps advancing)', () => {
    const list: { id: string; order: number; status: 'pending' | 'checked' | 'ignored' }[] = [
      { id: 'b1', order: 0, status: 'pending' },
      { id: 'b2', order: 1, status: 'pending' },
      { id: 'b3', order: 2, status: 'pending' },
    ];
    let current: string | null = 'b1';
    const visited: string[] = [];
    for (const status of ['checked', 'ignored', 'checked'] as const) {
      const entry = list.find((i) => i.id === current)!;
      processItem(ctx, item(entry.id), status);
      entry.status = status;
      visited.push(entry.id);
      current = nextPendingId(list, entry.order);
    }
    expect(visited).toEqual(['b1', 'b2', 'b3']);
    expect(pending).toHaveLength(3);
    expect(current).toBeNull();
  });

  it('a Check batch touches only the item, the session counter and events; never assistance', () => {
    processItem(ctx, item('b1'), 'checked');
    const ops = pending[0]!.batch.ops;
    expect(ops.map((o) => `${o.kind}:${o.path.replace(/auto\d+/, '*')}`)).toEqual([
      'update:workspaces/w1/sessions/s1/items/b1',
      'update:workspaces/w1/sessions/s1',
      'set:workspaces/w1/sessions/s1/events/*',
      'set:workspaces/w1/beneficiaries/b1/history/*',
    ]);
    expect(ops.some((o) => o.path.includes('assistanceRecords'))).toBe(false);
    expect(ops.some((o) => 'lastConfirmedAssistanceAt' in o.data)).toBe(false);
    expect(ops[0]!.data).toMatchObject({ status: 'checked', processedBy: 'op', processedAt: 'SERVER_TS', processedClientAt: 'CLIENT_TS' });
    expect(ops[1]!.data).toMatchObject({ checkedCount: { increment: 1 } });
  });

  it('skips the beneficiary history event when the operator lacks beneficiaries_view', () => {
    processItem({ ...ctx, logHistory: false }, item('b1'), 'ignored');
    expect(pending[0]!.batch.ops.some((o) => o.path.includes('/history/'))).toBe(false);
  });

  it('a rejected batch is surfaced with a retry that rebuilds it', async () => {
    processItem(ctx, item('b1'), 'checked');
    pending[0]!.reject({ code: 'permission-denied' });
    await Promise.resolve();
    await Promise.resolve();
    const failure = useSyncStore.getState().failures[0];
    expect(failure).toMatchObject({ label: 'session_checked', code: 'permission-denied' });
    failure!.retry!();
    expect(pending).toHaveLength(2);
    expect(pending[1]!.batch.ops).toHaveLength(4);
  });

  it('profile edits never rewrite session snapshots', () => {
    const before = {
      id: 'b1', fullName: 'Old', householdCount: 2, cityId: 'c', cityName: 'C', areaId: 'a', areaName: 'A',
      phones: [], primaryPhone: null, mapPins: [], isArchived: false,
    } as never;
    updateBeneficiary(
      'w1',
      before,
      { fullName: 'New', householdCount: '3', cityId: 'c', areaId: 'a', residentialAddress: '', pickupLocation: '', notes: '', phones: [] },
      { cityName: 'C', areaName: 'A' },
      ctx.actor,
    );
    const paths = pending[0]!.batch.ops.map((o) => o.path);
    expect(paths[0]).toBe('workspaces/w1/beneficiaries/b1');
    expect(paths.some((p) => p.includes('/sessions/'))).toBe(false);
  });

  it('reopen only applies to ignored items', () => {
    reopenItem(ctx, item('b1', 'checked'));
    expect(pending).toHaveLength(0);
    reopenItem(ctx, item('b1', 'ignored'));
    expect(pending[0]!.batch.ops[1]!.data).toMatchObject({ ignoredCount: { increment: -1 } });
  });
});
