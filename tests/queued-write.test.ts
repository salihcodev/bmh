import { describe, expect, it } from 'vitest';

import {
  chatMessageKey,
  chatMessageOp,
  genericWriteOps,
  incrementBy,
  isDocPath,
  MAX_QUEUED_OPS,
  resolveMarkers,
  serverTime,
  timeAt,
  validateOps,
  type QueuedOp,
} from '@/domain/queued-write';

const resolvers = {
  serverTimestamp: () => 'SERVER',
  increment: (by: number) => `+${by}`,
  time: (ms: number) => `T${ms}`,
};

describe('queued writes', () => {
  it('resolves markers at any depth and leaves plain values alone', () => {
    const data = {
      text: 'hi',
      n: 3,
      createdAt: serverTime(),
      counters: { messages: incrementBy(1) },
      list: [timeAt(5), 'x', { at: serverTime() }],
      none: null,
    };
    expect(resolveMarkers(data, resolvers)).toEqual({
      text: 'hi',
      n: 3,
      createdAt: 'SERVER',
      counters: { messages: '+1' },
      list: ['T5', 'x', { at: 'SERVER' }],
      none: null,
    });
  });

  it('rejects an unknown marker instead of writing it as data', () => {
    expect(() => resolveMarkers({ a: { $: 'delete' } }, resolvers)).toThrow(/Unknown queued value marker/);
  });

  it('knows a document path from a collection path', () => {
    expect(isDocPath('workspaces/w1')).toBe(true);
    expect(isDocPath('workspaces/w1/chat/m1')).toBe(true);
    expect(isDocPath('workspaces')).toBe(false);
    expect(isDocPath('workspaces/w1/chat')).toBe(false);
    expect(isDocPath('workspaces//chat')).toBe(false);
  });

  it('validates a batch: not empty, bounded, and every path a document', () => {
    const op: QueuedOp = { kind: 'delete', path: 'a/b' };
    expect(validateOps([])).toBe('empty');
    expect(validateOps(Array.from({ length: MAX_QUEUED_OPS + 1 }, () => op))).toBe('tooMany');
    expect(validateOps([op, { kind: 'delete', path: 'a' }])).toBe('badPath');
    expect(validateOps([op])).toBeNull();
    expect(() => genericWriteOps({ label: 'x', ops: [] })).toThrow(/empty/);
  });

  it('turns a chat message into one set at its client id, so a retry cannot duplicate it', () => {
    const payload = { workspaceId: 'w1', clientId: 'c-1', data: { text: 'hello', createdAt: serverTime() } };
    expect(chatMessageOp(payload)).toEqual({ kind: 'set', path: 'workspaces/w1/chat/c-1', data: payload.data });
    expect(chatMessageKey(payload)).toBe('chat:w1:c-1');
  });
});
