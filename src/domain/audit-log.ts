// The admin log as plain functions: what an entry holds, how it is filtered and shown, and how a
// change is summarised. Screens and the writes in services/admin use these; tests cover them.

export const ADMIN_ACTIONS = [
  'media_uploaded',
  'media_undone',
  'media_archived',
  'media_restored',
  'media_removed',
  'banner_created',
  'banner_updated',
  'banner_activated',
  'banner_deactivated',
  'banner_deleted',
  'news_created',
  'news_updated',
  'news_published',
  'news_unpublished',
  'news_deleted',
  'message_created',
  'message_updated',
  'message_published',
  'message_unpublished',
  'message_deleted',
  'support_method_created',
  'support_method_updated',
  'support_method_deleted',
  'support_methods_reordered',
  'user_suspended',
  'user_reactivated',
  'supplier_approved',
  'supplier_rejected',
  'user_created',
  'user_deleted',
  'role_assigned',
  'role_created',
  'role_updated',
  'role_deleted',
  'preset_created',
  'preset_updated',
  'preset_deleted',
  'workspace_updated',
  'workspace_archived',
  'workspace_restored',
  'workspace_deleted',
  'home_config_updated',
  'sync_health_cleared',
  'log_exported',
  'store_category_created',
  'store_category_updated',
  'store_category_deleted',
  'store_item_created',
  'store_item_updated',
  'store_item_deleted',
  'store_config_updated',
  'supplier_updated',
  'supplier_verified',
  'supplier_unverified',
  'supplier_deleted',
  'review_created',
  'review_updated',
  'review_deleted',
  'review_hidden',
  'review_restored',
  'bag_created',
  'bag_updated',
  'bag_deleted',
  'bag_link_regenerated',
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export const ADMIN_TARGETS = [
  'media',
  'banner',
  'news',
  'systemMessage',
  'supportMethod',
  'user',
  'role',
  'preset',
  'workspace',
  'config',
  'syncHealth',
  'log',
  'storeCategory',
  'storeItem',
  'supplier',
  'review',
  'bag',
] as const;

export type AdminTarget = (typeof ADMIN_TARGETS)[number];

/** Icon names stored on the entry. The screen maps each to a Lucide icon. */
export type AuditIcon =
  | 'image'
  | 'layout'
  | 'newspaper'
  | 'message'
  | 'heart'
  | 'user'
  | 'shield'
  | 'layers'
  | 'building'
  | 'settings'
  | 'refresh'
  | 'trash'
  | 'ban'
  | 'check'
  | 'log';

const TARGET_ICON: Record<AdminTarget, AuditIcon> = {
  media: 'image',
  banner: 'layout',
  news: 'newspaper',
  systemMessage: 'message',
  supportMethod: 'heart',
  user: 'user',
  role: 'shield',
  preset: 'layers',
  workspace: 'building',
  config: 'settings',
  syncHealth: 'refresh',
  log: 'log',
  storeCategory: 'layers',
  storeItem: 'layers',
  supplier: 'building',
  review: 'message',
  bag: 'heart',
};

export function actionVerb(action: string): string {
  const parts = action.split('_');
  return parts[parts.length - 1] ?? action;
}

/** Deletions and removals get the bin, suspensions and rejections the ban mark; the rest their entity's icon. */
export function auditIcon(action: string, targetType: string): AuditIcon {
  const verb = actionVerb(action);
  if (verb === 'deleted' || verb === 'removed' || verb === 'undone' || verb === 'cleared') return 'trash';
  if (verb === 'suspended' || verb === 'rejected') return 'ban';
  if (verb === 'approved') return 'check';
  return TARGET_ICON[targetType as AdminTarget] ?? 'log';
}

export type Severity = 'danger' | 'warning' | 'neutral';

export function auditSeverity(action: string): Severity {
  const verb = actionVerb(action);
  if (['deleted', 'removed', 'suspended', 'rejected', 'cleared'].includes(verb)) return 'danger';
  if (action.startsWith('role_') || action.startsWith('preset_') || verb === 'assigned' || verb === 'archived') return 'warning';
  return 'neutral';
}

export type AuditSummary = { before?: Record<string, string>; after?: Record<string, string> };

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  actorId: string;
  actorName: string;
  actorAvatarPublicId: string | null;
  workspaceId: string | null;
  icon: AuditIcon | null;
  summary: AuditSummary | null;
  platform: string | null;
  appVersion: string | null;
  createdAt: number | null;
};

const MAX_VALUE = 120;
export const MAX_SUMMARY_BYTES = 2048;

function show(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.map(String).join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text;
}

/**
 * Only the fields that changed, as short strings. Over 2 KB the values are dropped and only the
 * field names stay, so a big edit can never make the log write fail.
 */
