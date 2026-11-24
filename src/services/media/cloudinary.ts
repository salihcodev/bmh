import { BANNER_ASSETS, type LocalizedPublicId } from '@/config/cloudinaryAssets';
import { env } from '@/config/env';

// The only module that builds Cloudinary delivery URLs (scripts/check-tokens.mjs allows it).
// Delivery always uses f_auto,q_auto so each device gets the best format and quality.

const HOST = 'https://res.cloudinary.com';
export const MAX_DELIVERY_WIDTH = 1440;
const BLUR = 'w_32,e_blur:300';

export type ParsedAsset = { cloudName: string; publicId: string; version?: number; format?: string };

export type DeliveryOptions = {
  /** Target pixel width (already multiplied for the screen density). */
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit' | 'thumb';
  gravity?: 'auto' | 'center' | 'face';
  version?: number;
  format?: string;
  /** `dpr_auto`: lets Cloudinary pick the density where the client sends hints. A no-op elsewhere. */
  dpr?: 'auto';
};

const BARE_ID = /^[\w-]+(?:\/[\w-]+)*$/;
// .../<cloud>/image/upload/[transformations/]*[v123/]<public_id>[.ext]
const DELIVERY_URL = /^https?:\/\/res\.cloudinary\.com\/([\w-]+)\/image\/upload\/(.+)$/;
const TRANSFORMATION_KEYS = new Set([
  'a', 'ar', 'b', 'bo', 'c', 'co', 'cs', 'd', 'dpr', 'du', 'e', 'eo', 'f', 'fl', 'g', 'h', 'l', 'o', 'pg', 'q', 'r', 'so', 't', 'u', 'w', 'x', 'y', 'z',
]);

/** A path segment made only of known transformation parameters, e.g. "f_auto,q_auto,w_600". */
function isTransformation(segment: string): boolean {
  return segment.split(',').every((part) => {
    const key = /^([a-z]+)_/.exec(part)?.[1];
    return !!key && TRANSFORMATION_KEYS.has(key);
  });
}

/**
 * Accepts a bare public ID ("folder/name"), or a Cloudinary delivery URL (with or without
 * a version and transformations), and returns its parts. Anything else returns null.
 */
export function parsePublicId(input: string | null | undefined, cloudName: string = env.cloudinaryCloudName): ParsedAsset | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  const match = DELIVERY_URL.exec(value);
  if (!match) {
    if (/^[a-z]+:\/\//i.test(value)) return null;
    const bare = value.replace(/\.(png|jpe?g|webp|avif|gif)$/i, '');
    return BARE_ID.test(bare) ? { cloudName, publicId: bare } : null;
  }
  const [, cloud, rest] = match;
  let segments = rest!.split('?')[0]!.split('/').filter(Boolean);
  let version: number | undefined;
  const versionAt = segments.findIndex((s) => /^v\d+$/.test(s));
  if (versionAt >= 0 && versionAt < segments.length - 1) {
    version = Number(segments[versionAt]!.slice(1));
    segments = segments.slice(versionAt + 1);
  } else {
    while (segments.length > 1 && isTransformation(segments[0]!)) segments.shift();
  }
  if (segments.length === 0) return null;
  const last = segments[segments.length - 1]!;
  const dot = last.lastIndexOf('.');
  const format = dot > 0 ? last.slice(dot + 1).toLowerCase() : undefined;
  if (dot > 0) segments[segments.length - 1] = last.slice(0, dot);
  const publicId = segments.join('/');
  if (!BARE_ID.test(publicId)) return null;
  return { cloudName: cloud!, publicId, ...(version ? { version } : {}), ...(format ? { format } : {}) };
}

function transformation(options: DeliveryOptions): string {
  const parts = ['f_auto', 'q_auto'];
  if (options.width) parts.push(`w_${Math.min(Math.round(options.width), MAX_DELIVERY_WIDTH)}`);
  if (options.height) parts.push(`h_${Math.round(options.height)}`);
  if (options.width || options.height) parts.push(`c_${options.crop ?? 'limit'}`);
  if (options.gravity && options.crop && options.crop !== 'limit') parts.push(`g_${options.gravity}`);
  if (options.dpr) parts.push(`dpr_${options.dpr}`);
  return parts.join(',');
}

/** Delivery URL for a public ID or Cloudinary URL. Returns null for empty or foreign input. */
export function cloudinaryUrl(input: string | null | undefined, options: DeliveryOptions = {}): string | null {
  const asset = parsePublicId(input);
  if (!asset) return null;
  const version = options.version ?? asset.version;
  return [HOST, asset.cloudName, 'image/upload', transformation(options), version ? `v${version}` : null, asset.publicId]
    .filter(Boolean)
    .join('/');
}

/**
 * Named delivery sizes (MEDIA-01). Sizes are device pixels, so they already assume a dense screen
 * (a 96 pt avatar asks for 192 px). Every preset keeps `f_auto,q_auto` from `transformation()`.
 */
export const CLD_PRESETS = {
  /** Profile photo, square, centred on a face when one is found. */
  avatar: { width: 192, height: 192, crop: 'fill', gravity: 'face' },
  avatarSm: { width: 96, height: 96, crop: 'fill', gravity: 'face' },
  /** Home banner art (2:1). */
  banner: { width: 1080, height: 540, crop: 'fill', gravity: 'auto' },
  /** Cards and list covers (3:2). */
  card: { width: 720, height: 480, crop: 'fill', gravity: 'auto' },
  thumb: { width: 240, height: 240, crop: 'fill', gravity: 'auto' },
  /** Detail view: never upscaled, never above MAX_DELIVERY_WIDTH. */
  full: { width: MAX_DELIVERY_WIDTH, crop: 'limit' },
} as const satisfies Record<string, DeliveryOptions>;
export type CldPreset = keyof typeof CLD_PRESETS;

/** Delivery URL for a public ID in a named size. Null for empty or foreign input. */
export function cld(input: string | null | undefined, preset: CldPreset): string | null {
  return cloudinaryUrl(input, { ...CLD_PRESETS[preset], dpr: 'auto' });
}

/** Tiny blurred version shown while the full image loads. */
export function blurPlaceholderUrl(input: string | null | undefined): string | null {
  const asset = parsePublicId(input);
  if (!asset) return null;
  return [HOST, asset.cloudName, 'image/upload', `${BLUR},f_auto,q_auto`, asset.publicId].join('/');
}

/** Width to request for a layout width: about 3x for sharp images on dense screens, capped. */
export function deliveryWidth(layoutWidth: number): number {
  return Math.min(Math.round(layoutWidth * 3), MAX_DELIVERY_WIDTH);
}

export type BannerImageInput = { id: string; imagePublicId?: Partial<LocalizedPublicId> | null };

/**
 * Image for a banner in the current language: Firestore `imagePublicId[lang]`, then the mapped
 * fallback in BANNER_ASSETS. Banner art has text baked in, so the other language is never used.
 * Null means "render the gradient fallback with the localized title".
 */
export function bannerSource(
  banner: BannerImageInput,
  language: 'ar' | 'en',
  layoutWidth: number,
): { uri: string; placeholder: string | null } | null {
  const id = banner.imagePublicId?.[language] || BANNER_ASSETS[banner.id]?.[language] || null;
  const uri = cloudinaryUrl(id, { width: deliveryWidth(layoutWidth), crop: 'limit' });
  return uri ? { uri, placeholder: blurPlaceholderUrl(id) } : null;
}
