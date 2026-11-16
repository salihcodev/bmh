import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getCountFromServer,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';

import { as, MEMBER, OUTSIDER, seed, seedSuperAdmin, seedWorkspace, SUPER, userDoc, setupRulesEnv, WID } from './helpers';

const t = setupRulesEnv();

const MARKETING = ['banners/b1', 'marketingCards/c1', 'platformStats/global', 'appConfig/support', 'appConfig/general'];

beforeEach(async () => {
  await seed(t.env, {
    'users/alice': userDoc('Alice'),
    'banners/b1': { order: 1, isActive: true, title: { ar: 'أ', en: 'A' }, imagePublicId: { ar: null, en: null } },
    'marketingCards/c1': { order: 1, isActive: true, type: 'tip', title: { ar: 'أ', en: 'A' } },
    'platformStats/global': { usersCount: 10, workspacesCount: 2, membersCount: 5, sessionsCount: 3 },
    'appConfig/support': { isEnabled: true, instapayLink: 'REPLACE_WITH_INSTAPAY_LINK' },
    'appConfig/general': { minVersion: '1.0.0' },
    'news/n1': { isPublished: true, isPinned: false, publishedAt: Timestamp.now(), title: { ar: 'خبر', en: 'News' } },
    'news/draft': { isPublished: false, isPinned: false, publishedAt: Timestamp.now(), title: { ar: 'مسودة', en: 'Draft' } },
    'mediaAssets/m1': { publicId: 'x', isArchived: false, kind: 'banner', uploadedBy: SUPER, createdAt: Timestamp.now() },
    'adminAuditLog/l1': { actorId: SUPER, action: 'x', targetType: 'banner', targetId: 'b1', createdAt: Timestamp.now() },
  });
});

describe('marketing collections', () => {
  it.each(MARKETING)('signed-in users read %s; anonymous cannot', async (path) => {
    await assertSucceeds(getDoc(doc(as(t.env, 'alice'), path)));
    await assertFails(getDoc(doc(t.env.unauthenticatedContext().firestore(), path)));
  });

  it.each(MARKETING)('normal users cannot write %s', async (path) => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, path), { hacked: true }, { merge: true }));
    await assertFails(deleteDoc(doc(db, path)));
  });

  it.each(MARKETING)('super admin writes %s', async (path) => {
    await seedSuperAdmin(t.env);
    await assertSucceeds(setDoc(doc(as(t.env, SUPER), path), { updatedAt: serverTimestamp() }, { merge: true }));
  });

  it('news: users read published only (query must filter), super admin reads drafts', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'news/n1')));
    await assertFails(getDoc(doc(db, 'news/draft')));
    await assertSucceeds(getDocs(query(collection(db, 'news'), where('isPublished', '==', true))));
    await assertFails(getDocs(collection(db, 'news')));
    await assertFails(setDoc(doc(db, 'news/n2'), { isPublished: true }));
    await seedSuperAdmin(t.env);
    await assertSucceeds(getDoc(doc(as(t.env, SUPER), 'news/draft')));
    await assertSucceeds(setDoc(doc(as(t.env, SUPER), 'news/n2'), { isPublished: false }));
  });

  it('a suspended super admin cannot write marketing content', async () => {
    await seedSuperAdmin(t.env, 'suspended');
    await assertFails(setDoc(doc(as(t.env, SUPER), 'banners/b1'), { isActive: false }, { merge: true }));
  });

  it('platformAdmins is not a privilege path', async () => {
    await seed(t.env, { 'platformAdmins/alice': { granted: true } });
    await assertFails(getDoc(doc(as(t.env, 'alice'), 'platformAdmins/alice')));
    await assertFails(setDoc(doc(as(t.env, 'alice'), 'banners/b1'), { isActive: false }, { merge: true }));
  });
});

