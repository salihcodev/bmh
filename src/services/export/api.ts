import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
  type QueryConstraint,
} from '@react-native-firebase/firestore';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import {
  EXPORT_MIME,
  exportFileName,
  toCsv,
  toHtml,
  toSheets,
  type ExportDoc,
  type ExportFormat,
  type ExportPreset,
} from '@/domain/export';
import type { AssistanceRecord, Beneficiary, EventRecord, Session, SessionItem } from '@/domain/types';
import { db } from '@/services/firebase/client';
import { addEvent, refs, type Actor } from '@/services/firebase/refs';
import { commitInBackground } from '@/services/firebase/write';

const PROFILE_HISTORY_LIMIT = 200;

/*
 * Reads use the default source: server when online, local cache when offline.
 * `fromCache` lets the screen warn that the export may be stale.
 */

export async function fetchBeneficiaries(
  wid: string,
  scope: { cityId?: string; areaId?: string; includeArchived?: boolean },
): Promise<{ list: Beneficiary[]; fromCache: boolean }> {
  const filters: QueryConstraint[] = [];
  if (!scope.includeArchived) filters.push(where('isArchived', '==', false));
  if (scope.areaId) filters.push(where('areaId', '==', scope.areaId));
  else if (scope.cityId) filters.push(where('cityId', '==', scope.cityId));
  const snapshot = await getDocs(query(refs.beneficiaries(wid), ...filters));
  return {
    list: snapshot.docs.map((d) => ({ ...(d.data() as Omit<Beneficiary, 'id'>), id: d.id })),
    fromCache: snapshot.metadata.fromCache,
  };
}

export async function fetchProfile(wid: string, bid: string, includeHistory: boolean) {
  const [doc, assistance, history] = await Promise.all([
    getDoc(refs.beneficiary(wid, bid)),
    getDocs(refs.assistance(wid, bid)),
    includeHistory
      ? getDocs(query(refs.history(wid, bid), orderBy('createdAt', 'desc'), limit(PROFILE_HISTORY_LIMIT)))
      : Promise.resolve(null),
  ]);
  if (!doc.exists()) return null;
  return {
    beneficiary: { ...(doc.data() as Omit<Beneficiary, 'id'>), id: doc.id },
    assistance: assistance.docs.map((d) => ({ ...(d.data() as Omit<AssistanceRecord, 'id'>), id: d.id })),
    history: history ? history.docs.map((d) => ({ ...(d.data() as Omit<EventRecord, 'id'>), id: d.id })) : [],
    fromCache: doc.metadata.fromCache || assistance.metadata.fromCache,
  };
}

export async function fetchSessionReport(wid: string, sid: string) {
  const [doc, items] = await Promise.all([getDoc(refs.session(wid, sid)), getDocs(refs.items(wid, sid))]);
  if (!doc.exists()) return null;
  return {
    session: { ...(doc.data() as Omit<Session, 'id'>), id: doc.id },
    items: items.docs.map((d) => ({ ...(d.data() as Omit<SessionItem, 'id'>), id: d.id })),
    fromCache: doc.metadata.fromCache || items.metadata.fromCache,
  };
}

let fontCache: string | null = null;

/** Bundled IBM Plex Sans Arabic as base64, so PDFs render Arabic offline without network fonts. */
async function arabicFontBase64(): Promise<string | null> {
  if (fontCache) return fontCache;
  try {
    const asset = Asset.fromModule(IBMPlexSansArabic_400Regular);
    await asset.downloadAsync();
    if (!asset.localUri) return null;
    fontCache = await new File(asset.localUri).base64();
    return fontCache;
  } catch {
    return null;
  }
}

function writeXlsx(doc: ExportDoc, target: File, rtl: boolean) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of toSheets(doc)) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    const widths = (sheet.rows[0] ?? []).map((_, col) =>
      Math.min(60, Math.max(8, ...sheet.rows.map((row) => String(row[col] ?? '').length + 2))),
    );
    ws['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }
  workbook.Workbook = { Views: [{ RTL: rtl }] };
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  target.write(new Uint8Array(data));
}

/** Builds the file in the cache directory and opens the system share sheet. Works offline. */
export async function shareExport(
  doc: ExportDoc,
  format: ExportFormat,
  options: { baseName: string; rtl: boolean; footer?: string; dialogTitle?: string },
): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('share_unavailable');
  const target = new File(Paths.cache, exportFileName(options.baseName, format, new Date()));
  if (target.exists) target.delete();

  if (format === 'pdf') {
    const html = toHtml(doc, { rtl: options.rtl, fontBase64: await arabicFontBase64(), footer: options.footer });
    const { uri } = await Print.printToFileAsync({ html });
    await new File(uri).move(target, { overwrite: true });
  } else {
    target.create({ overwrite: true });
    if (format === 'xlsx') writeXlsx(doc, target, options.rtl);
    else target.write(toCsv(doc));
  }

  await Sharing.shareAsync(target.uri, { ...EXPORT_MIME[format], dialogTitle: options.dialogTitle });
  return target.uri;
}

/** Audit only (no data copy). Offline-safe. */
export function logExport(
  wid: string,
  actor: Actor,
  meta: { preset: ExportPreset; format: ExportFormat; rows: number; fromCache: boolean; targetId?: string | null },
) {
  const batch = writeBatch(db);
  addEvent(batch, refs.audit(wid), { workspaceId: wid }, actor, 'export_created', { ...meta, targetId: meta.targetId ?? null });
  commitInBackground(batch, 'export_created');
}
