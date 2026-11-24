import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
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
  writeBatch,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';

import { as, MODERATOR, seed, seedStaff, seedSuperAdmin, setupRulesEnv, SUPER, SUPPORT, userDoc } from './helpers';

const t = setupRulesEnv();

// Same shapes as src/services/media/media-record.ts and the writers in media-writes.ts.
const mediaFields = (ownerId: string, overrides: Record<string, unknown> = {}) => ({
  publicId: `be-my-hand/avatars/${ownerId}-1`,
  resourceType: 'image',
  preset: 'bmh_avatars',
  folder: 'be-my-hand/avatars',
  width: 512,
  height: 512,
  format: 'jpg',
  bytes: 4000,
  entityType: 'avatar',
  entityId: ownerId,
  lang: null,
  label: '',
  ownerId,
  isDeleted: false,
  ...overrides,
});

const newMedia = (ownerId: string, overrides: Record<string, unknown> = {}) => ({
  ...mediaFields(ownerId, overrides),
  createdAt: serverTimestamp(),
});

const bannerMedia = (ownerId: string, overrides: Record<string, unknown> = {}) =>
  newMedia(ownerId, {
    publicId: 'be-my-hand/banners/b1',
    preset: 'bmh_banners',
    entityType: 'banner',
    entityId: 'b1',
    lang: 'ar',
    ...overrides,
  });

const removalBy = (uid: string) => ({
  isDeleted: true,
  deletedAt: serverTimestamp(),
  deletedBy: uid,
  updatedAt: serverTimestamp(),
});

const orphan = (uid: string, mediaId: string, publicId: string, reason = 'deleted') => ({
  publicId,
  mediaId,
  reason,
  createdBy: uid,
  createdAt: serverTimestamp(),
});

beforeEach(async () => {
  await seedSuperAdmin(t.env);
  await seedStaff(t.env);
  await seed(t.env, {
    'users/alice': userDoc('Alice'),
    'users/bob': userDoc('Bob'),
    'users/frozen': userDoc('Frozen', { status: 'suspended' }),
    'media/a1': { ...mediaFields('alice'), publicId: 'be-my-hand/avatars/a1', createdAt: Timestamp.now() },
    'media/b1': { ...mediaFields('bob'), publicId: 'be-my-hand/avatars/b1', createdAt: Timestamp.now() },
    'media/banner1': { ...mediaFields(SUPER, { entityType: 'banner', entityId: 'x', lang: 'en' }), publicId: 'be-my-hand/banners/x', createdAt: Timestamp.now() },
  });
});

describe('media: create', () => {
  it('a user records their own avatar upload', async () => {
    await assertSucceeds(setDoc(doc(as(t.env, 'alice'), 'media/new1'), newMedia('alice')));
  });

  it('an avatar must belong to the uploader, for the uploader', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'media/x1'), newMedia('bob')));
    await assertFails(setDoc(doc(db, 'media/x2'), newMedia('alice', { entityId: 'bob' })));
  });

  it('a suspended user and a signed-out client cannot record uploads', async () => {
    await assertFails(setDoc(doc(as(t.env, 'frozen'), 'media/x3'), newMedia('frozen')));
    await assertFails(setDoc(doc(t.env.unauthenticatedContext().firestore(), 'media/x4'), newMedia('alice')));
  });

  it('a normal user cannot upload shared media (banner, support, store)', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'media/x5'), bannerMedia('alice')));
    await assertFails(setDoc(doc(db, 'media/x6'), newMedia('alice', { entityType: 'support', entityId: 's1' })));
  });

  it('media.upload (moderator, owner) records shared media; support does not hold it', async () => {
    await assertSucceeds(setDoc(doc(as(t.env, MODERATOR), 'media/x7'), bannerMedia(MODERATOR)));
    await assertSucceeds(setDoc(doc(as(t.env, SUPER), 'media/x8'), bannerMedia(SUPER)));
    await assertFails(setDoc(doc(as(t.env, SUPPORT), 'media/x9'), bannerMedia(SUPPORT)));
  });

  it('staff still cannot record an upload for someone else', async () => {
    await assertFails(setDoc(doc(as(t.env, MODERATOR), 'media/x10'), bannerMedia('alice')));
  });

  it('rejects stored URLs, unknown fields, unknown entities and not-deleted flags', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(db, 'media/y1'), newMedia('alice', { secureUrl: 'https://res.cloudinary.com/x/y.jpg' })));
    await assertFails(setDoc(doc(db, 'media/y2'), newMedia('alice', { entityType: 'weird' })));
    await assertFails(setDoc(doc(db, 'media/y3'), newMedia('alice', { isDeleted: true })));
    await assertFails(setDoc(doc(db, 'media/y4'), newMedia('alice', { publicId: '' })));
    await assertFails(setDoc(doc(db, 'media/y5'), { ...newMedia('alice'), createdAt: Timestamp.now() }));
  });
});

