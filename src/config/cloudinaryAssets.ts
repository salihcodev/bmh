// Fallback Cloudinary public IDs for the seeded banners, per language.
// Firestore `banners/{id}.imagePublicId` wins; these are used only when it is missing.
// An entry is set only after its image was compared with the local banners/*.png and matched
// (docs/cloudinary-setup.md). Unmatched banners stay null and render the gradient fallback.

export type LocalizedPublicId = { ar: string | null; en: string | null };

export const BANNER_ASSETS: Record<string, LocalizedPublicId> = {
  // mulgwg6el6jdtpzydbyu: Arabic "يد بيد، ننظّم الخير" with the heart badge.
  'helping-hands': { ar: 'mulgwg6el6jdtpzydbyu', en: null },
  // eec5ymnz5jk9eiom08xx: Arabic "اعمل حتى بدون إنترنت" with the sync icon.
  offline: { ar: 'eec5ymnz5jk9eiom08xx', en: null },
  teams: { ar: null, en: null },
  // flfvoz8yaqba9xzjzrso: Arabic "بياناتك جاهزة للتصدير"; xekwojqimaois4pnua9t: "Your data, export-ready."
  export: { ar: 'flfvoz8yaqba9xzjzrso', en: 'xekwojqimaois4pnua9t' },
};

/** Known uploads that are not used as a banner fallback. */
export const UNMAPPED_PUBLIC_IDS: string[] = [
  // Same design as flfvoz8yaqba9xzjzrso (export, Arabic), uploaded from the 1.1 MB PNG instead of the WebP.
  'jfsnfzghyvbdkamwqvkp',
];