describe('mediaAssets', () => {
  const asset = (uploadedBy: string) => ({
    publicId: 'be-my-hand/abc', secureUrl: 'https://res.cloudinary.com/rrphuvne/image/upload/abc.png', width: 1440,
    height: 720, format: 'png', bytes: 1000, version: 1, folder: 'be-my-hand', tags: ['banner'], kind: 'banner',
    lang: 'ar', isArchived: false, uploadedBy, createdAt: serverTimestamp(), clientAt: Timestamp.now(),
  });

  it('normal users cannot read or write', async () => {
    const db = as(t.env, 'alice');
    await assertFails(getDoc(doc(db, 'mediaAssets/m1')));
    await assertFails(getDocs(collection(db, 'mediaAssets')));
    await assertFails(setDoc(doc(db, 'mediaAssets/m2'), asset('alice')));
  });

  it('super admin creates own uploads, archives, never deletes', async () => {
    await seedSuperAdmin(t.env);
    const db = as(t.env, SUPER);
    await assertSucceeds(setDoc(doc(db, 'mediaAssets/m2'), asset(SUPER)));
    await assertFails(setDoc(doc(db, 'mediaAssets/m3'), asset('alice')));
    await assertSucceeds(updateDoc(doc(db, 'mediaAssets/m1'), { isArchived: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'mediaAssets/m1'), { publicId: 'other' }));
    await assertFails(deleteDoc(doc(db, 'mediaAssets/m1')));
  });
});

describe('adminAuditLog', () => {
  const entry = (actorId: string) => ({
    actorId, action: 'banner_updated', targetType: 'banner', targetId: 'b1', metadata: {},
    createdAt: serverTimestamp(), clientAt: Timestamp.now(),
  });

  it('is create-only for the super admin acting as themself', async () => {
    await seedSuperAdmin(t.env);
    const db = as(t.env, SUPER);
    await assertSucceeds(addDoc(collection(db, 'adminAuditLog'), entry(SUPER)));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), entry('alice')));
    await assertSucceeds(getDocs(collection(db, 'adminAuditLog')));
    await assertFails(updateDoc(doc(db, 'adminAuditLog/l1'), { action: 'changed' }));
    await assertFails(deleteDoc(doc(db, 'adminAuditLog/l1')));
  });

  it('normal users cannot read or write it', async () => {
    const db = as(t.env, 'alice');
    await assertFails(getDoc(doc(db, 'adminAuditLog/l1')));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), entry('alice')));
  });
});

