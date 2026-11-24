import {
  getDocsFromServer,
  increment,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type WriteBatch,
} from '@react-native-firebase/firestore';

import { buildItem, chunk, orderForSession, summarizeSession } from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';
import type { Area, Beneficiary, City, ItemStatus, Session, SessionItem } from '@/domain/types';
import { db } from '@/services/firebase/client';
import { addEvent, newId, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground, commitOnline } from '@/services/firebase/write';
import { requireOnline } from '@/services/sync/connectivity';

/** Online only: fresh server data, limit(max + 1) across area chunks. */
export async function fetchSessionCandidates(wid: string, areaIds: string[]): Promise<Beneficiary[]> {
  await requireOnline();
  const max = SESSION_CONFIG.maxBeneficiaries + 1;
  const found: Beneficiary[] = [];
  for (const ids of chunk([...new Set(areaIds)], SESSION_CONFIG.areaQueryChunk)) {
    if (found.length >= max) break;
    const snapshot = await getDocsFromServer(
      query(
        refs.beneficiaries(wid),
        where('isArchived', '==', false),
        where('areaId', 'in', ids),
        limit(max - found.length),
      ),
    );
    snapshot.forEach((d) => {
      found.push({ id: d.id, ...(d.data() as Omit<Beneficiary, 'id'>) });
    });
  }
  return found;
}

/** One awaited batch: session + ≤100 snapshot items + counter + events (≤104 writes). */
export async function startSession(
  wid: string,
  input: { name: string; city: City; areas: Area[] },
  beneficiaries: Beneficiary[],
  actor: Actor,
): Promise<string> {
  await requireOnline();
  if (beneficiaries.length < 1 || beneficiaries.length > SESSION_CONFIG.maxBeneficiaries) {
    throw new Error('SESSION_SIZE');
  }
  const sid = newId(refs.sessions(wid));
  const ordered = orderForSession(beneficiaries);
  const batch = writeBatch(db);
  batch.set(refs.session(wid, sid), {
    workspaceId: wid,
    name: input.name.trim(),
    cityId: input.city.id,
    cityName: input.city.name,
    areaIds: input.areas.map((a) => a.id),
    areaNames: input.areas.map((a) => a.name),
    status: 'active',
    createdBy: actor.uid,
    operatorId: actor.uid,
    startedBy: actor.uid,
    startedAt: serverTimestamp(),
    endedAt: null,
    endedBy: null,
    beneficiaryCount: ordered.length,
    checkedCount: 0,
    ignoredCount: 0,
    pendingCount: ordered.length,
    contactActionsCount: 0,
    summary: null,
    createdAt: serverTimestamp(),
    clientAt: Timestamp.now(),
    lastProcessedAt: null,
    updatedAt: serverTimestamp(),
  });
  ordered.forEach((b, order) => batch.set(refs.item(wid, sid, b.id), buildItem(b, order)));
  batch.update(refs.workspace(wid), { sessionCount: increment(1), updatedAt: serverTimestamp() });
  const base = { workspaceId: wid, sessionId: sid };
  addEvent(batch, refs.sessionEvents(wid, sid), base, actor, 'session_created', { count: ordered.length });
  addEvent(batch, refs.sessionEvents(wid, sid), base, actor, 'session_started', {});
  await commitOnline(batch);
  return sid;
}

type Ctx = { wid: string; session: Session; actor: Actor; /** history needs beneficiaries_view in rules */ logHistory: boolean };

function sessionEvent(batch: WriteBatch, ctx: Ctx, type: string, metadata = {}) {
  addEvent(batch, refs.sessionEvents(ctx.wid, ctx.session.id), { workspaceId: ctx.wid, sessionId: ctx.session.id }, ctx.actor, type, metadata);
}

function beneficiaryEvent(batch: WriteBatch, ctx: Ctx, bid: string, type: string, metadata = {}) {
  if (!ctx.logHistory) return;
  addEvent(batch, refs.history(ctx.wid, bid), { workspaceId: ctx.wid, beneficiaryId: bid, sessionId: ctx.session.id }, ctx.actor, type, {
    sessionName: ctx.session.name,
    ...metadata,
  });
}

