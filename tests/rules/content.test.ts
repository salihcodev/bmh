import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';

import { as, MODERATOR, seed, seedStaff, seedSuperAdmin, setupRulesEnv, SUPER, SUPPORT, userDoc } from './helpers';

const t = setupRulesEnv();

// Custom system roles, each holding a slice of the content keys.
const EDITOR = 'editor'; // edits, never publishes or deletes
const PUBLISHER = 'publisher'; // publishes only
const ALERTER = 'alerter'; // alerts only

async function seedContentStaff() {
  const role = (permissions: string[]) => ({
    name: { ar: 'دور', en: 'Role' },
    permissions,
    isLocked: false,
    isDeleted: false,
    createdAt: Timestamp.now(),
  });
  await seed(t.env, {
    'systemRoles/editor': role(['messages.view', 'messages.edit', 'messages.create', 'support-methods.view', 'support-methods.edit', 'support-methods.create', 'banners.view', 'banners.edit', 'banners.create', 'news.view', 'news.edit', 'news.create']),
    'systemRoles/publisher': role(['messages.view', 'messages.publish', 'support-methods.view', 'support-methods.publish', 'banners.view', 'banners.publish', 'news.view', 'news.publish']),
    'systemRoles/alerter': role(['alerts.view', 'alerts.create', 'alerts.edit', 'alerts.publish', 'alerts.delete']),
    [`users/${EDITOR}`]: userDoc('Editor', { userType: 'custom', systemRoleId: 'editor' }),
    [`users/${PUBLISHER}`]: userDoc('Publisher', { userType: 'custom', systemRoleId: 'publisher' }),
    [`users/${ALERTER}`]: userDoc('Alerter', { userType: 'custom', systemRoleId: 'alerter' }),
  });
}

const removalBy = (uid: string, extra: Record<string, unknown> = {}) => ({
  isDeleted: true,
  deletedAt: serverTimestamp(),
  deletedBy: uid,
  updatedAt: serverTimestamp(),
  ...extra,
});

beforeEach(async () => {
  await seedSuperAdmin(t.env);
  await seedStaff(t.env);
  await seedContentStaff();
  await seed(t.env, { 'users/alice': userDoc('Alice') });
});

