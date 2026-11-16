import {
  getDocsFromServer,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';

import { buildProfileFields, toFormValues, type BeneficiaryInput } from '@/domain/beneficiary';
import { diffBeneficiaryEvents } from '@/domain/events';
import { chunkForBatches, type ImportPlan, type ParsedRow } from '@/domain/import';
import { MAX_PHONES } from '@/domain/phone';
import { nameSearchKey } from '@/domain/search';
import type { Area, Beneficiary, City } from '@/domain/types';
import { newBeneficiaryDoc } from '@/services/beneficiaries/api';
import { db } from '@/services/firebase/client';
import { addEvent, newId, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground, commitOnline } from '@/services/firebase/write';
import { FANOUT_BATCH } from '@/services/places/api';
import { requireOnline } from '@/services/sync/connectivity';

const clock = { now: () => Timestamp.now() };

/** Reads the first sheet of an xlsx/xls/csv file into a matrix of raw cell values. */
export async function readImportFile(uri: string, name: string): Promise<{ sheetName: string; matrix: unknown[][] }> {
  const file = new File(uri);
  const isCsv = /\.csv$/i.test(name);
  const workbook = isCsv
    ? XLSX.read((await file.text()).replace(/^\uFEFF/, ''), { type: 'string', raw: true })
    : XLSX.read(await file.bytes(), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheetName || !sheet) return { sheetName: '', matrix: [] };
  // raw values keep long phone numbers intact (formatted text may turn them into 2.01E+11).
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false });
  return { sheetName, matrix };
}

export type ImportContext = { existing: Beneficiary[]; cities: City[]; areas: Area[] };

/**
 * Online only. Reads every beneficiary (archived included) from the server so
 * duplicate detection is exact; costs one read per beneficiary (~500).
 */
export async function loadImportContext(wid: string): Promise<ImportContext> {
  await requireOnline();
  const [beneficiaries, cities, areas] = await Promise.all([
    getDocsFromServer(refs.beneficiaries(wid)),
    getDocsFromServer(refs.cities(wid)),
    getDocsFromServer(refs.areas(wid)),
  ]);
  return {
    existing: beneficiaries.docs.map((d) => ({ ...(d.data() as Omit<Beneficiary, 'id'>), id: d.id })),
    cities: cities.docs.map((d) => ({ ...(d.data() as Omit<City, 'id'>), id: d.id })),
    areas: areas.docs.map((d) => ({ ...(d.data() as Omit<Area, 'id'>), id: d.id })),
  };
}

export type ImportOptions = { duplicateAction: 'skip' | 'update'; createMissing: boolean; fileName: string };

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  createdCities: number;
  createdAreas: number;
  /** Set when a batch failed; earlier batches are committed. */
  error?: unknown;
  processed: number;
};

type ResolvedPlace = { cityId: string; cityName: string; areaId: string; areaName: string };

const placeKey = (city: string, area: string) => `${nameSearchKey(city)}|${nameSearchKey(area)}`;