describe('media: read', () => {
  it('owners read their own record; strangers and signed-out clients do not', async () => {
    await assertSucceeds(getDoc(doc(as(t.env, 'alice'), 'media/a1')));
    await assertFails(getDoc(doc(as(t.env, 'alice'), 'media/b1')));
    await assertFails(getDoc(doc(t.env.unauthenticatedContext().firestore(), 'media/a1')));
  });

  it('an owner lists only their own records', async () => {
    const db = as(t.env, 'alice');
    await assertSucceeds(getDocs(query(collection(db, 'media'), where('ownerId', '==', 'alice'))));
    await assertFails(getDocs(collection(db, 'media')));
  });

  it('media.view reads the whole library; support has no such key', async () => {
    await assertSucceeds(getDocs(collection(as(t.env, MODERATOR), 'media')));
    await assertSucceeds(getDoc(doc(as(t.env, SUPER), 'media/a1')));
    await assertFails(getDocs(collection(as(t.env, SUPPORT), 'media')));
  });
});

describe('media: update and delete', () => {
  it('an owner soft-deletes their own record, stamped with themself', async () => {
    const db = as(t.env, 'alice');
    await assertFails(updateDoc(doc(db, 'media/a1'), removalBy('bob')));
    await assertSucceeds(updateDoc(doc(db, 'media/a1'), removalBy('alice')));
  });

  it('a stranger cannot delete it, and a deleted record cannot be deleted twice', async () => {
    await assertFails(updateDoc(doc(as(t.env, 'bob'), 'media/a1'), removalBy('bob')));
    await assertSucceeds(updateDoc(doc(as(t.env, 'alice'), 'media/a1'), removalBy('alice')));
    await assertFails(updateDoc(doc(as(t.env, 'alice'), 'media/a1'), removalBy('alice')));
  });

  it('media.delete (moderator, owner) removes anyone\'s record; support cannot', async () => {
    await assertFails(updateDoc(doc(as(t.env, SUPPORT), 'media/a1'), removalBy(SUPPORT)));
    await assertSucceeds(updateDoc(doc(as(t.env, MODERATOR), 'media/a1'), removalBy(MODERATOR)));
    await assertSucceeds(updateDoc(doc(as(t.env, SUPER), 'media/b1'), removalBy(SUPER)));
  });

  it('the file reference never changes', async () => {
    const db = as(t.env, 'alice');
    await assertFails(updateDoc(doc(db, 'media/a1'), { publicId: 'be-my-hand/avatars/other' }));
    await assertFails(updateDoc(doc(db, 'media/a1'), { ownerId: 'bob' }));
    await assertFails(updateDoc(doc(db, 'media/a1'), { entityType: 'banner' }));
  });

  it('media.upload edits the label and language of shared media only', async () => {
    const db = as(t.env, MODERATOR);
    await assertSucceeds(updateDoc(doc(db, 'media/banner1'), { label: 'Spring', lang: 'ar', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'media/banner1'), { bytes: 1 }));
    await assertFails(updateDoc(doc(as(t.env, 'alice'), 'media/banner1'), { label: 'mine' }));
    await assertFails(updateDoc(doc(as(t.env, SUPPORT), 'media/banner1'), { label: 'x' }));
  });

  it('is never hard-deleted', async () => {
    await assertFails(deleteDoc(doc(as(t.env, 'alice'), 'media/a1')));
    await assertFails(deleteDoc(doc(as(t.env, SUPER), 'media/a1')));
  });
});