describe('systemMessages', () => {
  const message = (key: string, overrides: Record<string, unknown> = {}) => ({
    key,
    category: 'message',
    type: 'info',
    title: { ar: 'عنوان', en: 'Title' },
    text: { ar: 'نص', en: 'Text' },
    placement: 'sync_queue',
    audience: { kind: 'all', values: [] },
    isPublished: false,
    isDeleted: false,
    createdAt: Timestamp.now(),
    createdBy: MODERATOR,
    ...overrides,
  });

  const create = (key: string, overrides: Record<string, unknown> = {}) =>
    message(key, { createdAt: serverTimestamp(), ...overrides });

  beforeEach(async () => {
    await seed(t.env, {
      'systemMessages/sync_queue_info': message('sync_queue_info', { isPublished: true }),
      'systemMessages/draft_one': message('draft_one'),
      'systemMessages/alert_one': message('alert_one', { category: 'alert', type: 'warning' }),
    });
  });

  it('users read a published key, a missing key, and a published list; never a draft', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'systemMessages/sync_queue_info')));
    await assertSucceeds(getDoc(doc(db, 'systemMessages/not_there')));
    await assertFails(getDoc(doc(db, 'systemMessages/draft_one')));
    await assertSucceeds(getDocs(query(collection(db, 'systemMessages'), where('isPublished', '==', true))));
    await assertFails(getDocs(collection(db, 'systemMessages')));
    await assertFails(getDoc(doc(t.env.unauthenticatedContext().firestore(), 'systemMessages/sync_queue_info')));
  });

  it('drafts are read per family: messages.view does not open alerts', async () => {
    await assertSucceeds(getDoc(doc(as(t.env, EDITOR), 'systemMessages/draft_one')));
    await assertFails(getDoc(doc(as(t.env, EDITOR), 'systemMessages/alert_one')));
    await assertSucceeds(getDoc(doc(as(t.env, ALERTER), 'systemMessages/alert_one')));
    await assertSucceeds(getDoc(doc(as(t.env, MODERATOR), 'systemMessages/alert_one')));
    await assertFails(getDoc(doc(as(t.env, SUPPORT), 'systemMessages/draft_one')));
  });

  it('the dashboard list queries one category at a time, by createdAt', async () => {
    const byCategory = (uid: string, category: string) =>
      getDocs(query(collection(as(t.env, uid), 'systemMessages'), where('category', '==', category), orderBy('createdAt', 'desc')));
    await assertSucceeds(byCategory(EDITOR, 'message'));
    await assertFails(byCategory(EDITOR, 'alert'));
    await assertSucceeds(byCategory(ALERTER, 'alert'));
    await assertFails(byCategory(ALERTER, 'message'));
    await assertSucceeds(byCategory(MODERATOR, 'info-text'));
    await assertFails(byCategory(SUPPORT, 'message'));
  });

  it('creating needs the family key, and publishing on create needs publish', async () => {
    await assertSucceeds(setDoc(doc(as(t.env, EDITOR), 'systemMessages/new_draft'), create('new_draft', { createdBy: EDITOR })));
    await assertFails(setDoc(doc(as(t.env, EDITOR), 'systemMessages/new_live'), create('new_live', { createdBy: EDITOR, isPublished: true })));
    await assertSucceeds(setDoc(doc(as(t.env, MODERATOR), 'systemMessages/new_live'), create('new_live', { isPublished: true })));
    await assertFails(setDoc(doc(as(t.env, EDITOR), 'systemMessages/new_alert'), create('new_alert', { createdBy: EDITOR, category: 'alert' })));
    await assertSucceeds(setDoc(doc(as(t.env, ALERTER), 'systemMessages/new_alert'), create('new_alert', { createdBy: ALERTER, category: 'alert' })));
    await assertFails(setDoc(doc(as(t.env, SUPPORT), 'systemMessages/s1'), create('s1', { createdBy: SUPPORT })));
    await assertFails(setDoc(doc(as(t.env, 'alice'), 'systemMessages/a1'), create('a1', { createdBy: 'alice' })));
  });

  it('rejects a key that differs from the document id, empty text and unknown fields', async () => {
    const db = as(t.env, SUPER);
    await assertFails(setDoc(doc(db, 'systemMessages/k1'), create('other', { createdBy: SUPER })));
    await assertFails(setDoc(doc(db, 'systemMessages/k2'), create('k2', { createdBy: SUPER, text: { ar: '', en: 'x' } })));
    await assertFails(setDoc(doc(db, 'systemMessages/k3'), create('k3', { createdBy: SUPER, html: '<b>x</b>' })));
    await assertFails(setDoc(doc(db, 'systemMessages/k4'), create('k4', { createdBy: SUPER, audience: { kind: 'everyone', values: [] } })));
    await assertSucceeds(setDoc(doc(db, 'systemMessages/k5'), create('k5', { createdBy: SUPER, audience: { kind: 'userType', values: ['member'] } })));
  });

  it('edit changes the text but never the publish state; publish only toggles it', async () => {
    const edit = { text: { ar: 'جديد', en: 'New' }, updatedAt: serverTimestamp() };
    await assertSucceeds(updateDoc(doc(as(t.env, EDITOR), 'systemMessages/draft_one'), edit));
    await assertFails(updateDoc(doc(as(t.env, EDITOR), 'systemMessages/draft_one'), { isPublished: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(t.env, PUBLISHER), 'systemMessages/draft_one'), { isPublished: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, PUBLISHER), 'systemMessages/draft_one'), { text: { ar: 'آخر', en: 'Other' }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, 'alice'), 'systemMessages/draft_one'), edit));
  });

  it('editing an alert needs alerts.edit, even with messages.edit', async () => {
    const edit = { text: { ar: 'جديد', en: 'New' }, updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(as(t.env, EDITOR), 'systemMessages/alert_one'), edit));
    await assertSucceeds(updateDoc(doc(as(t.env, ALERTER), 'systemMessages/alert_one'), edit));
  });

  it('soft delete needs the delete key, unpublishes, and is final', async () => {
    await assertFails(updateDoc(doc(as(t.env, EDITOR), 'systemMessages/sync_queue_info'), removalBy(EDITOR, { isPublished: false })));
    await assertFails(updateDoc(doc(as(t.env, MODERATOR), 'systemMessages/sync_queue_info'), removalBy(MODERATOR)));
    await assertSucceeds(updateDoc(doc(as(t.env, MODERATOR), 'systemMessages/sync_queue_info'), removalBy(MODERATOR, { isPublished: false })));
    await assertFails(updateDoc(doc(as(t.env, MODERATOR), 'systemMessages/sync_queue_info'), { text: { ar: 'ع', en: 'e' }, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as(t.env, SUPER), 'systemMessages/draft_one')));
  });
});