/** Check ("تم") or Ignore. Offline-safe, never awaited. Check is not proof of delivery. */
export function processItem(ctx: Ctx, item: SessionItem, status: Extract<ItemStatus, 'checked' | 'ignored'>) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.item(ctx.wid, ctx.session.id, item.id), {
      status,
      processedAt: serverTimestamp(),
      processedBy: ctx.actor.uid,
      processedClientAt: Timestamp.now(),
    });
    batch.update(refs.session(ctx.wid, ctx.session.id), {
      [status === 'checked' ? 'checkedCount' : 'ignoredCount']: increment(1),
      lastProcessedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    sessionEvent(batch, ctx, status, { beneficiaryId: item.id });
    beneficiaryEvent(batch, ctx, item.id, status === 'checked' ? 'session_checked' : 'session_ignored');
    return batch;
  };
  commitInBackground(build(), `session_${status}`, build);
}

export function reopenItem(ctx: Ctx, item: SessionItem) {
  if (item.status !== 'ignored') return;
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.item(ctx.wid, ctx.session.id, item.id), {
      status: 'pending',
      processedAt: null,
      processedBy: null,
      processedClientAt: null,
    });
    batch.update(refs.session(ctx.wid, ctx.session.id), {
      ignoredCount: increment(-1),
      lastProcessedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    sessionEvent(batch, ctx, 'reopened', { beneficiaryId: item.id });
    beneficiaryEvent(batch, ctx, item.id, 'session_reopened');
    return batch;
  };
  commitInBackground(build(), 'session_reopened', build);
}

export function saveItemNote(ctx: Ctx, item: SessionItem, note: string) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.item(ctx.wid, ctx.session.id, item.id), { note: note.trim() || null });
    sessionEvent(batch, ctx, 'note_updated', { beneficiaryId: item.id });
    return batch;
  };
  commitInBackground(build(), 'session_note', build);
}

/** Records a call attempt in the session and the beneficiary history. */
export function logSessionCall(ctx: Ctx, item: SessionItem, phone: string) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.session(ctx.wid, ctx.session.id), {
      contactActionsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    sessionEvent(batch, ctx, 'call_initiated', { beneficiaryId: item.id, phone });
    beneficiaryEvent(batch, ctx, item.id, 'call_initiated', { phone });
    return batch;
  };
  commitInBackground(build(), 'call_initiated', build);
}

/** Final counters come from the items (≤100, all in the local cache via the runner listener). */
export function endSession(ctx: Ctx, items: SessionItem[]) {
  const summary = summarizeSession(items);
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.session(ctx.wid, ctx.session.id), {
      status: 'ended',
      endedAt: serverTimestamp(),
      endedBy: ctx.actor.uid,
      checkedCount: summary.checked,
      ignoredCount: summary.ignored,
      pendingCount: summary.pending,
      contactActionsCount: ctx.session.contactActionsCount ?? 0,
      summary,
      updatedAt: serverTimestamp(),
    });
    sessionEvent(batch, ctx, 'session_ended', { checked: summary.checked, ignored: summary.ignored, pending: summary.pending });
    return batch;
  };
  commitInBackground(build(), 'session_ended', build);
}

/** Soft delete of an ended session: hidden from lists, report and events stay. */
export async function deleteSession(wid: string, session: Session, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.update(refs.session(wid, session.id), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'session_deleted', { sessionId: session.id });
  await commitOnline(batch);
}

/** Online: the target member's status is checked by rules against the server. */
export async function reassignOperator(wid: string, session: Session, operatorId: string, actor: Actor) {
  await requireOnline();
  const batch = writeBatch(db);
  batch.update(refs.session(wid, session.id), { operatorId, updatedAt: serverTimestamp() });
  addEvent(batch, refs.sessionEvents(wid, session.id), { workspaceId: wid, sessionId: session.id }, actor, 'operator_reassigned', {
    from: session.operatorId,
    to: operatorId,
  });
  await commitOnline(batch);
}
