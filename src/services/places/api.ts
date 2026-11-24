import {
  getCountFromServer,
  getDocsFromServer,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type WriteBatch,
} from '@react-native-firebase/firestore';

import { nameSearchKey } from '@/domain/search';
import type { Area, City } from '@/domain/types';
import { db } from '@/services/firebase/client';
import { addEvent, newId, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground, commitOnline } from '@/services/firebase/write';
import { requireOnline } from '@/services/sync/connectivity';

/** Firestore batches allow 500 writes; keep headroom for counters/events. */
export const FANOUT_BATCH = 400;

/** Workspace audit entry in the same batch as the change it records. */
function logChange(batch: WriteBatch, wid: string, actor: Actor, type: string, metadata: DocumentData) {
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, type, metadata);
}

export function createCity(wid: string, name: string, actor: Actor): string {
  const id = newId(refs.cities(wid));
  const build = () => {
    const batch = writeBatch(db);
    batch.set(refs.city(wid, id), {
      name: name.trim(),
      nameSearch: nameSearchKey(name),
      isArchived: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    batch.update(refs.workspace(wid), { cityCount: increment(1), updatedAt: serverTimestamp() });
    logChange(batch, wid, actor, 'city_created', { cityId: id, name: name.trim() });
    return batch;
  };
  commitInBackground(build(), 'city_create', build);
  return id;
}

export function setCityArchived(wid: string, city: City, archived: boolean, actor: Actor) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.city(wid, city.id), { isArchived: archived, updatedAt: serverTimestamp() });
    batch.update(refs.workspace(wid), { cityCount: increment(archived ? -1 : 1), updatedAt: serverTimestamp() });
    logChange(batch, wid, actor, archived ? 'city_archived' : 'city_restored', { cityId: city.id, name: city.name });
    return batch;
  };
  commitInBackground(build(), 'city_archive', build);
}

export function createArea(wid: string, city: City, input: { name: string; description?: string }, actor: Actor) {
  const id = newId(refs.areas(wid));
  const build = () => {
    const batch = writeBatch(db);
    batch.set(refs.area(wid, id), {
      name: input.name.trim(),
      nameSearch: nameSearchKey(input.name),
      cityId: city.id,
      cityName: city.name,
      description: input.description?.trim() || null,
      isActive: true,
      beneficiaryCount: 0,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    batch.update(refs.workspace(wid), { areaCount: increment(1), updatedAt: serverTimestamp() });
    logChange(batch, wid, actor, 'area_created', { areaId: id, name: input.name.trim(), cityId: city.id });
    return batch;
  };
  commitInBackground(build(), 'area_create', build);
  return id;
}

export function setAreaActive(wid: string, area: Area, active: boolean, actor: Actor) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.area(wid, area.id), { isActive: active, updatedAt: serverTimestamp() });
    batch.update(refs.workspace(wid), { areaCount: increment(active ? 1 : -1), updatedAt: serverTimestamp() });
    logChange(batch, wid, actor, active ? 'area_restored' : 'area_archived', { areaId: area.id, name: area.name });
    return batch;
  };
  commitInBackground(build(), 'area_active', build);
}

export function updateAreaDescription(wid: string, area: Area, description: string, actor: Actor) {
  const build = () => {
    const batch = writeBatch(db);
    batch.update(refs.area(wid, area.id), { description: description.trim() || null, updatedAt: serverTimestamp() });
    logChange(batch, wid, actor, 'area_updated', { areaId: area.id, name: area.name });
    return batch;
  };
  commitInBackground(build(), 'area_update', build);
}

async function commitFanout(
  head: (batch: ReturnType<typeof writeBatch>) => void,
  targets: DocumentReference[],
  patch: DocumentData,
) {
  for (let i = 0; i < Math.max(1, targets.length); i += FANOUT_BATCH) {
    const batch = writeBatch(db);
    if (i === 0) head(batch);
    for (const ref of targets.slice(i, i + FANOUT_BATCH)) batch.update(ref, patch);
    await commitOnline(batch);
  }
}

/**
 * Online only: the rename must reach every denormalized copy, which needs a
 * server read (the cache may be partial). Returns the number of beneficiaries updated.
 */
export async function renameCity(wid: string, city: City, name: string, actor: Actor): Promise<number> {
  await requireOnline();
  const [areas, beneficiaries] = await Promise.all([
    getDocsFromServer(query(refs.areas(wid), where('cityId', '==', city.id))),
    getDocsFromServer(query(refs.beneficiaries(wid), where('cityId', '==', city.id))),
  ]);
  const trimmed = name.trim();
  await commitFanout(
    (batch) => {
      batch.update(refs.city(wid, city.id), { name: trimmed, nameSearch: nameSearchKey(trimmed), updatedAt: serverTimestamp() });
      for (const area of areas.docs) batch.update(area.ref, { cityName: trimmed, updatedAt: serverTimestamp() });
      logChange(batch, wid, actor, 'city_renamed', { cityId: city.id, from: city.name, to: trimmed });
    },
    beneficiaries.docs.map((d) => d.ref),
    { cityName: trimmed, updatedAt: serverTimestamp(), updatedBy: actor.uid },
  );
  return beneficiaries.size;
}

export async function renameArea(wid: string, area: Area, name: string, actor: Actor): Promise<number> {
  await requireOnline();
  const beneficiaries = await getDocsFromServer(query(refs.beneficiaries(wid), where('areaId', '==', area.id)));
  const trimmed = name.trim();
  await commitFanout(
    (batch) => {
      batch.update(refs.area(wid, area.id), { name: trimmed, nameSearch: nameSearchKey(trimmed), updatedAt: serverTimestamp() });
      logChange(batch, wid, actor, 'area_renamed', { areaId: area.id, from: area.name, to: trimmed });
    },
    beneficiaries.docs.map((d) => d.ref),
    { areaName: trimmed, updatedAt: serverTimestamp(), updatedBy: actor.uid },
  );
  return beneficiaries.size;
}

/**
 * Admin repair for counter drift (concurrent offline edits). Aggregation
 * queries cost 1 read per 1000 counted docs, so this is cheap at ~500 beneficiaries.
 */
export async function recountCounters(wid: string, actor: Actor) {
  await requireOnline();
  const [beneficiaries, cities, areasSnap, sessions] = await Promise.all([
    getCountFromServer(query(refs.beneficiaries(wid), where('isArchived', '==', false))),
    getCountFromServer(query(refs.cities(wid), where('isArchived', '==', false))),
    getDocsFromServer(refs.areas(wid)),
    getCountFromServer(refs.sessions(wid)),
  ]);
  const areaCounts = await Promise.all(
    areasSnap.docs.map(async (area) => {
      const counted = await getCountFromServer(
        query(refs.beneficiaries(wid), where('isArchived', '==', false), where('areaId', '==', area.id)),
      );
      return { ref: area.ref, count: counted.data().count, active: (area.data() as Area).isActive };
    }),
  );
  const batch = writeBatch(db);
  const counters = {
    beneficiaryCount: beneficiaries.data().count,
    cityCount: cities.data().count,
    areaCount: areaCounts.filter((a) => a.active).length,
    sessionCount: sessions.data().count,
  };
  batch.update(refs.workspace(wid), { ...counters, updatedAt: serverTimestamp() });
  for (const area of areaCounts) batch.update(area.ref, { beneficiaryCount: area.count });
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'counters_recounted', counters);
  await commitOnline(batch);
  return counters;
}
