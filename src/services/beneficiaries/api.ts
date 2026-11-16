import { increment, serverTimestamp, Timestamp, writeBatch, type WriteBatch } from '@react-native-firebase/firestore';

import { buildProfileFields, SCHEMA_VERSION, type BeneficiaryInput } from '@/domain/beneficiary';
import { diffBeneficiaryEvents } from '@/domain/events';
import type { Beneficiary, MapPin } from '@/domain/types';
import { db } from '@/services/firebase/client';
import { addEvent, newId, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground } from '@/services/firebase/write';

const clock = { now: () => Timestamp.now() };

export type Place = { cityName: string; areaName: string };

function historyEvent(batch: WriteBatch, wid: string, bid: string, actor: Actor, type: string, metadata = {}) {
  addEvent(batch, refs.history(wid, bid), { workspaceId: wid, beneficiaryId: bid }, actor, type, metadata);
}

/** Full document for a new beneficiary (shared by the form and the importer). */
export function newBeneficiaryDoc(wid: string, fields: ReturnType<typeof buildProfileFields>, actor: Actor) {
  return {
    workspaceId: wid,
    ...fields,
    mapPins: [],
    lastConfirmedAssistanceAt: null,
    lastConfirmedAssistanceRecordId: null,
    isArchived: false,
    archivedAt: null,
    extra: {},
    schemaVersion: SCHEMA_VERSION,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  };
}

/** Offline-safe: one batch with the doc, counters and a history event. */
export function createBeneficiary(wid: string, input: BeneficiaryInput, place: Place, actor: Actor): string {
  const id = newId(refs.beneficiaries(wid));
  const fields = buildProfileFields(input, place, undefined, clock);
  const build = () => {
    const batch = writeBatch(db);
    batch.set(refs.beneficiary(wid, id), newBeneficiaryDoc(wid, fields, actor));
    batch.update(refs.workspace(wid), { beneficiaryCount: increment(1), updatedAt: serverTimestamp() });
    batch.update(refs.area(wid, input.areaId), { beneficiaryCount: increment(1) });
    historyEvent(batch, wid, id, actor, 'beneficiary_created', { fullName: fields.fullName });
    return batch;
  };
  commitInBackground(build(), 'beneficiary_create', build);
  return id;
}

export function updateBeneficiary(wid: string, before: Beneficiary, input: BeneficiaryInput, place: Place, actor: Actor) {
  const fields = buildProfileFields(input, place, before.phones, clock);
  const types = diffBeneficiaryEvents(before, { ...fields, mapPins: before.mapPins });
  if (types.length === 0) return;
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.beneficiary(wid, before.id), { ...fields, updatedAt: serverTimestamp(), updatedBy: actor.uid });
    if (before.areaId !== input.areaId && !before.isArchived) {
      batch.update(refs.area(wid, before.areaId), { beneficiaryCount: increment(-1) });
      batch.update(refs.area(wid, input.areaId), { beneficiaryCount: increment(1) });
    }
    for (const type of types) {
      historyEvent(batch, wid, before.id, actor, type, summarize(type, before, fields));
    }
    return batch;
  };
  commitInBackground(build(), 'beneficiary_update', build);
}

function summarize(type: string, before: Beneficiary, after: ReturnType<typeof buildProfileFields>) {
  switch (type) {
    case 'beneficiary_updated':
      return {
        before: { fullName: before.fullName, householdCount: before.householdCount },
        after: { fullName: after.fullName, householdCount: after.householdCount },
      };
    case 'area_changed':
      return { before: { areaName: before.areaName }, after: { areaName: after.areaName } };
    case 'address_changed':
      return { before: before.residentialAddress ?? null, after: after.residentialAddress };
    case 'pickup_changed':
      return { before: before.pickupLocation ?? null, after: after.pickupLocation };
    case 'primary_phone_changed':
      return { before: before.primaryPhone, after: after.primaryPhone };
    default:
      return {};
  }
}

export function setBeneficiaryArchived(wid: string, b: Beneficiary, archived: boolean, actor: Actor) {
  if (b.isArchived === archived) return;
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.beneficiary(wid, b.id), {
      isArchived: archived,
      archivedAt: archived ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
    batch.update(refs.workspace(wid), { beneficiaryCount: increment(archived ? -1 : 1), updatedAt: serverTimestamp() });
    batch.update(refs.area(wid, b.areaId), { beneficiaryCount: increment(archived ? -1 : 1) });
    historyEvent(batch, wid, b.id, actor, archived ? 'archived' : 'restored');
    return batch;
  };
  commitInBackground(build(), 'beneficiary_archive', build);
}

/** Pins are rewritten as a whole array (bounded to 10, last write wins). */
export function saveMapPins(
  wid: string,
  b: Beneficiary,
  pins: MapPin[],
  change: { type: 'pin_added' | 'pin_updated' | 'pin_removed'; pinId: string },
  actor: Actor,
) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.beneficiary(wid, b.id), { mapPins: pins, updatedAt: serverTimestamp(), updatedBy: actor.uid });
    historyEvent(batch, wid, b.id, actor, change.type, { pinId: change.pinId });
    return batch;
  };
  commitInBackground(build(), change.type, build);
}

/** Starting a call is logged as an attempt only: it never means the call was answered. */
export function logCallAttempt(wid: string, bid: string, phone: string, actor: Actor, sessionId?: string) {
  const build = () => {
    const batch = writeBatch(db);
    historyEvent(batch, wid, bid, actor, 'call_initiated', { phone, sessionId: sessionId ?? null });
    return batch;
  };
  commitInBackground(build(), 'call_initiated', build);
}