describe('supportMethods', () => {
  const method = (overrides: Record<string, unknown> = {}) => ({
    title: { ar: 'إنستا باي', en: 'InstaPay' },
    description: { ar: 'تبرع', en: 'Donate' },
    imagePublicId: 'be-my-hand/support/qr',
    copyValue: 'name@instapay',
    copyLabel: { ar: 'العنوان', en: 'Address' },
    linkUrl: 'https://ipn.eg/S/x/instapay/y',
    order: 0,
    isActive: false,
    isDeleted: false,
    createdBy: MODERATOR,
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}) => method({ createdAt: serverTimestamp(), ...overrides });

  beforeEach(async () => {
    await seed(t.env, {
      'supportMethods/live': method({ isActive: true, createdAt: Timestamp.now() }),
      'supportMethods/hidden': method({ order: 1, createdAt: Timestamp.now() }),
    });
  });

  it('users read active methods only (the query must filter)', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'supportMethods/live')));
    await assertFails(getDoc(doc(db, 'supportMethods/hidden')));
    await assertSucceeds(getDocs(query(collection(db, 'supportMethods'), where('isActive', '==', true))));
    await assertFails(getDocs(collection(db, 'supportMethods')));
  });

  it('staff with the view key read hidden methods; support has none', async () => {
    await assertSucceeds(getDoc(doc(as(t.env, EDITOR), 'supportMethods/hidden')));
    await assertSucceeds(getDocs(collection(as(t.env, MODERATOR), 'supportMethods')));
    await assertFails(getDoc(doc(as(t.env, SUPPORT), 'supportMethods/hidden')));
  });

  it('creating is hidden unless the creator can publish', async () => {
    await assertSucceeds(setDoc(doc(as(t.env, EDITOR), 'supportMethods/m1'), create({ createdBy: EDITOR })));
    await assertFails(setDoc(doc(as(t.env, EDITOR), 'supportMethods/m2'), create({ createdBy: EDITOR, isActive: true })));
    await assertSucceeds(setDoc(doc(as(t.env, MODERATOR), 'supportMethods/m3'), create({ isActive: true })));
    await assertFails(setDoc(doc(as(t.env, PUBLISHER), 'supportMethods/m4'), create({ createdBy: PUBLISHER })));
    await assertFails(setDoc(doc(as(t.env, 'alice'), 'supportMethods/m5'), create({ createdBy: 'alice' })));
  });

  it('validates the document', async () => {
    const db = as(t.env, SUPER);
    await assertFails(setDoc(doc(db, 'supportMethods/v1'), create({ createdBy: SUPER, title: { ar: '', en: 'x' } })));
    await assertFails(setDoc(doc(db, 'supportMethods/v2'), create({ createdBy: SUPER, linkUrl: 'http://insecure.example' })));
    await assertFails(setDoc(doc(db, 'supportMethods/v3'), create({ createdBy: SUPER, linkUrl: 'javascript:alert(1)' })));
    await assertFails(setDoc(doc(db, 'supportMethods/v4'), create({ createdBy: SUPER, order: -1 })));
    await assertFails(setDoc(doc(db, 'supportMethods/v5'), create({ createdBy: SUPER, extra: true })));
    await assertSucceeds(setDoc(doc(db, 'supportMethods/v6'), create({ createdBy: SUPER, linkUrl: null, copyValue: null, imagePublicId: null })));
  });

  it('edit and reorder never flip isActive; publish only flips it', async () => {
    await assertSucceeds(updateDoc(doc(as(t.env, EDITOR), 'supportMethods/hidden'), { order: 5, title: { ar: 'جديد', en: 'New' }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, EDITOR), 'supportMethods/hidden'), { isActive: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(t.env, PUBLISHER), 'supportMethods/hidden'), { isActive: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, PUBLISHER), 'supportMethods/hidden'), { order: 9, updatedAt: serverTimestamp() }));
  });

  it('a reorder swaps two methods and logs it in one batch', async () => {
    const db = as(t.env, EDITOR);
    const batch = writeBatch(db);
    batch.update(doc(db, 'supportMethods/live'), { order: 1, updatedAt: serverTimestamp(), updatedBy: EDITOR });
    batch.update(doc(db, 'supportMethods/hidden'), { order: 0, updatedAt: serverTimestamp(), updatedBy: EDITOR });
    batch.set(doc(collection(db, 'adminAuditLog')), {
      actorId: EDITOR,
      action: 'support_methods_reordered',
      targetType: 'supportMethod',
      targetId: 'live',
      metadata: {},
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('a publisher cannot reorder, and appConfig/support needs app-settings.manage', async () => {
    await assertFails(updateDoc(doc(as(t.env, PUBLISHER), 'supportMethods/live'), { order: 5, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as(t.env, EDITOR), 'appConfig/support'), { developerName: 'Dev' }, { merge: true }));
    await assertFails(setDoc(doc(as(t.env, MODERATOR), 'appConfig/support'), { developerName: 'Dev' }, { merge: true }));
    await assertSucceeds(setDoc(doc(as(t.env, SUPER), 'appConfig/support'), { developerName: 'Dev' }, { merge: true }));
  });

  it('soft delete needs support-methods.delete and hides the method', async () => {
    await assertFails(updateDoc(doc(as(t.env, EDITOR), 'supportMethods/live'), removalBy(EDITOR, { isActive: false })));
    await assertFails(updateDoc(doc(as(t.env, MODERATOR), 'supportMethods/live'), removalBy(MODERATOR)));
    await assertSucceeds(updateDoc(doc(as(t.env, MODERATOR), 'supportMethods/live'), removalBy(MODERATOR, { isActive: false })));
    await assertFails(deleteDoc(doc(as(t.env, SUPER), 'supportMethods/hidden')));
  });
});

describe('banners and news: showing content is its own key', () => {
  const banner = (overrides: Record<string, unknown> = {}) => ({
    title: { ar: 'ع', en: 'E' }, subtitle: { ar: '', en: '' }, imagePublicId: { ar: null, en: null },
    cta: null, order: 3, isActive: false, isDeleted: false, createdAt: serverTimestamp(), ...overrides,
  });

  beforeEach(async () => {
    await seed(t.env, {
      'banners/b1': { title: { ar: 'ع', en: 'E' }, order: 1, isActive: true, isDeleted: false },
      'news/n1': { title: { ar: 'ع', en: 'E' }, isPublished: true, isPinned: false, isDeleted: false, publishedAt: Timestamp.now() },
    });
  });

  it('a banner is created hidden unless the creator can publish', async () => {
    await assertSucceeds(setDoc(doc(as(t.env, EDITOR), 'banners/new1'), banner()));
    await assertFails(setDoc(doc(as(t.env, EDITOR), 'banners/new2'), banner({ isActive: true })));
    await assertSucceeds(setDoc(doc(as(t.env, MODERATOR), 'banners/new3'), banner({ isActive: true })));
  });

  it('banners.edit changes content but not isActive; banners.publish flips it', async () => {
    await assertSucceeds(updateDoc(doc(as(t.env, EDITOR), 'banners/b1'), { title: { ar: 'جديد', en: 'New' }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, EDITOR), 'banners/b1'), { isActive: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(t.env, PUBLISHER), 'banners/b1'), { isActive: false, updatedAt: serverTimestamp() }));
  });

  it('a deleted banner stays hidden and cannot be edited', async () => {
    await assertSucceeds(updateDoc(doc(as(t.env, MODERATOR), 'banners/b1'), removalBy(MODERATOR, { isActive: false })));
    await assertFails(updateDoc(doc(as(t.env, MODERATOR), 'banners/b1'), { title: { ar: 'ع', en: 'again' }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, PUBLISHER), 'banners/b1'), { isActive: true, updatedAt: serverTimestamp() }));
  });

  it('news: the dashboard list needs news.view, the app list needs isPublished', async () => {
    const list = (uid: string) => getDocs(query(collection(as(t.env, uid), 'news'), orderBy('createdAt', 'desc')));
    await assertSucceeds(list(EDITOR));
    await assertFails(list('alice'));
    await assertSucceeds(getDocs(query(collection(as(t.env, 'alice'), 'news'), where('isPublished', '==', true))));
  });

  it('news: edit never publishes, publish never edits, delete unpublishes', async () => {
    await assertSucceeds(updateDoc(doc(as(t.env, EDITOR), 'news/n1'), { title: { ar: 'جديد', en: 'New' }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, EDITOR), 'news/n1'), { isPublished: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(t.env, PUBLISHER), 'news/n1'), { isPublished: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(t.env, PUBLISHER), 'news/n1'), { title: { ar: 'x', en: 'x' }, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as(t.env, EDITOR), 'news/n2'), { title: { ar: 'ع', en: 'E' }, isPublished: true, isDeleted: false }));
    await assertSucceeds(setDoc(doc(as(t.env, EDITOR), 'news/n3'), { title: { ar: 'ع', en: 'E' }, isPublished: false, isDeleted: false }));
    await assertSucceeds(updateDoc(doc(as(t.env, MODERATOR), 'news/n1'), removalBy(MODERATOR, { isPublished: false })));
  });
});