/** Creates missing cities/areas (online) and returns a lookup by normalized city|area names. */
async function resolvePlaces(wid: string, plan: ImportPlan, ctx: ImportContext, create: boolean, actor: Actor) {
  const places = new Map<string, ResolvedPlace>();
  const cityByKey = new Map(ctx.cities.map((c) => [c.nameSearch || nameSearchKey(c.name), c]));
  for (const area of ctx.areas) {
    const city = ctx.cities.find((c) => c.id === area.cityId);
    if (!city) continue;
    places.set(placeKey(city.name, area.name), { cityId: city.id, cityName: city.name, areaId: area.id, areaName: area.name });
  }
  if (!create || plan.missingAreas.length === 0) return { places, createdCities: 0, createdAreas: 0 };

  type Op = (batch: ReturnType<typeof writeBatch>) => void;
  const ops: Op[] = [];
  const newCities = new Map<string, { id: string; name: string }>();
  let createdAreas = 0;
  for (const missing of plan.missingAreas) {
    const cityKey = nameSearchKey(missing.cityName);
    let city: { id: string; name: string } | undefined = cityByKey.get(cityKey) ?? newCities.get(cityKey);
    if (!city) {
      const created = { id: newId(refs.cities(wid)), name: missing.cityName.trim() };
      newCities.set(cityKey, created);
      city = created;
      ops.push((batch) =>
        batch.set(refs.city(wid, created.id), {
          name: created.name,
          nameSearch: nameSearchKey(created.name),
          isArchived: false,
          createdAt: serverTimestamp(),
          createdBy: actor.uid,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    const areaId = newId(refs.areas(wid));
    const areaName = missing.areaName.trim();
    const owner = city;
    ops.push((batch) =>
      batch.set(refs.area(wid, areaId), {
        name: areaName,
        nameSearch: nameSearchKey(areaName),
        cityId: owner.id,
        cityName: owner.name,
        description: null,
        isActive: true,
        beneficiaryCount: 0,
        createdAt: serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: serverTimestamp(),
      }),
    );
    createdAreas += 1;
    places.set(placeKey(missing.cityName, missing.areaName), {
      cityId: owner.id,
      cityName: owner.name,
      areaId,
      areaName,
    });
  }
  for (let i = 0; i < ops.length; i += FANOUT_BATCH) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + FANOUT_BATCH)) op(batch);
    if (i + FANOUT_BATCH >= ops.length) {
      batch.update(refs.workspace(wid), {
        cityCount: increment(newCities.size),
        areaCount: increment(createdAreas),
        updatedAt: serverTimestamp(),
      });
    }
    await commitOnline(batch);
  }
  return { places, createdCities: newCities.size, createdAreas };
}

function inputFromRow(row: ParsedRow, place: ResolvedPlace, before?: Beneficiary): BeneficiaryInput {
  const base = before ? toFormValues(before) : undefined;
  const phones = base?.phones ?? [];
  const known = new Set((before?.phones ?? []).map((p) => p.number));
  row.phones.forEach((e164, index) => {
    if (known.has(e164) || phones.length >= MAX_PHONES) return;
    phones.push({ id: randomUUID(), raw: row.rawPhones[index] ?? e164, label: '', isPrimary: phones.length === 0 });
  });
  const keep = (field: 'householdCount' | 'residentialAddress' | 'pickupLocation' | 'notes', value: string) =>
    !base || row.provided[field] ? value : (base[field] ?? '');
  return {
    fullName: row.fullName,
    householdCount: keep('householdCount', String(row.householdCount)),
    cityId: place.cityId,
    areaId: place.areaId,
    residentialAddress: keep('residentialAddress', row.residentialAddress ?? ''),
    pickupLocation: keep('pickupLocation', row.pickupLocation ?? ''),
    notes: keep('notes', row.notes ?? ''),
    phones,
  };
}

type Work =
  | { kind: 'create'; id: string; row: ParsedRow; place: ResolvedPlace; areaKeys: string[] }
  | { kind: 'update'; before: Beneficiary; row: ParsedRow; place: ResolvedPlace; areaKeys: string[] };

/**
 * Online only, awaited batch by batch (each ≤ ~200 rows / 490 writes). Safe
 * to re-run: rows matching an existing beneficiary are skipped or updated, and
 * updates without an actual change write nothing.
 */
export async function runImport(
  wid: string,
  plan: ImportPlan,
  ctx: ImportContext,
  options: ImportOptions,
  actor: Actor,
  onProgress: (done: number, total: number) => void,
): Promise<ImportResult> {
  await requireOnline();
  const { places, createdCities, createdAreas } = await resolvePlaces(wid, plan, ctx, options.createMissing, actor);
  const byId = new Map(ctx.existing.map((b) => [b.id, b]));
  const touched = new Set<string>();
  let skipped = 0;
  const work: Work[] = [];

  for (const entry of plan.rows) {
    const place = places.get(placeKey(entry.row.cityName, entry.row.areaName));
    if (entry.kind === 'invalid' || entry.kind === 'fileDuplicate' || !place) {
      skipped += 1;
      continue;
    }
    if (entry.kind === 'new') {
      work.push({ kind: 'create', id: newId(refs.beneficiaries(wid)), row: entry.row, place, areaKeys: [place.areaId] });
      continue;
    }
    const before = byId.get(entry.beneficiaryId);
    if (options.duplicateAction === 'skip' || !before || touched.has(before.id)) {
      skipped += 1;
      continue;
    }
    touched.add(before.id);
    work.push({ kind: 'update', before, row: entry.row, place, areaKeys: [before.areaId, place.areaId] });
  }

  const result: ImportResult = { created: 0, updated: 0, skipped, createdCities, createdAreas, processed: 0 };
  const total = work.length;
  onProgress(0, total);

  for (const chunk of chunkForBatches(work)) {
    const batch = writeBatch(db);
    const areaDelta = new Map<string, number>();
    let created = 0;
    let updated = 0;
    for (const item of chunk) {
      if (item.kind === 'create') {
        const fields = buildProfileFields(inputFromRow(item.row, item.place), item.place, undefined, clock);
        batch.set(refs.beneficiary(wid, item.id), newBeneficiaryDoc(wid, fields, actor));
        areaDelta.set(item.place.areaId, (areaDelta.get(item.place.areaId) ?? 0) + 1);
        addEvent(batch, refs.history(wid, item.id), { workspaceId: wid, beneficiaryId: item.id }, actor, 'imported', {
          mode: 'create',
          fileName: options.fileName,
          line: item.row.line,
        });
        created += 1;
        continue;
      }
      const { before } = item;
      const fields = buildProfileFields(inputFromRow(item.row, item.place, before), item.place, before.phones, clock);
      const changes = diffBeneficiaryEvents(before, { ...fields, mapPins: before.mapPins });
      if (changes.length === 0 && before.cityName === fields.cityName && before.areaName === fields.areaName) {
        result.skipped += 1;
        continue;
      }
      batch.update(refs.beneficiary(wid, before.id), { ...fields, updatedAt: serverTimestamp(), updatedBy: actor.uid });
      if (before.areaId !== fields.areaId && !before.isArchived) {
        areaDelta.set(before.areaId, (areaDelta.get(before.areaId) ?? 0) - 1);
        areaDelta.set(fields.areaId, (areaDelta.get(fields.areaId) ?? 0) + 1);
      }
      addEvent(batch, refs.history(wid, before.id), { workspaceId: wid, beneficiaryId: before.id }, actor, 'imported', {
        mode: 'update',
        fileName: options.fileName,
        line: item.row.line,
        changes,
      });
      updated += 1;
    }
    if (created > 0) {
      batch.update(refs.workspace(wid), { beneficiaryCount: increment(created), updatedAt: serverTimestamp() });
    }
    for (const [areaId, delta] of areaDelta) {
      if (delta !== 0) batch.update(refs.area(wid, areaId), { beneficiaryCount: increment(delta) });
    }
    try {
      if (created + updated > 0) await commitOnline(batch);
    } catch (error) {
      result.error = error;
      break;
    }
    result.created += created;
    result.updated += updated;
    result.processed += chunk.length;
    onProgress(result.processed, total);
  }

  const audit = writeBatch(db);
  addEvent(audit, refs.audit(wid), { workspaceId: wid }, actor, 'import_completed', {
    fileName: options.fileName,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    createdCities,
    createdAreas,
    complete: result.error === undefined,
  });
  commitInBackground(audit, 'import_completed');
  return result;
}
