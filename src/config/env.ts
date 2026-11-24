import { z } from 'zod';

import { DEFAULT_LINK_HOST } from '@/domain/invite';

// Everything here is EXPO_PUBLIC_*: bundled into the app and readable by anyone who has it.
// Never add a secret (Cloudinary API secret, service account, ...) to this file or to .env.
// Expo inlines only static `process.env.EXPO_PUBLIC_X` reads, so each variable is read explicitly.
const raw = {
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  useEmulators: process.env.EXPO_PUBLIC_USE_EMULATORS,
  emulatorHost: process.env.EXPO_PUBLIC_EMULATOR_HOST,
  cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
  cloudinaryPresetPrefix: process.env.EXPO_PUBLIC_CLOUDINARY_PRESET_PREFIX,
  cloudinaryFolder: process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER,
  linkDomain: process.env.EXPO_PUBLIC_LINK_DOMAIN,
};

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const envSchema = z.object({
  googleWebClientId: z.preprocess(blankToUndefined, z.string().optional()),
  useEmulators: z
    .preprocess(blankToUndefined, z.enum(['true', 'false']).default('false'))
    .transform((v) => v === 'true'),
  emulatorHost: z.preprocess(blankToUndefined, z.string().default('127.0.0.1')),
  cloudinaryCloudName: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(
        /^[a-z0-9_-]+$/i,
        'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME must be a Cloudinary cloud name',
      )
      .default('rrphuvne'),
  ),
  /**
   * Prefix of the nine unsigned presets (`<prefix>avatars`, `<prefix>banners`, ...; docs/cloudinary-setup.md).
   * Empty disables every upload (delivery still works).
   */
  cloudinaryPresetPrefix: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^[\w-]+$/)
      .optional(),
  ),
  cloudinaryFolder: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^[\w/-]+$/)
      .default('be-my-hand'),
  ),
  /** Host of join and bag links (no scheme, no path). Must match app.config.ts associated domains. */
  linkDomain: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(
        /^[a-z0-9.-]+\.[a-z]{2,}$/i,
        'EXPO_PUBLIC_LINK_DOMAIN must be a host name such as bmyhand.vercel.app',
      )
      .default(DEFAULT_LINK_HOST),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, unknown>): Env {
  const result = envSchema.safeParse(input);
  if (result.success) return result.data;
  const message = `Invalid app environment:\n${result.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`;
  // Fail fast while developing; in a release build fall back to safe defaults instead of crashing.
  if (typeof __DEV__ !== 'undefined' && __DEV__) throw new Error(message);
  console.warn(message);
  return envSchema.parse({});
}

export const env = parseEnv(raw);
