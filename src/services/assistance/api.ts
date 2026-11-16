import { serverTimestamp, Timestamp, writeBatch, type WriteBatch } from '@react-native-firebase/firestore';

import type { AssistanceRecord, AssistanceType, Beneficiary } from '@/domain/types';
import { db } from '@/services/firebase/client';
import { addEvent, newId, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground } from '@/services/firebase/write';

export type AssistanceInput = {
  type: AssistanceType;
  description?: string;
  deliveredAt: Date;
  notes?: string;
  confirmNow: boolean;
  sessionId?: string | null;
};

/** Only a newer confirmed delivery moves the beneficiary's "last confirmed assistance". */
function isNewer(b: Beneficiary, deliveredAt: Timestamp) {
  return !b.lastConfirmedAssistanceAt || b.lastConfirmedAssistanceAt.toMillis() <= deliveredAt.toMillis();
}

function markLastConfirmed(batch: WriteBatch, wid: string, b: Beneficiary, recordId: string, deliveredAt: Timestamp, actor: Actor) {
  batch.update(refs.beneficiary(wid, b.id), {
    lastConfirmedAssistanceAt: deliveredAt,
    lastConfirmedAssistanceRecordId: recordId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
}

/**
 * Assistance records are the only delivery evidence in the app. A session "check"
 * never creates one; confirming is an explicit, separate act.
 */
export function recordAssistance(wid: string, b: Beneficiary, input: AssistanceInput, actor: Actor): string {
  const id = newId(refs.assistance(wid, b.id));
  const deliveredAt = Timestamp.fromDate(input.deliveredAt);
  const build = () => {
    const batch = writeBatch(db);
    batch.set(refs.assistanceRecord(wid, b.id, id), {
      workspaceId: wid,
      beneficiaryId: b.id,
      type: input.type,
      description: input.description?.trim() || null,
      sessionId: input.sessionId ?? null,
      deliveredAt,
      recordedBy: actor.uid,
      recordedByName: actor.name,
      notes: input.notes?.trim() || null,
      confirmationStatus: input.confirmNow ? 'confirmed' : 'unconfirmed',
      confirmedAt: input.confirmNow ? serverTimestamp() : null,
      confirmedBy: input.confirmNow ? actor.uid : null,
      createdAt: serverTimestamp(),
      clientAt: Timestamp.now(),
    });
    const base = { workspaceId: wid, beneficiaryId: b.id };
    addEvent(batch, refs.history(wid, b.id), base, actor, 'assistance_recorded', { recordId: id, type: input.type });
    if (input.confirmNow) {
      addEvent(batch, refs.history(wid, b.id), base, actor, 'assistance_confirmed', { recordId: id });
      if (isNewer(b, deliveredAt)) markLastConfirmed(batch, wid, b, id, deliveredAt, actor);
    }
    return batch;
  };
  commitInBackground(build(), 'assistance_recorded', build);
  return id;
}

export function confirmAssistance(wid: string, b: Beneficiary, record: AssistanceRecord, actor: Actor) {
  if (record.confirmationStatus === 'confirmed') return;
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.assistanceRecord(wid, b.id, record.id), {
      confirmationStatus: 'confirmed',
      confirmedAt: serverTimestamp(),
      confirmedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    addEvent(batch, refs.history(wid, b.id), { workspaceId: wid, beneficiaryId: b.id }, actor, 'assistance_confirmed', {
      recordId: record.id,
    });
    if (isNewer(b, record.deliveredAt)) markLastConfirmed(batch, wid, b, record.id, record.deliveredAt, actor);
    return batch;
  };
  commitInBackground(build(), 'assistance_confirmed', build);
}
