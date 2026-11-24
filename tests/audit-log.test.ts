import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  activeFilterCount,
  ADMIN_ACTIONS,
  ADMIN_TARGETS,
  auditExportRow,
  auditIcon,
  auditSeverity,
  distinctActors,
  EMPTY_AUDIT_FILTERS,
  hasAuditFilters,
  matchesAuditFilters,
  MAX_SUMMARY_BYTES,
  normalizeAuditEntry,
  rangeStart,
  serverFilter,
  summarizeChange,
  type AuditEntry,
  type AuditFilters,
} from '@/domain/audit-log';

import ar from '@/localization/ar.platform.json';
import en from '@/localization/en.platform.json';

const millis = (value: unknown) => (typeof value === 'number' ? value : null);

function entry(extra: Partial<AuditEntry> = {}): AuditEntry {
  return normalizeAuditEntry(
    'e1',
    { action: 'user_suspended', targetType: 'user', targetId: 'u1', actorId: 'a1', actorName: 'Amira', createdAt: 1_000, ...extra },
    millis,
  );
}

const filters = (extra: Partial<AuditFilters> = {}): AuditFilters => ({ ...EMPTY_AUDIT_FILTERS, ...extra });

describe('icons and severity', () => {
  it('uses the bin for removals, the ban mark for suspensions, and the entity icon otherwise', () => {
    expect(auditIcon('user_deleted', 'user')).toBe('trash');
    expect(auditIcon('media_removed', 'media')).toBe('trash');
    expect(auditIcon('user_suspended', 'user')).toBe('ban');
    expect(auditIcon('supplier_approved', 'user')).toBe('check');
    expect(auditIcon('banner_updated', 'banner')).toBe('layout');
    expect(auditIcon('something_new', 'unknown')).toBe('log');
  });

  it('marks deletions danger and role or archive changes warning', () => {
    expect(auditSeverity('banner_deleted')).toBe('danger');
    expect(auditSeverity('user_suspended')).toBe('danger');
    expect(auditSeverity('role_updated')).toBe('warning');
    expect(auditSeverity('workspace_archived')).toBe('warning');
    expect(auditSeverity('news_published')).toBe('neutral');
  });

  it('has an icon for every action and target', () => {
    for (const action of ADMIN_ACTIONS) expect(auditIcon(action, 'user')).toBeTruthy();
    for (const target of ADMIN_TARGETS) expect(auditIcon('x_updated', target), target).toBeTruthy();
  });
});

describe('summarizeChange', () => {
  it('keeps only the fields that changed', () => {
    expect(summarizeChange({ name: 'A', status: 'active' }, { name: 'B', status: 'active' })).toEqual({
      before: { name: 'A' },
      after: { name: 'B' },
    });
  });

  it('records a creation as after only, and nothing when nothing changed', () => {
    expect(summarizeChange(null, { name: 'B' })).toEqual({ after: { name: 'B' } });
    expect(summarizeChange({ a: 1 }, { a: 1 })).toBeNull();
    expect(summarizeChange(null, null)).toBeNull();
  });

  it('shortens long values and lists', () => {
    const summary = summarizeChange({ keys: ['a', 'b'] }, { keys: ['a', 'b', 'c'], note: 'x'.repeat(500) });
    expect(summary?.before?.keys).toBe('a, b');
    expect(summary?.after?.keys).toBe('a, b, c');
    expect(summary?.after?.note?.length).toBe(120);
  });

  it('never exceeds the size the rules allow: past the limit only field names remain', () => {
    const big = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`field${i}`, 'v'.repeat(100)]));
    const summary = summarizeChange(null, big);
    expect(JSON.stringify(summary).length).toBeLessThanOrEqual(MAX_SUMMARY_BYTES);
    expect(Object.keys(summary?.after ?? {})).toHaveLength(60);
    expect(Object.values(summary?.after ?? {}).every((value) => value === '')).toBe(true);
  });
});

describe('normalizeAuditEntry', () => {
  it('reads a v1 entry that has no name, icon, summary or device', () => {
    const old = entry();
    expect(old).toMatchObject({ targetName: '', icon: null, summary: null, platform: null, workspaceId: null, actorAvatarPublicId: null });
    expect(old.createdAt).toBe(1_000);
  });

  it('reads a v2 entry and drops an unknown icon', () => {
    const v2 = entry({ icon: 'user', targetName: 'Alice', workspaceId: 'w1', platform: 'ios', appVersion: '1.0.0' });
    expect(v2).toMatchObject({ icon: 'user', targetName: 'Alice', workspaceId: 'w1', platform: 'ios' });
    expect(normalizeAuditEntry('e', { action: 'a', icon: 'rocket' }, millis).icon).toBeNull();
  });

  it('falls back to the device time while the server time is still pending', () => {
    const pending = normalizeAuditEntry('e', { action: 'a', createdAt: null, clientAt: 5 }, millis);
    expect(pending.createdAt).toBe(5);
  });
});

