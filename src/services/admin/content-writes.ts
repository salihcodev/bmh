import { getDocFromServer, serverTimestamp, writeBatch } from '@react-native-firebase/firestore';

import type { NewsPayload } from '@/domain/news-admin';
import type { SupportMethodPayload } from '@/domain/support-method';
import type { SystemMessage, SystemMessagePayload } from '@/domain/system-message';
import { db } from '@/services/firebase/client';
import { newId, refs, type Actor } from '@/services/firebase/refs';
import { commitOnline } from '@/services/firebase/write';

import { audit } from './admin-writes';

// Dashboard content writes (CONT-03/04): news, system messages and banner deletion. Same pattern as
// admin-writes.ts: online only, one batch with the audit entry, and the rules enforce the keys.

const SOFT_DELETE = (actor: Actor) => ({
  isDeleted: true,
  deletedAt: serverTimestamp(),
  deletedBy: actor.uid,
  updatedAt: serverTimestamp(),
  updatedBy: actor.uid,
});

// ---------- banners ----------

export async function deleteBanner(actor: Actor, id: string) {
  const batch = writeBatch(db);
  batch.update(refs.banner(id), { ...SOFT_DELETE(actor), isActive: false });
  audit(batch, actor, 'banner_deleted', 'banner', id);
  await commitOnline(batch);
}

// ---------- news ----------

/** Create (optionally published right away) or edit. An edit never touches publishing. */
export async function saveNews(
  actor: Actor,
  id: string | null,
  input: NewsPayload,
  options: { publish?: boolean } = {},
): Promise<string> {
  const newsId = id ?? newId(refs.news());
  const batch = writeBatch(db);
  if (id) {
    batch.update(refs.newsItem(newsId), { ...input, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  } else {
    const publish = options.publish === true;
    batch.set(refs.newsItem(newsId), {
      ...input,
      isPublished: publish,
      publishedAt: publish ? serverTimestamp() : null,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, id ? 'news_updated' : 'news_created', 'news', newsId, { published: !id && options.publish === true });
  await commitOnline(batch);
  return newsId;
}

export async function setNewsPublished(actor: Actor, id: string, published: boolean) {
  const batch = writeBatch(db);
  batch.update(refs.newsItem(id), {
    isPublished: published,
    // The first publish date is kept on hide, so republishing is a visible choice, not an accident.
    ...(published ? { publishedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
  audit(batch, actor, published ? 'news_published' : 'news_unpublished', 'news', id);
  await commitOnline(batch);
}

export async function deleteNews(actor: Actor, id: string) {
  const batch = writeBatch(db);
  batch.update(refs.newsItem(id), { ...SOFT_DELETE(actor), isPublished: false });
  audit(batch, actor, 'news_deleted', 'news', id);
  await commitOnline(batch);
}

// ---------- system messages ----------

export class MessageKeyTakenError extends Error {
  constructor(readonly key: string) {
    super(`A system message with the key "${key}" already exists`);
  }
}

/** The document id is the key, so a create checks first: an existing (even deleted) key is never overwritten. */
export async function createSystemMessage(actor: Actor, input: SystemMessagePayload): Promise<string> {
  const ref = refs.systemMessage(input.key);
  if ((await getDocFromServer(ref)).exists()) throw new MessageKeyTakenError(input.key);
  const batch = writeBatch(db);
  const { title, ...rest } = input;
  batch.set(ref, {
    ...rest,
    ...(title ? { title } : {}),
    startsAt: null,
    endsAt: null,
    isDeleted: false,
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, 'message_created', 'systemMessage', input.key, { category: input.category, published: input.isPublished });
  await commitOnline(batch);
  return input.key;
}

/** Content only: the key is fixed, and publishing is a separate action with its own permission. */
export async function updateSystemMessage(actor: Actor, key: string, input: SystemMessagePayload) {
  const batch = writeBatch(db);
  batch.update(refs.systemMessage(key), {
    category: input.category,
    type: input.type,
    title: input.title,
    text: input.text,
    placement: input.placement,
    audience: input.audience,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  audit(batch, actor, 'message_updated', 'systemMessage', key, { category: input.category });
  await commitOnline(batch);
}

export async function setSystemMessagePublished(actor: Actor, message: Pick<SystemMessage, 'key'>, published: boolean) {
  const batch = writeBatch(db);
  batch.update(refs.systemMessage(message.key), { isPublished: published, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  audit(batch, actor, published ? 'message_published' : 'message_unpublished', 'systemMessage', message.key);
  await commitOnline(batch);
}

export async function deleteSystemMessage(actor: Actor, key: string) {
  const batch = writeBatch(db);
  batch.update(refs.systemMessage(key), { ...SOFT_DELETE(actor), isPublished: false });
  audit(batch, actor, 'message_deleted', 'systemMessage', key);
  await commitOnline(batch);
}

// ---------- support methods ----------

/** Create (hidden unless `publish`) or edit. An edit never changes visibility or order. */
export async function saveSupportMethod(
  actor: Actor,
  id: string | null,
  input: SupportMethodPayload,
  options: { publish?: boolean; order?: number } = {},
): Promise<string> {
  const methodId = id ?? newId(refs.supportMethods());
  const batch = writeBatch(db);
  if (id) {
    batch.update(refs.supportMethod(methodId), { ...input, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  } else {
    batch.set(refs.supportMethod(methodId), {
      ...input,
      order: options.order ?? 0,
      isActive: options.publish === true,
      isDeleted: false,
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  audit(batch, actor, id ? 'support_method_updated' : 'support_method_created', 'supportMethod', methodId);
  await commitOnline(batch);
  return methodId;
}

export async function setSupportMethodActive(actor: Actor, id: string, isActive: boolean) {
  const batch = writeBatch(db);
  batch.update(refs.supportMethod(id), { isActive, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  audit(batch, actor, 'support_method_updated', 'supportMethod', id, { isActive });
  await commitOnline(batch);
}

export async function deleteSupportMethod(actor: Actor, id: string) {
  const batch = writeBatch(db);
  batch.update(refs.supportMethod(id), { ...SOFT_DELETE(actor), isActive: false });
  audit(batch, actor, 'support_method_deleted', 'supportMethod', id);
  await commitOnline(batch);
}

/** Writes new `order` values (two documents for a swap) with one audit entry. */
export async function reorderSupportMethods(actor: Actor, updates: { id: string; order: number }[]) {
  if (updates.length === 0) return;
  const batch = writeBatch(db);
  for (const { id, order } of updates) {
    batch.update(refs.supportMethod(id), { order, updatedAt: serverTimestamp(), updatedBy: actor.uid });
  }
  audit(batch, actor, 'support_methods_reordered', 'supportMethod', updates[0]!.id, { orders: updates });
  await commitOnline(batch);
}