export function summarizeChange(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditSummary | null {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const out: { before: Record<string, string>; after: Record<string, string> } = { before: {}, after: {} };
  for (const key of keys) {
    const was = before?.[key];
    const now = after?.[key];
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    if (before && key in before) out.before[key] = show(was);
    if (after && key in after) out.after[key] = show(now);
  }
  const changed = [...new Set([...Object.keys(out.before), ...Object.keys(out.after)])];
  if (changed.length === 0) return null;
  const result: AuditSummary = {};
  if (before && Object.keys(out.before).length > 0) result.before = out.before;
  if (after && Object.keys(out.after).length > 0) result.after = out.after;
  if (JSON.stringify(result).length <= MAX_SUMMARY_BYTES) return result;
  const names = Object.fromEntries(changed.map((key) => [key, '']));
  return { after: names };
}

export type DateRange = 'all' | 'today' | '7d' | '30d';
export const DATE_RANGES: readonly DateRange[] = ['all', 'today', '7d', '30d'];

export type AuditFilters = {
  actorId: string | null;
  action: string | null;
  entity: string | null;
  range: DateRange;
  search: string;
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = { actorId: null, action: null, entity: null, range: 'all', search: '' };

/** How many of the four filter controls are set (the search box is not counted). */
export function activeFilterCount(filters: AuditFilters): number {
  return [filters.actorId, filters.action, filters.entity].filter(Boolean).length + (filters.range === 'all' ? 0 : 1);
}

export function hasAuditFilters(filters: AuditFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.search.trim() !== '';
}

/** Start of the range in ms, or null for all time. "today" starts at local midnight. */
export function rangeStart(range: DateRange, now: number): number | null {
  if (range === 'all') return null;
  if (range === 'today') {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  }
  return now - (range === '7d' ? 7 : 30) * 24 * 3_600_000;
}

export type AuditServerFilter =
  | { field: 'actorId' | 'action' | 'targetType'; value: string }
  | null;

/** One equality filter runs in Firestore (the first of actor, action, entity). The rest run on the loaded rows. */
export function serverFilter(filters: AuditFilters): AuditServerFilter {
  if (filters.actorId) return { field: 'actorId', value: filters.actorId };
  if (filters.action) return { field: 'action', value: filters.action };
  if (filters.entity) return { field: 'targetType', value: filters.entity };
  return null;
}

/** `label` is the action's readable name in the current language, so search finds what the row shows. */
export function matchesAuditFilters(
  entry: Pick<AuditEntry, 'actorId' | 'action' | 'targetType' | 'targetId' | 'targetName' | 'actorName' | 'createdAt' | 'workspaceId'>,
  filters: AuditFilters,
  /** Start of the date range in ms (from `rangeStart`), or null for all time. */
  since: number | null,
  label = '',
): boolean {
  if (filters.actorId && entry.actorId !== filters.actorId) return false;
  if (filters.action && entry.action !== filters.action) return false;
  if (filters.entity && entry.targetType !== filters.entity) return false;
  // A just-written entry has no server time yet: it is new, so it is inside any range.
  if (since !== null && entry.createdAt !== null && entry.createdAt < since) return false;
  const needle = filters.search.trim().toLowerCase();
  if (!needle) return true;
  return [label, entry.action, entry.actorName, entry.targetName, entry.targetId, entry.targetType, entry.workspaceId ?? '']
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

/** The actors in a set of rows, newest first, for the actor picker. */
export function distinctActors(entries: readonly Pick<AuditEntry, 'actorId' | 'actorName'>[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const entry of entries) if (entry.actorId && !seen.has(entry.actorId)) seen.set(entry.actorId, entry.actorName || entry.actorId);
  return [...seen].map(([id, name]) => ({ id, name }));
}

const ICONS: readonly string[] = [
  'image', 'layout', 'newspaper', 'message', 'heart', 'user', 'shield', 'layers', 'building', 'settings', 'refresh', 'trash', 'ban', 'check', 'log',
];

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function stringMap(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, str(item, MAX_VALUE)]));
}

/** Reads an entry of any version. v1 entries have no name, icon, summary or device fields. */
export function normalizeAuditEntry(id: string, data: Record<string, unknown>, toMillis: (value: unknown) => number | null): AuditEntry {
  const action = str(data.action, 80);
  const targetType = str(data.targetType, 40);
  const summaryData = data.summary as { before?: unknown; after?: unknown } | undefined;
  const before = stringMap(summaryData?.before);
  const after = stringMap(summaryData?.after);
  const icon = str(data.icon, 24);
  return {
    id,
    action,
    targetType,
    targetId: str(data.targetId, 128),
    targetName: str(data.targetName, 120),
    actorId: str(data.actorId, 128),
    actorName: str(data.actorName, 120),
    actorAvatarPublicId: str(data.actorAvatarPublicId, 200) || null,
    workspaceId: str(data.workspaceId, 128) || null,
    icon: ICONS.includes(icon) ? (icon as AuditIcon) : null,
    summary: before || after ? { ...(before ? { before } : {}), ...(after ? { after } : {}) } : null,
    platform: str(data.platform, 12) || null,
    appVersion: str(data.appVersion, 32) || null,
    createdAt: toMillis(data.createdAt) ?? toMillis(data.clientAt),
  };
}

export type RowDensity = 'compact' | 'detailed';
export const ROW_DENSITIES: readonly RowDensity[] = ['compact', 'detailed'];

/** Column keys of the exported log, in order. Labels come from i18n (`manage.audit.columns.*`). */
export const AUDIT_EXPORT_COLUMNS = ['time', 'actor', 'action', 'entity', 'target', 'workspace', 'before', 'after', 'platform'] as const;

function joinMap(map: Record<string, string> | undefined): string {
  return map ? Object.entries(map).map(([key, value]) => `${key}: ${value}`).join('; ') : '';
}

export function auditExportRow(
  entry: AuditEntry,
  helpers: { actionLabel: (action: string) => string; entityLabel: (type: string) => string; dateTime: (ms: number) => string },
): Record<(typeof AUDIT_EXPORT_COLUMNS)[number], string> {
  return {
    time: entry.createdAt ? helpers.dateTime(entry.createdAt) : '',
    actor: entry.actorName || entry.actorId,
    action: helpers.actionLabel(entry.action),
    entity: helpers.entityLabel(entry.targetType),
    target: entry.targetName ? `${entry.targetName} (${entry.targetId})` : entry.targetId,
    workspace: entry.workspaceId ?? '',
    before: joinMap(entry.summary?.before),
    after: joinMap(entry.summary?.after),
    platform: [entry.platform, entry.appVersion].filter(Boolean).join(' '),
  };
}
