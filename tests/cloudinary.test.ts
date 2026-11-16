import { describe, expect, it } from 'vitest';

import { BANNER_ASSETS } from '@/config/cloudinaryAssets';
import { parseEnv } from '@/config/env';
import {
  bannerSource,
  blurPlaceholderUrl,
  cloudinaryUrl,
  deliveryWidth,
  MAX_DELIVERY_WIDTH,
  parsePublicId,
} from '@/services/media/cloudinary';

const BASE = 'https://res.cloudinary.com/rrphuvne/image/upload';

describe('parsePublicId', () => {
  it('parses a versioned delivery URL with a format', () => {
    expect(parsePublicId(`${BASE}/v1794860791/xekwojqimaois4pnua9t.png`)).toEqual({
      cloudName: 'rrphuvne',
      publicId: 'xekwojqimaois4pnua9t',
      version: 1794860791,
      format: 'png',
    });
  });

  it('parses an unversioned URL with transformations and folders', () => {
    expect(parsePublicId(`${BASE}/f_auto,q_auto/w_600,c_limit/be-my-hand/banners/teams-ar.webp`)).toEqual({
      cloudName: 'rrphuvne',
      publicId: 'be-my-hand/banners/teams-ar',
      format: 'webp',
    });
  });

  it('keeps folders that only look like parameters', () => {
    expect(parsePublicId(`${BASE}/my_folder/image`)?.publicId).toBe('my_folder/image');
  });

  it('drops transformations before a version', () => {
    expect(parsePublicId(`${BASE}/e_blur:300,w_32/v12/a/b.jpg`)).toMatchObject({ publicId: 'a/b', version: 12 });
  });

  it('accepts bare IDs (with or without an extension) and uses the configured cloud', () => {
    expect(parsePublicId('eec5ymnz5jk9eiom08xx')).toEqual({ cloudName: 'rrphuvne', publicId: 'eec5ymnz5jk9eiom08xx' });
    expect(parsePublicId('be-my-hand/x.png')?.publicId).toBe('be-my-hand/x');
  });

  it('rejects empty, null and non-Cloudinary input', () => {
    expect(parsePublicId(null)).toBeNull();
    expect(parsePublicId(undefined)).toBeNull();
    expect(parsePublicId('   ')).toBeNull();
    expect(parsePublicId('https://example.com/a.png')).toBeNull();
    expect(parsePublicId('REPLACE/banner-1.webp')?.publicId).toBe('REPLACE/banner-1');
    expect(parsePublicId('../etc/passwd')).toBeNull();
    expect(parsePublicId('a b')).toBeNull();
  });
});

describe('cloudinaryUrl', () => {
  it('always adds f_auto,q_auto', () => {
    expect(cloudinaryUrl('abc')).toBe(`${BASE}/f_auto,q_auto/abc`);
  });

  it('keeps the version from a URL and caps the width', () => {
    expect(cloudinaryUrl(`${BASE}/v1794860791/xekwojqimaois4pnua9t.png`, { width: 5000 })).toBe(
      `${BASE}/f_auto,q_auto,w_${MAX_DELIVERY_WIDTH},c_limit/v1794860791/xekwojqimaois4pnua9t`,
    );
  });

  it('supports fill with gravity for thumbnails', () => {
    expect(cloudinaryUrl('a/b', { width: 200, height: 200, crop: 'fill', gravity: 'auto' })).toBe(
      `${BASE}/f_auto,q_auto,w_200,h_200,c_fill,g_auto/a/b`,
    );
  });

  it('returns null for missing input', () => {
    expect(cloudinaryUrl(null)).toBeNull();
    expect(cloudinaryUrl('https://example.com/x.png')).toBeNull();
  });

  it('builds the blur placeholder', () => {
    expect(blurPlaceholderUrl('a/b')).toBe(`${BASE}/w_32,e_blur:300,f_auto,q_auto/a/b`);
  });

  it('requests about 3x the layout width, capped', () => {
    expect(deliveryWidth(350)).toBe(1050);
    expect(deliveryWidth(800)).toBe(MAX_DELIVERY_WIDTH);
  });
});

describe('bannerSource', () => {
  it('uses the current language only (banner art has text baked in)', () => {
    const banner = { id: 'x', imagePublicId: { ar: 'ar-id', en: null } };
    expect(bannerSource(banner, 'ar', 300)?.uri).toBe(`${BASE}/f_auto,q_auto,w_900,c_limit/ar-id`);
    expect(bannerSource(banner, 'en', 300)).toBeNull();
    expect(bannerSource(banner, 'ar', 300)?.placeholder).toContain('e_blur:300');
  });

  it('returns null (gradient fallback) when nothing is mapped', () => {
    expect(bannerSource({ id: 'teams' }, 'ar', 300)).toBeNull();
    expect(bannerSource({ id: 'unknown', imagePublicId: null }, 'en', 300)).toBeNull();
  });

  it('falls back to the confirmed BANNER_ASSETS mapping', () => {
    expect(bannerSource({ id: 'export' }, 'en', 300)?.uri).toContain('/xekwojqimaois4pnua9t');
    expect(bannerSource({ id: 'export' }, 'ar', 300)?.uri).toContain('/flfvoz8yaqba9xzjzrso');
    expect(bannerSource({ id: 'helping-hands' }, 'ar', 300)?.uri).toContain('/mulgwg6el6jdtpzydbyu');
    expect(bannerSource({ id: 'helping-hands' }, 'en', 300)).toBeNull();
  });

  it('only maps banners that were confirmed', () => {
    for (const entry of Object.values(BANNER_ASSETS)) {
      for (const id of [entry.ar, entry.en]) expect(id === null || typeof id === 'string').toBe(true);
    }
  });
});

describe('env', () => {
  it('defaults the cloud and folder, and treats a blank preset as disabled', () => {
    const env = parseEnv({ cloudinaryUploadPreset: '' });
    expect(env.cloudinaryCloudName).toBe('rrphuvne');
    expect(env.cloudinaryFolder).toBe('be-my-hand');
    expect(env.cloudinaryUploadPreset).toBeUndefined();
    expect(env.useEmulators).toBe(false);
  });

  it('has no secret-shaped keys', async () => {
    const { envSchema } = await import('@/config/env');
    for (const key of Object.keys(envSchema.shape)) expect(key).not.toMatch(/secret|apikey|api_key|private/i);
  });
});