describe('privacy boundary: super admin vs tenant data', () => {
  beforeEach(async () => {
    await seedWorkspace(t.env);
    await seedSuperAdmin(t.env);
    await seed(t.env, {
      [`workspaces/${WID}/beneficiaries/b1`]: { workspaceId: WID, fullName: 'Person', isArchived: false },
      [`workspaces/${WID}/beneficiaries/b1/history/h1`]: { workspaceId: WID, beneficiaryId: 'b1', type: 'x', createdAt: Timestamp.now() },
      [`workspaces/${WID}/beneficiaries/b1/assistanceRecords/r1`]: { workspaceId: WID, beneficiaryId: 'b1' },
      [`workspaces/${WID}/sessions/s1`]: { workspaceId: WID, status: 'active', operatorId: MEMBER },
      [`workspaces/${WID}/sessions/s1/items/b1`]: { beneficiaryId: 'b1', status: 'pending' },
    });
  });

  it('reads workspace metadata and memberships', async () => {
    const db = as(t.env, SUPER);
    await assertSucceeds(getDoc(doc(db, `workspaces/${WID}`)));
    await assertSucceeds(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', MEMBER))));
  });

  it('cannot read beneficiaries, history, assistance or sessions of another workspace', async () => {
    const db = as(t.env, SUPER);
    await assertFails(getDoc(doc(db, `workspaces/${WID}/beneficiaries/b1`)));
    await assertFails(getDocs(collection(db, `workspaces/${WID}/beneficiaries`)));
    await assertFails(getDoc(doc(db, `workspaces/${WID}/beneficiaries/b1/history/h1`)));
    await assertFails(getDoc(doc(db, `workspaces/${WID}/beneficiaries/b1/assistanceRecords/r1`)));
    await assertFails(getDoc(doc(db, `workspaces/${WID}/sessions/s1`)));
    await assertFails(getDocs(collection(db, `workspaces/${WID}/sessions/s1/items`)));
    await assertFails(getDocs(query(collectionGroup(db, 'history'), where('workspaceId', '==', WID))));
  });

  it('cannot write tenant data or workspace metadata', async () => {
    const db = as(t.env, SUPER);
    await assertFails(updateDoc(doc(db, `workspaces/${WID}`), { name: 'Taken over' }));
    await assertFails(setDoc(doc(db, `workspaces/${WID}/members/${SUPER}`), { userId: SUPER, role: 'owner' }));
  });

  it('outsiders still cannot read workspace metadata', async () => {
    await assertFails(getDoc(doc(as(t.env, OUTSIDER), `workspaces/${WID}`)));
  });
});

// Same document shapes as src/services/admin/admin-writes.ts and the counts in use-admin.ts.
describe('Manage batches and counts', () => {
  const auditEntry = (action: string, targetType: string, targetId: string) => ({
    actorId: SUPER, actorName: 'Super', action, targetType, targetId, metadata: {},
    createdAt: serverTimestamp(), clientAt: Timestamp.now(),
  });

  beforeEach(async () => {
    await seedSuperAdmin(t.env);
  });

  it('banner save + audit in one batch', async () => {
    const db = as(t.env, SUPER);
    const batch = writeBatch(db);
    batch.set(doc(db, 'banners/new1'), {
      title: { ar: 'ع', en: 'E' }, subtitle: { ar: '', en: '' }, imagePublicId: { ar: 'abc', en: null },
      cta: { type: 'route', target: '/news', label: { ar: 'اقرأ', en: 'Read' } }, order: 2, isActive: false,
      updatedAt: serverTimestamp(), createdAt: serverTimestamp(),
    }, { merge: true });
    batch.set(doc(collection(db, 'adminAuditLog')), auditEntry('banner_created', 'banner', 'new1'));
    await assertSucceeds(batch.commit());
  });

  it('media record + audit, then archive + audit', async () => {
    const db = as(t.env, SUPER);
    const create = writeBatch(db);
    create.set(doc(db, 'mediaAssets/up1'), {
      publicId: 'be-my-hand/banner/x', secureUrl: 'https://res.cloudinary.com/rrphuvne/image/upload/v1/x.png', width: 1440,
      height: 720, format: 'png', bytes: 10, version: 1, folder: 'be-my-hand/banner', tags: ['be-my-hand'], kind: 'banner',
      lang: 'ar', label: '', isArchived: false, uploadedBy: SUPER, createdAt: serverTimestamp(), clientAt: Timestamp.now(),
    });
    create.set(doc(collection(db, 'adminAuditLog')), auditEntry('media_uploaded', 'media', 'up1'));
    await assertSucceeds(create.commit());
    const archive = writeBatch(db);
    archive.update(doc(db, 'mediaAssets/up1'), { isArchived: true, updatedAt: serverTimestamp() });
    archive.set(doc(collection(db, 'adminAuditLog')), auditEntry('media_undone', 'media', 'up1'));
    await assertSucceeds(archive.commit());
  });

  it('user suspend + audit; the whole batch fails for another super admin', async () => {
    await seed(t.env, { 'users/other': userDoc('Other', { globalRole: 'superadmin' }) });
    const db = as(t.env, SUPER);
    const ok = writeBatch(db);
    ok.update(doc(db, 'users/alice'), { status: 'suspended', updatedAt: serverTimestamp() });
    ok.set(doc(collection(db, 'adminAuditLog')), auditEntry('user_suspended', 'user', 'alice'));
    await assertSucceeds(ok.commit());
    const denied = writeBatch(db);
    denied.update(doc(db, 'users/other'), { status: 'suspended', updatedAt: serverTimestamp() });
    denied.set(doc(collection(db, 'adminAuditLog')), auditEntry('user_suspended', 'user', 'other'));
    await assertFails(denied.commit());
  });

  it('overview counts are allowed for the super admin only', async () => {
    const counts = (db: ReturnType<typeof as>) => [
      collection(db, 'users'),
      query(collection(db, 'users'), where('status', '==', 'suspended')),
      collection(db, 'workspaces'),
      collection(db, 'banners'),
      query(collection(db, 'mediaAssets'), where('isArchived', '==', false)),
    ];
    for (const q of counts(as(t.env, SUPER))) await assertSucceeds(getCountFromServer(q));
    const alice = as(t.env, 'alice');
    await assertFails(getCountFromServer(collection(alice, 'users')));
    await assertFails(getCountFromServer(collection(alice, 'workspaces')));
    await assertFails(getCountFromServer(collection(alice, 'mediaAssets')));
  });
});
