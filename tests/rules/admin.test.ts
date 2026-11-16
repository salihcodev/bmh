import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
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
