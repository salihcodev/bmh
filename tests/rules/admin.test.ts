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

import {
  as,
  MEMBER,
  MODERATOR,
  OUTSIDER,
  seed,
  seedStaff,
  seedSuperAdmin,
  seedWorkspace,
  setupRulesEnv,
  SUPER,
  SUPPORT,
  userDoc,
  WID,
} from './helpers';

const t = setupRulesEnv();

const MARKETING = ['banners/b1', 'marketingCards/c1', 'platformStats/global', 'appConfig/support', 'appConfig/general', 'appConfig/home'];

beforeEach(async () => {
  await seed(t.env, {
    'users/alice': userDoc('Alice'),
    'banners/b1': { order: 1, isActive: true, title: { ar: 'أ', en: 'A' }, imagePublicId: { ar: null, en: null } },
    'marketingCards/c1': { order: 1, isActive: true, type: 'tip', title: { ar: 'أ', en: 'A' } },
    'platformStats/global': { usersCount: 10, workspacesCount: 2, membersCount: 5, sessionsCount: 3 },
    'appConfig/support': { developerName: 'Dev', developerWebsite: 'https://example.dev' },
    'appConfig/general': { minVersion: '1.0.0' },
    'appConfig/home': { sections: [{ key: 'banners', visible: true, order: 0, count: 4 }] },
    'news/n1': { isPublished: true, isPinned: false, publishedAt: Timestamp.now(), title: { ar: 'خبر', en: 'News' } },
    'news/draft': { isPublished: false, isPinned: false, publishedAt: Timestamp.now(), title: { ar: 'مسودة', en: 'Draft' } },
    'media/m1': { publicId: 'x', isDeleted: false, entityType: 'banner', ownerId: SUPER, createdAt: Timestamp.now() },
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

  it.each(MARKETING)('the owner writes %s', async (path) => {
    await seedSuperAdmin(t.env);
    await assertSucceeds(setDoc(doc(as(t.env, SUPER), path), { updatedAt: serverTimestamp() }, { merge: true }));
  });

  it('news: users read published only (query must filter), the owner reads drafts', async () => {
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

  it('home layout: a moderator can write it, support cannot', async () => {
    await seedStaff(t.env);
    const next = { sections: [{ key: 'news', visible: true, order: 0, count: 3 }], updatedAt: serverTimestamp() };
    await assertFails(setDoc(doc(as(t.env, SUPPORT), 'appConfig/home'), next, { merge: true }));
    await assertSucceeds(setDoc(doc(as(t.env, MODERATOR), 'appConfig/home'), next, { merge: true }));
  });

  it('a suspended owner cannot write marketing content', async () => {
    await seedSuperAdmin(t.env, 'suspended');
    await assertFails(setDoc(doc(as(t.env, SUPER), 'banners/b1'), { isActive: false }, { merge: true }));
  });

  it('platformAdmins is not a privilege path', async () => {
    await seed(t.env, { 'platformAdmins/alice': { granted: true } });
    await assertFails(getDoc(doc(as(t.env, 'alice'), 'platformAdmins/alice')));
    await assertFails(setDoc(doc(as(t.env, 'alice'), 'banners/b1'), { isActive: false }, { merge: true }));
  });
});

describe('adminAuditLog', () => {
  const entry = (actorId: string) => ({
    actorId, action: 'banner_updated', targetType: 'banner', targetId: 'b1', metadata: {},
    createdAt: serverTimestamp(), clientAt: Timestamp.now(),
  });

  it('is create-only for staff acting as themself', async () => {
    await seedSuperAdmin(t.env);
    const db = as(t.env, SUPER);
    await assertSucceeds(addDoc(collection(db, 'adminAuditLog'), entry(SUPER)));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), entry('alice')));
    await assertSucceeds(getDocs(collection(db, 'adminAuditLog')));
    await assertFails(updateDoc(doc(db, 'adminAuditLog/l1'), { action: 'changed' }));
    await assertFails(deleteDoc(doc(db, 'adminAuditLog/l1')));
  });

  it('accepts the v2 shape: avatar, icon, target name, workspace, summary and device', async () => {
    await seedSuperAdmin(t.env);
    const db = as(t.env, SUPER);
    await assertSucceeds(
      addDoc(collection(db, 'adminAuditLog'), {
        ...entry(SUPER),
        actorName: 'Super',
        actorAvatarPublicId: 'be-my-hand/avatars/x',
        icon: 'user',
        targetName: 'Alice',
        workspaceId: 'ws1',
        summary: { before: { status: 'active' }, after: { status: 'suspended' } },
        platform: 'ios',
        appVersion: '1.2.3',
      }),
    );
  });

  it('rejects unknown fields, a bad platform and a malformed summary', async () => {
    await seedSuperAdmin(t.env);
    const db = as(t.env, SUPER);
    await assertFails(addDoc(collection(db, 'adminAuditLog'), { ...entry(SUPER), note: 'free text' }));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), { ...entry(SUPER), platform: 'toaster' }));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), { ...entry(SUPER), summary: 'changed it' }));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), { ...entry(SUPER), summary: { other: {} } }));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), { ...entry(SUPER), targetName: 'x'.repeat(121) }));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), { ...entry(SUPER), createdAt: Timestamp.now() }));
  });

  it('normal users cannot read or write it', async () => {
    const db = as(t.env, 'alice');
    await assertFails(getDoc(doc(db, 'adminAuditLog/l1')));
    await assertFails(addDoc(collection(db, 'adminAuditLog'), entry('alice')));
  });
});

