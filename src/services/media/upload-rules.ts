// Pure upload validation and result parsing (tested in tests/upload.test.ts).

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Cloudinary accepts deletion by token for 10 minutes; keep a margin for clock skew and the request itself. */
export const DELETE_TOKEN_TTL_MS = 9 * 60 * 1000;
export const BANNER_RATIO = 2;
const RATIO_TOLERANCE = 0.2;

export const MEDIA_KINDS = ['banner', 'news', 'card', 'other'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export type PickedImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
};

export type UploadCheck =
  | { ok: true; warning: 'bannerRatio' | null; mimeType: (typeof ALLOWED_MIME)[number] }
  | { ok: false; error: 'type' | 'size' | 'notConfigured' };

const EXT_MIME: Record<string, (typeof ALLOWED_MIME)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function mimeOf(image: PickedImage): (typeof ALLOWED_MIME)[number] | null {
  const declared = image.mimeType?.toLowerCase();
  if (declared && (ALLOWED_MIME as readonly string[]).includes(declared)) return declared as (typeof ALLOWED_MIME)[number];
  if (declared) return null;
  const ext = (image.fileName ?? image.uri).split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? null;
}

export function checkUpload(image: PickedImage, kind: MediaKind, preset: string | undefined): UploadCheck {
  if (!preset) return { ok: false, error: 'notConfigured' };
  const mimeType = mimeOf(image);
  if (!mimeType) return { ok: false, error: 'type' };
  if (image.fileSize != null && image.fileSize > MAX_UPLOAD_BYTES) return { ok: false, error: 'size' };
  let warning: 'bannerRatio' | null = null;
  if (kind === 'banner' && image.width && image.height) {
    const ratio = image.width / image.height;
    if (Math.abs(ratio - BANNER_RATIO) / BANNER_RATIO > RATIO_TOLERANCE) warning = 'bannerRatio';
  }
  return { ok: true, warning, mimeType };
}

export type UploadResult = {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  version: number;
  folder: string;
  tags: string[];
  deleteToken: string | null;
};

/** Parses Cloudinary's upload response, refusing anything that is not an image on our cloud. */
export function parseUploadResponse(body: unknown, cloudName: string): UploadResult | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.public_id !== 'string' || typeof b.secure_url !== 'string') return null;
  if (!b.secure_url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`)) return null;
  return {
    publicId: b.public_id,
    secureUrl: b.secure_url,
    width: typeof b.width === 'number' ? b.width : 0,
    height: typeof b.height === 'number' ? b.height : 0,
    format: typeof b.format === 'string' ? b.format : '',
    bytes: typeof b.bytes === 'number' ? b.bytes : 0,
    version: typeof b.version === 'number' ? b.version : 0,
    folder: typeof b.asset_folder === 'string' ? b.asset_folder : typeof b.folder === 'string' ? b.folder : '',
    tags: Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === 'string') : [],
    deleteToken: typeof b.delete_token === 'string' ? b.delete_token : null,
  };
}

export function canUndo(uploadedAt: number, now: number, token: string | null): boolean {
  return !!token && now - uploadedAt < DELETE_TOKEN_TTL_MS;
}
