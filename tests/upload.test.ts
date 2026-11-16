import { describe, expect, it } from 'vitest';

import { canUndo, checkUpload, DELETE_TOKEN_TTL_MS, MAX_UPLOAD_BYTES, parseUploadResponse } from '@/services/media/upload-rules';

describe('checkUpload', () => {
  const png = { uri: 'file:///a.png', mimeType: 'image/png', fileSize: 1000, width: 1440, height: 720 };

  it('requires a configured preset', () => {
    expect(checkUpload(png, 'banner', undefined)).toEqual({ ok: false, error: 'notConfigured' });
  });

  it('accepts jpg/png/webp by mime or extension', () => {
    expect(checkUpload(png, 'banner', 'p')).toMatchObject({ ok: true, mimeType: 'image/png', warning: null });
    expect(checkUpload({ uri: 'file:///b.JPG' }, 'news', 'p')).toMatchObject({ ok: true, mimeType: 'image/jpeg' });
    expect(checkUpload({ uri: 'file:///c.webp?x=1' }, 'news', 'p')).toMatchObject({ ok: true, mimeType: 'image/webp' });
  });

  it('rejects other types even with an image extension', () => {
    expect(checkUpload({ uri: 'file:///a.heic', mimeType: 'image/heic' }, 'news', 'p')).toEqual({ ok: false, error: 'type' });
    expect(checkUpload({ uri: 'file:///a.png', mimeType: 'image/gif' }, 'news', 'p')).toEqual({ ok: false, error: 'type' });
    expect(checkUpload({ uri: 'file:///a.svg' }, 'news', 'p')).toEqual({ ok: false, error: 'type' });
  });

  it('rejects files over 5 MB', () => {
    expect(checkUpload({ ...png, fileSize: MAX_UPLOAD_BYTES + 1 }, 'news', 'p')).toEqual({ ok: false, error: 'size' });
    expect(checkUpload({ ...png, fileSize: MAX_UPLOAD_BYTES }, 'news', 'p').ok).toBe(true);
  });

  it('warns when a banner is far from 2:1', () => {
    expect(checkUpload({ ...png, width: 1000, height: 1000 }, 'banner', 'p')).toMatchObject({ ok: true, warning: 'bannerRatio' });
    expect(checkUpload({ ...png, width: 1600, height: 900 }, 'banner', 'p')).toMatchObject({ ok: true, warning: null });
    expect(checkUpload({ ...png, width: 1000, height: 1000 }, 'news', 'p')).toMatchObject({ ok: true, warning: null });
  });
});

describe('parseUploadResponse', () => {
  const body = {
    public_id: 'be-my-hand/banner/abc',
    secure_url: 'https://res.cloudinary.com/rrphuvne/image/upload/v1/be-my-hand/banner/abc.png',
    width: 1440,
    height: 720,
    format: 'png',
    bytes: 1234,
    version: 1,
    asset_folder: 'be-my-hand/banner',
    tags: ['be-my-hand', 'banner'],
    delete_token: 'tok',
  };

  it('maps the Cloudinary response', () => {
    expect(parseUploadResponse(body, 'rrphuvne')).toEqual({
      publicId: 'be-my-hand/banner/abc',
      secureUrl: body.secure_url,
      width: 1440,
      height: 720,
      format: 'png',
      bytes: 1234,
      version: 1,
      folder: 'be-my-hand/banner',
      tags: ['be-my-hand', 'banner'],
      deleteToken: 'tok',
    });
  });

  it('rejects responses for another cloud or non-images', () => {
    expect(parseUploadResponse(body, 'othercloud')).toBeNull();
    expect(parseUploadResponse({ ...body, secure_url: 'https://res.cloudinary.com/rrphuvne/video/upload/x.mp4' }, 'rrphuvne')).toBeNull();
    expect(parseUploadResponse({ error: { message: 'x' } }, 'rrphuvne')).toBeNull();
    expect(parseUploadResponse(null, 'rrphuvne')).toBeNull();
  });

  it('works without a delete token (preset setting off)', () => {
    const { delete_token: _omit, ...rest } = body;
    expect(parseUploadResponse(rest, 'rrphuvne')?.deleteToken).toBeNull();
  });
});

describe('canUndo', () => {
  it('allows undo inside the token window only', () => {
    expect(canUndo(0, DELETE_TOKEN_TTL_MS - 1, 'tok')).toBe(true);
    expect(canUndo(0, DELETE_TOKEN_TTL_MS, 'tok')).toBe(false);
    expect(canUndo(0, 1, null)).toBe(false);
  });
});