describe('privacy boundary: staff vs tenant data', () => {
  beforeEach(async () => {
    await seedWorkspace(t.env);
    await seedSuperAdmin(t.env);
    await seedStaff(t.env);
    await seed(t.env, {
      [`workspaces/${WID}/beneficiaries/b1`]: { workspaceId: WID, fullName: 'Person', isArchived: false },
      [`workspaces/${WID}/beneficiaries/b1/history/h1`]: { workspaceId: WID, beneficiaryId: 'b1', type: 'x', createdAt: Timestamp.now() },
      [`workspaces/${WID}/beneficiaries/b1/assistanceRecords/r1`]: { workspaceId: WID, beneficiaryId: 'b1' },
      [`workspaces/${WID}/sessions/s1`]: { workspaceId: WID, status: 'active', operatorId: MEMBER },
      [`workspaces/${WID}/sessions/s1/items/b1`]: { beneficiaryId: 'b1', status: 'pending' },
    });
  });

  const tenantReads = (db: ReturnType<typeof as>) => [
    getDoc(doc(db, `workspaces/${WID}/beneficiaries/b1`)),
    getDocs(collection(db, `workspaces/${WID}/beneficiaries`)),
    getDoc(doc(db, `workspaces/${WID}/beneficiaries/b1/history/h1`)),
    getDoc(doc(db, `workspaces/${WID}/beneficiaries/b1/assistanceRecords/r1`)),
    getDoc(doc(db, `workspaces/${WID}/sessions/s1`)),
    getDocs(collection(db, `workspaces/${WID}/sessions/s1/items`)),
    getDocs(query(collectionGroup(db, 'history'), where('workspaceId', '==', WID))),
  ];

  it('workspaces.view reads workspace metadata and memberships', async () => {
    for (const uid of [SUPER, SUPPORT]) {
      const db = as(t.env, uid);
      await assertSucceeds(getDoc(doc(db, `workspaces/${WID}`)));
      await assertSucceeds(getDocs(query(collectionGroup(db, 'members'), where('userId', '==', MEMBER))));
    }
  });

  it('only workspaces.data-view reads tenant records; support and moderator cannot', async () => {
    for (const read of tenantReads(as(t.env, SUPER))) await assertSucceeds(read);
    for (const uid of [SUPPORT, MODERATOR]) {
      for (const read of tenantReads(as(t.env, uid))) await assertFails(read);
    }
  });

  it('data-view is read-only: no tenant writes, no membership', async () => {
    const db = as(t.env, SUPER);
    await assertFails(updateDoc(doc(db, `workspaces/${WID}/beneficiaries/b1`), { fullName: 'Changed' }));
    await assertFails(updateDoc(doc(db, `workspaces/${WID}/sessions/s1`), { status: 'ended' }));
    await assertFails(setDoc(doc(db, `workspaces/${WID}/members/${SUPER}`), { userId: SUPER, roleId: 'admin', status: 'active' }));
  });

  it('workspace metadata edits need workspaces.edit', async () => {
    await assertFails(updateDoc(doc(as(t.env, SUPPORT), `workspaces/${WID}`), { name: 'Taken over' }));
    await assertSucceeds(updateDoc(doc(as(t.env, SUPER), `workspaces/${WID}`), { name: 'Renamed by staff' }));
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

  it('media record + audit, then remove + orphan + audit', async () => {
    const db = as(t.env, SUPER);
    const create = writeBatch(db);
    create.set(doc(db, 'media/up1'), {
      publicId: 'be-my-hand/banners/x', resourceType: 'image', preset: 'bmh_banners', folder: 'be-my-hand/banners',
      width: 1440, height: 720, format: 'png', bytes: 10, entityType: 'banner', entityId: 'up1', lang: 'ar',
      label: '', ownerId: SUPER, isDeleted: false, createdAt: serverTimestamp(),
    });
    create.set(doc(collection(db, 'adminAuditLog')), auditEntry('media_uploaded', 'media', 'up1'));
    await assertSucceeds(create.commit());
    const remove = writeBatch(db);
    remove.update(doc(db, 'media/up1'), { isDeleted: true, deletedAt: serverTimestamp(), deletedBy: SUPER, updatedAt: serverTimestamp() });
    remove.set(doc(collection(db, 'mediaOrphans')), {
      publicId: 'be-my-hand/banners/x', mediaId: 'up1', reason: 'deleted', createdBy: SUPER, createdAt: serverTimestamp(),
    });
    remove.set(doc(collection(db, 'adminAuditLog')), auditEntry('media_deleted', 'media', 'up1'));
    await assertSucceeds(remove.commit());
  });

  it('user suspend + audit; the whole batch fails for the platform owner', async () => {
    await seed(t.env, { 'users/other': userDoc('Other', { userType: 'owner' }) });
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

  it('overview counts follow the system keys', async () => {
    const counts = (db: ReturnType<typeof as>) => [
      collection(db, 'users'),
      query(collection(db, 'users'), where('status', '==', 'suspended')),
      collection(db, 'workspaces'),
      collection(db, 'banners'),
      query(collection(db, 'media'), where('isDeleted', '==', false)),
    ];
    for (const q of counts(as(t.env, SUPER))) await assertSucceeds(getCountFromServer(q));
    const alice = as(t.env, 'alice');
    await assertFails(getCountFromServer(collection(alice, 'users')));
    await assertFails(getCountFromServer(collection(alice, 'workspaces')));
    await assertFails(getCountFromServer(collection(alice, 'media')));
  });
});
