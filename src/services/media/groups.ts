// Pure upload configuration (tested in tests/media-groups.test.ts). No React Native imports.
//
// Every image belongs to an entity (an avatar, a banner, a support method, ...). Each entity maps
// to one upload group, and each group is one unsigned Cloudinary preset (`<prefix><group>`),
// one folder (`be-my-hand/<group>`) and one size budget. See docs/cloudinary-setup.md.

export const MEDIA_ENTITIES = [
  'avatar',
  'banner',
  'news',
  'support',
  'store',
  'supplier',
  'bag',
  'chat',
  'beneficiary',
  'other',
] as const;
export type MediaEntity = (typeof MEDIA_ENTITIES)[number];

export const MEDIA_GROUPS = [
  'avatars',
  'banners',
  'support',
  'store',
  'suppliers',
  'bags',
  'chat',
  'beneficiaries',
  'misc',
] as const;
export type MediaGroup = (typeof MEDIA_GROUPS)[number];

export const ENTITY_GROUP: Record<MediaEntity, MediaGroup> = {
  avatar: 'avatars',
  banner: 'banners',
  news: 'banners',
  support: 'support',
  store: 'store',
  supplier: 'suppliers',
  bag: 'bags',
  chat: 'chat',
  beneficiary: 'beneficiaries',
  other: 'misc',
};

/** Entities a staff member may upload from the dashboard library (the rest are owner-uploaded in their own flow). */
export const STAFF_UPLOAD_ENTITIES = ['banner', 'news', 'support', 'store', 'supplier', 'other'] as const satisfies readonly MediaEntity[];

export function isMediaEntity(value: unknown): value is MediaEntity {
  return typeof value === 'string' && (MEDIA_ENTITIES as readonly string[]).includes(value);
}

export type UploadSpec = {
  group: MediaGroup;
  /** Longest side in pixels after the client-side resize. Cloudinary's incoming transformation caps it again at 2400. */
  maxSide: number;
  /** JPEG quality, 0 to 1. */
  quality: number;
  /** PNG source stays PNG (text art, QR codes) instead of being flattened to JPEG. */
  keepPng: boolean;
};

const GROUP_SIZE: Record<MediaGroup, { maxSide: number; quality: number; keepPng: boolean }> = {
  avatars: { maxSide: 512, quality: 0.85, keepPng: false },
  banners: { maxSide: 1600, quality: 0.85, keepPng: true },
  support: { maxSide: 1200, quality: 0.9, keepPng: true },
  store: { maxSide: 1200, quality: 0.85, keepPng: false },
  suppliers: { maxSide: 1200, quality: 0.85, keepPng: false },
  bags: { maxSide: 1200, quality: 0.85, keepPng: false },
  chat: { maxSide: 1600, quality: 0.8, keepPng: false },
  beneficiaries: { maxSide: 1200, quality: 0.85, keepPng: false },
  misc: { maxSide: 1600, quality: 0.85, keepPng: false },
};

export function uploadSpec(entity: MediaEntity): UploadSpec {
  const group = ENTITY_GROUP[entity];
  return { group, ...GROUP_SIZE[group] };
}

/** Name of the unsigned preset for a group, or null when uploads are switched off (blank prefix). */
export function uploadPresetName(group: MediaGroup, prefix: string | undefined): string | null {
  return prefix ? `${prefix}${group}` : null;
}

/** Folder an upload lands in: `<root>/<group>`. */
export function uploadFolder(root: string, group: MediaGroup): string {
  return `${root}/${group}`;
}

export function uploadTags(entity: MediaEntity, lang: 'ar' | 'en' | null | undefined): string[] {
  return ['be-my-hand', ENTITY_GROUP[entity], entity, lang].filter((tag): tag is string => !!tag);
}

const CONTEXT_VALUE = /[|=\\]/g;

/** Cloudinary `context` string (`key=value|key=value`). Reserved characters are stripped from values. */
export function uploadContext(entity: MediaEntity, entityId: string | null | undefined, ownerId: string): string {
  const clean = (value: string) => value.replace(CONTEXT_VALUE, '').slice(0, 128);
  return [`entity=${entity}`, entityId ? `entityId=${clean(entityId)}` : null, `owner=${clean(ownerId)}`]
    .filter(Boolean)
    .join('|');
}

/** Output format of the client-side resize. PNG art keeps PNG only for groups that need it. */
export function outputFormat(entity: MediaEntity, mimeType: string | null | undefined): 'jpeg' | 'png' {
  return uploadSpec(entity).keepPng && mimeType?.toLowerCase() === 'image/png' ? 'png' : 'jpeg';
}

/** Target size when the longest side exceeds `maxSide`; null when the image already fits (never upscale). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const longest = Math.max(width, height);
  if (longest <= maxSide) return null;
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
