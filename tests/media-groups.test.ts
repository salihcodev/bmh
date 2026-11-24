import { describe, expect, it } from 'vitest';

import {
  ENTITY_GROUP,
  fitWithin,
  MEDIA_ENTITIES,
  MEDIA_GROUPS,
  outputFormat,
  STAFF_UPLOAD_ENTITIES,
  uploadContext,
  uploadFolder,
  uploadPresetName,
  uploadSpec,
  uploadTags,
} from '@/services/media/groups';
import { mediaDocFields, orphanDocFields } from '@/services/media/media-record';

describe('entity groups', () => {
  it('maps every entity to a known group, and every group is used', () => {
    for (const entity of MEDIA_ENTITIES) expect(MEDIA_GROUPS).toContain(ENTITY_GROUP[entity]);
    expect(new Set(MEDIA_ENTITIES.map((e) => ENTITY_GROUP[e]))).toEqual(new Set(MEDIA_GROUPS));
  });

  it('lets staff upload only dashboard entities', () => {
    expect(STAFF_UPLOAD_ENTITIES).not.toContain('avatar');
    expect(STAFF_UPLOAD_ENTITIES).not.toContain('chat');
    for (const entity of STAFF_UPLOAD_ENTITIES) expect(MEDIA_ENTITIES).toContain(entity);
  });
});

describe('upload naming', () => {
  it('builds the nine preset names from the prefix and disables uploads without one', () => {
    expect(MEDIA_GROUPS.map((g) => uploadPresetName(g, 'bmh_'))).toEqual([
      'bmh_avatars',
      'bmh_banners',
      'bmh_support',
      'bmh_store',
      'bmh_suppliers',
      'bmh_bags',
      'bmh_chat',
      'bmh_beneficiaries',
      'bmh_misc',
    ]);
    expect(uploadPresetName('avatars', undefined)).toBeNull();
    expect(uploadPresetName('avatars', '')).toBeNull();
  });

  it('puts every upload under the root folder and the group', () => {
    expect(uploadFolder('be-my-hand', 'banners')).toBe('be-my-hand/banners');
  });

  it('tags with the app, group, entity and language', () => {
    expect(uploadTags('banner', 'ar')).toEqual(['be-my-hand', 'banners', 'banner', 'ar']);
    expect(uploadTags('avatar', null)).toEqual(['be-my-hand', 'avatars', 'avatar']);
  });

  it('builds a context string and strips its separators from values', () => {
    expect(uploadContext('avatar', 'u1', 'u1')).toBe('entity=avatar|entityId=u1|owner=u1');
    expect(uploadContext('banner', null, 'u|1=')).toBe('entity=banner|owner=u1');
  });
});

describe('resize and format', () => {
  it('never upscales, and keeps the aspect ratio when shrinking', () => {
    expect(fitWithin(400, 300, 512)).toBeNull();
    expect(fitWithin(512, 512, 512)).toBeNull();
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitWithin(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
  });

  it('ignores unknown dimensions', () => {
    expect(fitWithin(0, 0, 512)).toBeNull();
    expect(fitWithin(Number.NaN, 100, 512)).toBeNull();
  });

  it('sizes avatars small and banners large', () => {
    expect(uploadSpec('avatar').maxSide).toBeLessThan(uploadSpec('banner').maxSide);
    expect(uploadSpec('news').group).toBe('banners');
  });

  it('keeps PNG only for text and QR art', () => {
    expect(outputFormat('banner', 'image/png')).toBe('png');
    expect(outputFormat('support', 'image/PNG')).toBe('png');
    expect(outputFormat('avatar', 'image/png')).toBe('jpeg');
    expect(outputFormat('banner', 'image/webp')).toBe('jpeg');
    expect(outputFormat('banner', null)).toBe('jpeg');
  });
});

describe('media record', () => {
  const result = {
    publicId: 'be-my-hand/avatars/m1',
    secureUrl: 'https://res.cloudinary.com/rrphuvne/image/upload/v1/be-my-hand/avatars/m1.jpg',
    width: 512,
    height: 512,
    format: 'jpg',
    bytes: 4000,
    version: 1,
    folder: 'be-my-hand/avatars',
    tags: [],
    deleteToken: 'tok',
  };

  it('stores the public ID and never a URL or the delete token', () => {
    const fields = mediaDocFields({ id: 'm1', result, entity: 'avatar', entityId: 'u1', ownerId: 'u1', preset: 'bmh_avatars' });
    expect(fields).toMatchObject({
      publicId: 'be-my-hand/avatars/m1',
      entityType: 'avatar',
      entityId: 'u1',
      ownerId: 'u1',
      isDeleted: false,
      lang: null,
      label: '',
    });
    expect(JSON.stringify(fields)).not.toContain('https://');
    expect(JSON.stringify(fields)).not.toContain('tok');
    expect(fields).not.toHaveProperty('workspaceId');
  });

  it('trims the label and keeps the workspace when given', () => {
    const fields = mediaDocFields({
      id: 'm2', result, entity: 'banner', entityId: 'b1', ownerId: 'staff', workspaceId: 'ws1',
      lang: 'ar', label: `  ${'x'.repeat(200)}  `, preset: 'bmh_banners',
    });
    expect((fields.label as string).length).toBe(120);
    expect(fields).toMatchObject({ workspaceId: 'ws1', lang: 'ar' });
  });

  it('builds an orphan record', () => {
    expect(orphanDocFields({ publicId: 'a/b', mediaId: 'm1', reason: 'replaced', createdBy: 'u1' })).toEqual({
      publicId: 'a/b', mediaId: 'm1', reason: 'replaced', createdBy: 'u1',
    });
  });
});