describe('mediaOrphans', () => {
  it('is written in the batch that removes the media record', async () => {
    const db = as(t.env, 'alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'media/a1'), removalBy('alice'));
    batch.set(doc(collection(db, 'mediaOrphans')), orphan('alice', 'a1', 'be-my-hand/avatars/a1', 'replaced'));
    await assertSucceeds(batch.commit());
  });

  it('cannot be written for a record that is still in use', async () => {
    const db = as(t.env, 'alice');
    await assertFails(setDoc(doc(collection(db, 'mediaOrphans')), orphan('alice', 'a1', 'be-my-hand/avatars/a1')));
  });

  it('must name the same file and the same actor as the removal', async () => {
    const db = as(t.env, 'alice');
    const wrongFile = writeBatch(db);
    wrongFile.update(doc(db, 'media/a1'), removalBy('alice'));
    wrongFile.set(doc(collection(db, 'mediaOrphans')), orphan('alice', 'a1', 'be-my-hand/avatars/someone-else'));
    await assertFails(wrongFile.commit());

    const wrongActor = writeBatch(db);
    wrongActor.update(doc(db, 'media/a1'), removalBy('alice'));
    wrongActor.set(doc(collection(db, 'mediaOrphans')), orphan('bob', 'a1', 'be-my-hand/avatars/a1'));
    await assertFails(wrongActor.commit());

    const otherUser = as(t.env, 'bob');
    await assertFails(setDoc(doc(collection(otherUser, 'mediaOrphans')), orphan('bob', 'a1', 'be-my-hand/avatars/a1')));
  });

  it('rejects unknown reasons and extra fields', async () => {
    const db = as(t.env, 'alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'media/a1'), removalBy('alice'));
    batch.set(doc(collection(db, 'mediaOrphans')), { ...orphan('alice', 'a1', 'be-my-hand/avatars/a1', 'because'), extra: 1 });
    await assertFails(batch.commit());
  });

  it('is read by media.view only, and never edited', async () => {
    await seed(t.env, { 'mediaOrphans/o1': { publicId: 'x', mediaId: 'a1', reason: 'deleted', createdBy: 'alice', createdAt: Timestamp.now() } });
    await assertSucceeds(getDoc(doc(as(t.env, MODERATOR), 'mediaOrphans/o1')));
    await assertFails(getDoc(doc(as(t.env, 'alice'), 'mediaOrphans/o1')));
    await assertFails(getDoc(doc(as(t.env, SUPPORT), 'mediaOrphans/o1')));
    await assertFails(updateDoc(doc(as(t.env, SUPER), 'mediaOrphans/o1'), { reason: 'replaced' }));
    await assertFails(deleteDoc(doc(as(t.env, SUPER), 'mediaOrphans/o1')));
  });
});

describe('avatar replacement batch (same shape as media-writes.ts)', () => {
  it('records the new file, points the profile at it, and orphans the old one', async () => {
    const db = as(t.env, 'alice');
    await seed(t.env, { 'users/alice': { ...userDoc('Alice'), avatarPublicId: 'be-my-hand/avatars/a1' } });
    const batch = writeBatch(db);
    batch.set(doc(db, 'media/a2'), newMedia('alice', { publicId: 'be-my-hand/avatars/a2' }));
    batch.update(doc(db, 'users/alice'), { avatarPublicId: 'be-my-hand/avatars/a2', updatedAt: serverTimestamp() });
    batch.update(doc(db, 'media/a1'), removalBy('alice'));
    batch.set(doc(collection(db, 'mediaOrphans')), orphan('alice', 'a1', 'be-my-hand/avatars/a1', 'replaced'));
    await assertSucceeds(batch.commit());
  });

  it('a user cannot point another profile at a file', async () => {
    const db = as(t.env, 'alice');
    await assertFails(updateDoc(doc(db, 'users/bob'), { avatarPublicId: 'be-my-hand/avatars/a1', updatedAt: serverTimestamp() }));
  });
});