describe('filters', () => {
  const now = new Date('2026-11-23T15:00:00').getTime();

  it('computes where each range starts', () => {
    expect(rangeStart('all', now)).toBeNull();
    expect(rangeStart('7d', now)).toBe(now - 7 * 24 * 3_600_000);
    expect(rangeStart('30d', now)).toBe(now - 30 * 24 * 3_600_000);
    expect(new Date(rangeStart('today', now)!).getHours()).toBe(0);
  });

  it('sends one equality filter to the server, actor first, and the rest stay local', () => {
    expect(serverFilter(filters())).toBeNull();
    expect(serverFilter(filters({ entity: 'user' }))).toEqual({ field: 'targetType', value: 'user' });
    expect(serverFilter(filters({ entity: 'user', action: 'user_deleted' }))).toEqual({ field: 'action', value: 'user_deleted' });
    expect(serverFilter(filters({ entity: 'user', action: 'user_deleted', actorId: 'a1' }))).toEqual({ field: 'actorId', value: 'a1' });
  });

  it('applies every filter to a loaded row, including the one the server already ran', () => {
    const row = entry();
    const since = rangeStart('7d', now);
    expect(matchesAuditFilters(row, filters(), null)).toBe(true);
    expect(matchesAuditFilters(row, filters({ actorId: 'a1', action: 'user_suspended', entity: 'user' }), null)).toBe(true);
    expect(matchesAuditFilters(row, filters({ actorId: 'other' }), null)).toBe(false);
    expect(matchesAuditFilters(row, filters({ action: 'user_deleted' }), null)).toBe(false);
    expect(matchesAuditFilters(row, filters({ entity: 'role' }), null)).toBe(false);
    expect(matchesAuditFilters(row, filters({ range: '7d' }), since)).toBe(false);
    expect(matchesAuditFilters(entry({ createdAt: now - 1_000 }), filters({ range: '7d' }), since)).toBe(true);
  });

  it('keeps an entry whose server time has not arrived yet inside any range', () => {
    const fresh = { ...entry(), createdAt: null };
    expect(matchesAuditFilters(fresh, filters({ range: 'today' }), rangeStart('today', now))).toBe(true);
  });

  it('searches the readable label, actor, target and ids', () => {
    const row = entry({ targetName: 'Alice', workspaceId: 'ws-77' });
    const search = (text: string) => matchesAuditFilters(row, filters({ search: text }), null, 'Suspended a user');
    expect(search('suspended a')).toBe(true);
    expect(search('amira')).toBe(true);
    expect(search('alice')).toBe(true);
    expect(search('WS-77')).toBe(true);
    expect(search('banner')).toBe(false);
    expect(search('   ')).toBe(true);
  });

  it('counts the filter controls, not the search box', () => {
    expect(activeFilterCount(filters())).toBe(0);
    expect(activeFilterCount(filters({ actorId: 'a', entity: 'user', range: '7d', search: 'x' }))).toBe(3);
    expect(hasAuditFilters(filters({ search: 'x' }))).toBe(true);
    expect(hasAuditFilters(filters())).toBe(false);
  });

  it('lists each actor once, in the order they appear', () => {
    expect(
      distinctActors([
        { actorId: 'a', actorName: 'A' },
        { actorId: 'b', actorName: '' },
        { actorId: 'a', actorName: 'A again' },
      ]),
    ).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'b' },
    ]);
  });
});

describe('export rows', () => {
  it('flattens an entry into readable cells', () => {
    const row = auditExportRow(
      entry({ targetName: 'Alice', summary: { before: { status: 'active' }, after: { status: 'suspended' } }, platform: 'ios', appVersion: '1.0' }),
      { actionLabel: (action) => `label:${action}`, entityLabel: (type) => `entity:${type}`, dateTime: (ms) => `t${ms}` },
    );
    expect(row).toEqual({
      time: 't1000',
      actor: 'Amira',
      action: 'label:user_suspended',
      entity: 'entity:user',
      target: 'Alice (u1)',
      workspace: '',
      before: 'status: active',
      after: 'status: suspended',
      platform: 'ios 1.0',
    });
  });
});

describe('strings', () => {
  it('names every action and entity in both languages', () => {
    for (const lang of [en, ar]) {
      for (const action of ADMIN_ACTIONS) expect((lang.manage.audit.actions as Record<string, string>)[action], action).toBeTruthy();
      for (const target of ADMIN_TARGETS) expect((lang.manage.audit.entities as Record<string, string>)[target], target).toBeTruthy();
    }
  });
});

// LOG-04: every dashboard write that changes data records an admin log entry in the same batch.
describe('admin writes always log', () => {
  const root = resolve(__dirname, '..');
  const files = ['src/services/admin/admin-writes.ts', 'src/services/admin/content-writes.ts'];
  /** Exported async functions with their bodies. */
  function writers(source: string): { name: string; body: string }[] {
    const parts = source.split(/\nexport async function /).slice(1);
    return parts.map((part) => ({ name: part.split('(')[0]!, body: part.split(/\n}\n/)[0]! }));
  }

  for (const file of files) {
    const found = writers(readFileSync(resolve(root, file), 'utf8'));
    it(`${file} has writers`, () => expect(found.length).toBeGreaterThan(3));
    for (const { name, body } of found) {
      it(`${name} writes an entry in its batch`, () => {
        if (!/batch\.(set|update|delete)\(|addMedia/.test(body)) return;
        expect(body, name).toMatch(/\baudit\(batch,/);
        // The entry and the change commit together or not at all.
        expect(body, name).toMatch(/commitOnline\(batch\)/);
      });
    }
  }
});
