import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type WriteBatch,
} from '@react-native-firebase/firestore';

import { db } from './client';

export const refs = {
  user: (uid: string) => doc(db, 'users', uid),
  workspace: (wid: string) => doc(db, 'workspaces', wid),
  workspaces: () => collection(db, 'workspaces'),
  members: (wid: string) => collection(db, 'workspaces', wid, 'members'),
  member: (wid: string, uid: string) => doc(db, 'workspaces', wid, 'members', uid),
  invites: (wid: string) => collection(db, 'workspaces', wid, 'invites'),
  invite: (wid: string, code: string) => doc(db, 'workspaces', wid, 'invites', code),
  cities: (wid: string) => collection(db, 'workspaces', wid, 'cities'),
  city: (wid: string, id: string) => doc(db, 'workspaces', wid, 'cities', id),
  areas: (wid: string) => collection(db, 'workspaces', wid, 'areas'),
  area: (wid: string, id: string) => doc(db, 'workspaces', wid, 'areas', id),
  beneficiaries: (wid: string) => collection(db, 'workspaces', wid, 'beneficiaries'),
  beneficiary: (wid: string, id: string) => doc(db, 'workspaces', wid, 'beneficiaries', id),
  history: (wid: string, bid: string) => collection(db, 'workspaces', wid, 'beneficiaries', bid, 'history'),
  assistance: (wid: string, bid: string) =>
    collection(db, 'workspaces', wid, 'beneficiaries', bid, 'assistanceRecords'),
  assistanceRecord: (wid: string, bid: string, id: string) =>
    doc(db, 'workspaces', wid, 'beneficiaries', bid, 'assistanceRecords', id),
  sessions: (wid: string) => collection(db, 'workspaces', wid, 'sessions'),
  session: (wid: string, sid: string) => doc(db, 'workspaces', wid, 'sessions', sid),
  items: (wid: string, sid: string) => collection(db, 'workspaces', wid, 'sessions', sid, 'items'),
  item: (wid: string, sid: string, bid: string) => doc(db, 'workspaces', wid, 'sessions', sid, 'items', bid),
  sessionEvents: (wid: string, sid: string) => collection(db, 'workspaces', wid, 'sessions', sid, 'events'),
  audit: (wid: string) => collection(db, 'workspaces', wid, 'auditLog'),
  banners: () => collection(db, 'banners'),
  banner: (id: string) => doc(db, 'banners', id),
  news: () => collection(db, 'news'),
  newsItem: (id: string) => doc(db, 'news', id),
  marketingCards: () => collection(db, 'marketingCards'),
  platformStats: () => doc(db, 'platformStats', 'global'),
  appConfig: (id: 'support' | 'general') => doc(db, 'appConfig', id),
  users: () => collection(db, 'users'),
  mediaAssets: () => collection(db, 'mediaAssets'),
  mediaAsset: (id: string) => doc(db, 'mediaAssets', id),
  adminAuditLog: () => collection(db, 'adminAuditLog'),
};

/** New auto id without a round trip (works offline). */
export function newId(collectionRef: ReturnType<typeof collection>): string {
  return doc(collectionRef).id;
}

export type Actor = { uid: string; name: string };

/** Adds an append-only event to a batch. `createdAt` is the server time; `clientAt` the device time. */
export function addEvent(
  batch: WriteBatch,
  target: ReturnType<typeof collection>,
  base: { workspaceId: string; sessionId?: string; beneficiaryId?: string },
  actor: Actor,
  type: string,
  metadata: DocumentData = {},
): string {
  const ref = doc(target);
  batch.set(ref, {
    id: ref.id,
    ...base,
    actorId: actor.uid,
    actorName: actor.name,
    type,
    createdAt: serverTimestamp(),
    clientAt: Timestamp.now(),
    metadata,
  });
  return ref.id;
}
