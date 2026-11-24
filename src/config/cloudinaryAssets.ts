// Fallback Cloudinary public IDs for the seeded banners, per language.
// Firestore `banners/{id}.imagePublicId` wins; these are used only when it is missing.
// Art has the title baked in, so each language has its own upload (docs/cloudinary-setup.md).
// When the same design was uploaded twice, the WebP is used and the PNG is listed below.

export type LocalizedPublicId = { ar: string | null; en: string | null };

export const BANNER_ASSETS: Record<string, LocalizedPublicId> = {
  // mulgwg6el6jdtpzydbyu: Arabic "يد بيد، ننظّم الخير"; eofu45brelnfw0xa8qkz: "Helping hands, organized."
  'helping-hands': { ar: 'mulgwg6el6jdtpzydbyu', en: 'eofu45brelnfw0xa8qkz' },
  // eec5ymnz5jk9eiom08xx: Arabic "اعمل حتى بدون إنترنت"; mytsk6ruhpanrloigkti: "Work even offline."
  offline: { ar: 'eec5ymnz5jk9eiom08xx', en: 'mytsk6ruhpanrloigkti' },
  // lcqjijwplncff6i7dxbe: Arabic "فريقك كله في مكان واحد"; pztyleswg298cmyvgjwz: "Your team, in one place."
  teams: { ar: 'lcqjijwplncff6i7dxbe', en: 'pztyleswg298cmyvgjwz' },
  // flfvoz8yaqba9xzjzrso: Arabic "بياناتك جاهزة للتصدير"; snhkxmfzezvp6osrxnba: "Your data, export-ready."
  export: { ar: 'flfvoz8yaqba9xzjzrso', en: 'snhkxmfzezvp6osrxnba' },
};

/** Same designs uploaded again from the larger PNG. Not used as a banner fallback. */
export const UNMAPPED_PUBLIC_IDS: string[] = [
  // export, Arabic — duplicate of flfvoz8yaqba9xzjzrso
  'jfsnfzghyvbdkamwqvkp',
  // export, English — duplicate of snhkxmfzezvp6osrxnba
  'xekwojqimaois4pnua9t',
  // teams, Arabic — duplicate of lcqjijwplncff6i7dxbe
  'v8k7u4ux3saiugwvwx95',
  // teams, English — duplicate of pztyleswg298cmyvgjwz
  'r2ltxvfxnz6gk2zbsn8n',
];
