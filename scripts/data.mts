/**
 * Wipes, seeds and verifies data. One script, flags for each step.
 *
 *   pnpm emulators
 *   pnpm data -- --reset --apply
 *
 * Flags:
 *   --wipe            Delete every Firestore root collection and every Auth user.
 *   --seed            Write the RBAC catalog, system roles, accounts, the demo workspace,
 *                     marketing content, and Auth passwords. Idempotent: re-running converges.
 *   --reset           Wipe, then seed.
   *   --marketing       Banners, news, cards, support methods, system messages, media records, Home layout, and platform stats only.
 *   --verify          Read the catalog, roles, accounts and marketing docs back and fail on any
 *                     mismatch. Emulator only.
 *   --password <v>    Emulator fallback password when SEED_PASSWORD is unset. Default test1234.
 *   --apply           Actually write. Without it, the script only prints the plan.
 *   --project <id>    Defaults to demo-be-my-hand (the emulator project in package.json).
 *                     That project also defaults FIRESTORE_EMULATOR_HOST to 127.0.0.1:8080.
 *   --confirm-live <id>
 *                     Required to wipe, seed, or reset the live project bemyhand-8de0e, or any
 *                     project that is not on the emulator. Must equal --project. Live runs
 *                     also need GOOGLE_APPLICATION_CREDENTIALS (key stored outside the repo).
 *
 * Accounts come from git-ignored .env.scripts (never committed). Keys:
 *   SEED_PASSWORD                         shared Auth password (required on live, 8+)
 *   SEED_{OWNER,SUPPORT,MODERATOR,CEO,ADMIN,MEMBER,FIELD,SUPPLIER,SUPPLIER2}_{EMAIL,NAME,PASSWORD}
 * Per-account PASSWORD overrides SEED_PASSWORD. On the emulator, missing passwords fall back
 * to --password. A live seed refuses to run if an account still has no 8+ character password.
 *
 * Emulator (default): no credentials needed. Live: set GOOGLE_APPLICATION_CREDENTIALS and
 * pass --confirm-live bemyhand-8de0e. Wipe on live deletes every Firestore collection and every
 * Auth user; seed on live creates the accounts in real Firebase Auth. Dry-run by default.
 *
 * Sign in (demo password: test1234, or --password):
 *   ahmedsalihdev@gmail.com    platform owner (system, every key)
 *   support@bemyhand.test      Support (read-only users, workspaces, logs; no chat)
 *   moderator@bemyhand.test    Moderator
 *   ceo@bemyhand.test          created "فريق القاهرة" (admin, locked seat)
 *   admin@bemyhand.test        admin
 *   member@bemyhand.test       member role
 *   field@bemyhand.test        custom "مشغّل ميداني" role
 *   supplier@bemyhand.test     approved supplier (bakery), no workspace
 *   hygiene@bemyhand.test      approved supplier (hygiene), no workspace
 * Open invite (member role): seed-cairo.MemberSeedInviteCodeCairoxyz
 *
 * The app reads userType and the role docs from Firestore. Nothing is granted from the email.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';

import { BANNER_ASSETS } from '../src/config/cloudinaryAssets.ts';
import { HOME_SECTION_DEFAULTS, HOME_SECTION_KEYS, homeSections } from '../src/domain/home-config.ts';
import {
  bannerSchema,
  isPlaceholder,
  marketingCardSchema,
  newsSchema,
  parseDoc,
  resolveCta,
  visibleBanners,
} from '../src/domain/marketing.ts';
import { USER_SCHEMA_VERSION } from '../src/domain/user.ts';
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PRESET_SEEDS,
  SYSTEM_ROLE_SEEDS,
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MEMBER_ROLE,
  WORKSPACE_ROLE_SEEDS,
} from '../src/services/permissions/catalog.ts';
import { normalizeArabicText } from '../src/utils/arabic.ts';
import {
  assertEmulator,
  AUTH_EMULATOR,
  DEMO_PROJECT,
  useDemoEmulator,
} from './emulator.mts';

const scriptsEnv = fileURLToPath(new URL('../.env.scripts', import.meta.url));
if (existsSync(scriptsEnv)) loadEnv({ path: scriptsEnv });

const LIVE_PROJECT = 'bemyhand-8de0e';
const DEFAULT_PASSWORD = 'test1234';
/** Default platform owner on the emulator. The role still comes from users/{uid}.userType. */
const DEFAULT_OWNER_EMAIL = 'ahmedsalihdev@gmail.com';
const WORKSPACE_ID = 'seed-cairo';
const INVITE_CODE = 'MemberSeedInviteCodeCairoxyz';
// Public OAuth client shipped with firebase-tools. Used only to refresh the local `firebase login` token.
const FIREBASE_CLI_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

type CliLogin = { email: string; refreshToken: string };

function readCliLogin(): CliLogin | null {
  const path = `${homedir()}/.config/configstore/firebase-tools.json`;
  if (!existsSync(path)) return null;
  try {
    const config = JSON.parse(readFileSync(path, 'utf8')) as {
      user?: { email?: string };
      tokens?: { refresh_token?: string };
    };
    const refreshToken = config.tokens?.refresh_token;
    if (!refreshToken) return null;
    return { email: config.user?.email ?? 'firebase login', refreshToken };
  } catch {
    return null;
  }
}

/** Writes the CLI refresh token as application-default credentials, outside the repo. */
function cliCredentialPath(login: CliLogin): string {
  const dir = `${homedir()}/.config/firebase`;
  mkdirSync(dir, { recursive: true });
  const slug = login.email.replaceAll('@', '_').replaceAll('.', '_');
  const path = `${dir}/${slug}_application_default_credentials.json`;
  writeFileSync(
    path,
    JSON.stringify({
      type: 'authorized_user',
      client_id: FIREBASE_CLI_CLIENT_ID,
      client_secret: FIREBASE_CLI_CLIENT_SECRET,
      refresh_token: login.refreshToken,
    }),
    { mode: 0o600 },
  );
  return path;
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const help = args.includes('--help') || args.includes('-h');
const reset = args.includes('--reset');
const wipe = args.includes('--wipe') || reset;
const seed = args.includes('--seed') || reset;
const marketingOnly = args.includes('--marketing');
const doMarketing = marketingOnly || seed;
const verify = args.includes('--verify');
const touchesDemo = wipe || seed;

function flagValue(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`Missing ${name} <value>.`);
    process.exit(1);
  }
  return value;
}

const projectId = flagValue('--project') ?? DEMO_PROJECT;
const confirmLive = flagValue('--confirm-live');
const password = flagValue('--password') ?? DEFAULT_PASSWORD;

function usage(): void {
  console.log(`Usage: node scripts/data.mts [--project <id>] [--wipe] [--seed] [--reset] [--marketing] [--verify] [--password <value>] [--confirm-live <id>] [--apply]

  --wipe         Delete every Firestore root collection and every Auth user.
  --seed         Write the RBAC catalog, system roles, accounts, demo workspace, content.
  --reset        Wipe, then seed.
  --marketing    Banners, news, cards, support methods, system messages, media records, and platform stats only.
  --verify       Check catalog, roles, accounts and Home content (emulator only).
  --password     Emulator fallback password. Default ${DEFAULT_PASSWORD}.
                 Live: set SEED_PASSWORD (or per-account SEED_*_PASSWORD) in .env.scripts.
  --apply        Write. Omit it for a dry run.
  --confirm-live Required to wipe, seed, or reset the live project. Must equal --project.

  Emulator (default):
  pnpm data -- --reset --apply
  pnpm data -- --wipe --apply
  pnpm data -- --seed --apply
  pnpm data -- --marketing --apply
  pnpm data -- --verify

  Live project (uses \`firebase login\` when no key file is set):
  pnpm data -- --wipe --project ${LIVE_PROJECT} --confirm-live ${LIVE_PROJECT} --apply
  pnpm data -- --seed --project ${LIVE_PROJECT} --confirm-live ${LIVE_PROJECT} --apply
  A service-account key still works if you set GOOGLE_APPLICATION_CREDENTIALS to a real file.

Platform owner (emulator default): ${DEFAULT_OWNER_EMAIL}
Demo password: ${DEFAULT_PASSWORD}`);
}

if (help || (!wipe && !seed && !marketingOnly && !verify)) {
  usage();
  process.exit(help ? 0 : 1);
}

if (seed && password.length < 6) {
  console.error('--password must be at least 6 characters.');
  process.exit(1);
}

const instapayLink = process.env.INSTAPAY_LINK?.trim() ?? '';
const instapayAddress = process.env.INSTAPAY_ADDRESS?.trim() ?? '';
const vodafoneCashNumber = process.env.VODAFONE_CASH_NUMBER?.trim() ?? '';
if (doMarketing && instapayLink && !/^https:\/\/\S+$/.test(instapayLink)) {
  console.error('INSTAPAY_LINK must be an https URL.');
  process.exit(1);
}

if (
  touchesDemo &&
  !process.env.FIRESTORE_EMULATOR_HOST &&
  projectId === LIVE_PROJECT &&
  confirmLive !== projectId
) {
  console.error(
    `Refusing to touch the live project ${LIVE_PROJECT}. Pass --confirm-live ${LIVE_PROJECT} (and be logged in with firebase login).`,
  );
  process.exit(1);
}
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyPath && !existsSync(keyPath)) {
  console.error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${keyPath}`);
  console.error(
    'That path is only an example. Using your Firebase CLI login instead.',
  );
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
const cliLogin = readCliLogin();
const hasKey = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const hasLiveAuth = hasKey || cliLogin !== null;

if (confirmLive !== projectId) useDemoEmulator(projectId);
const onEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const isLive = projectId === LIVE_PROJECT;

if (touchesDemo) {
  if (!onEmulator && confirmLive !== projectId) {
    console.error(
      `Not on the emulator. Pass --confirm-live ${projectId} to continue, or set FIRESTORE_EMULATOR_HOST.`,
    );
    process.exit(1);
  }
  if (!onEmulator && !hasLiveAuth) {
    console.error(
      'Log in with `firebase login`, or set GOOGLE_APPLICATION_CREDENTIALS to a real key file.',
    );
    process.exit(1);
  }
  // Auth: use the Auth emulator only when Firestore is emulated. On live, Admin SDK
  // hits real Firebase Auth with the CLI login or the service-account key.
  if (onEmulator && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR;
    console.log(`FIREBASE_AUTH_EMULATOR_HOST unset; using ${AUTH_EMULATOR}.`);
  }
} else {
  if (verify && !onEmulator) {
    console.error(
      'Verify is emulator only. Set FIRESTORE_EMULATOR_HOST or use the demo project.',
    );
    process.exit(1);
  }
  if (verify && !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR;
  if (doMarketing && !onEmulator && !hasLiveAuth) {
    console.error(
      'Log in with `firebase login`, or set GOOGLE_APPLICATION_CREDENTIALS to a real key file.',
    );
    process.exit(1);
  }
}

if (onEmulator)
  await assertEmulator(process.env.FIRESTORE_EMULATOR_HOST!, 'Firestore');
if (touchesDemo && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  await assertEmulator(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Auth');
}

if (!onEmulator && !hasKey && cliLogin) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = cliCredentialPath(cliLogin);
  console.log(`Using Firebase CLI login (${cliLogin.email}).`);
}
initializeApp(
  onEmulator ? { projectId } : { projectId, credential: applicationDefault() },
);
const db = getFirestore();

type Account = {
  uid: string;
  email: string;
  name: string;
  password: string;
  userType: 'owner' | 'support' | 'moderator' | 'member' | 'supplier';
  /** systemRoles/{id} for staff; null for platform users. */
  systemRoleId: string | null;
  /** Role in seed-cairo, or null when the account has no workspace. */
  workspaceRoleId: string | null;
  label: string;
};

type SeedKey =
  | 'OWNER'
  | 'SUPPORT'
  | 'MODERATOR'
  | 'CEO'
  | 'ADMIN'
  | 'MEMBER'
  | 'FIELD'
  | 'SUPPLIER'
  | 'SUPPLIER2';

function envTrim(key: string): string {
  return process.env[key]?.trim() ?? '';
}

/** Credentials come from .env.scripts. Live requires 8+ characters; the emulator falls back to --password. */
function accountPassword(key: SeedKey): string {
  const secret = envTrim(`SEED_${key}_PASSWORD`) || envTrim('SEED_PASSWORD');
  if (seed && !onEmulator && secret.length < 8) {
    console.error(
      `SEED_${key}_PASSWORD or SEED_PASSWORD (8+ characters) must be set in .env.scripts to seed a live project.`,
    );
    process.exit(1);
  }
  return secret || password;
}

function seedAccount(
  key: SeedKey,
  base: Omit<Account, 'email' | 'name' | 'password'> & { email: string; name: string },
): Account {
  return {
    ...base,
    email: envTrim(`SEED_${key}_EMAIL`) || base.email,
    name: envTrim(`SEED_${key}_NAME`) || base.name,
    password: accountPassword(key),
  };
}

const FIELD_ROLE = 'field';
const fieldPreset = PRESET_SEEDS.find((preset) => preset.id === 'field-operator')!;

const accounts: Account[] = [
  seedAccount('OWNER', {
    uid: 'seed-platform-owner',
    email: DEFAULT_OWNER_EMAIL,
    name: 'أحمد صالح',
    userType: 'owner',
    systemRoleId: 'owner',
    workspaceRoleId: null,
    label: 'platform owner',
  }),
  seedAccount('SUPPORT', {
    uid: 'seed-support',
    email: 'support@bemyhand.test',
    name: 'فريق الدعم',
    userType: 'support',
    systemRoleId: 'support',
    workspaceRoleId: null,
    label: 'Support',
  }),
  seedAccount('MODERATOR', {
    uid: 'seed-moderator',
    email: 'moderator@bemyhand.test',
    name: 'مشرف المنصة',
    userType: 'moderator',
    systemRoleId: 'moderator',
    workspaceRoleId: null,
    label: 'Moderator',
  }),
  seedAccount('CEO', {
    uid: 'seed-ceo',
    email: 'ceo@bemyhand.test',
    name: 'سارة حسن',
    userType: 'member',
    systemRoleId: null,
    workspaceRoleId: WORKSPACE_ADMIN_ROLE,
    label: 'workspace creator (admin)',
  }),
  seedAccount('ADMIN', {
    uid: 'seed-admin',
    email: 'admin@bemyhand.test',
    name: 'أحمد علي',
    userType: 'member',
    systemRoleId: null,
    workspaceRoleId: WORKSPACE_ADMIN_ROLE,
    label: 'workspace admin',
  }),
  seedAccount('MEMBER', {
    uid: 'seed-member',
    email: 'member@bemyhand.test',
    name: 'ليلى محمود',
    userType: 'member',
    systemRoleId: null,
    workspaceRoleId: WORKSPACE_MEMBER_ROLE,
    label: 'workspace member',
  }),
  seedAccount('FIELD', {
    uid: 'seed-field',
    email: 'field@bemyhand.test',
    name: 'عمر يوسف',
    userType: 'member',
    systemRoleId: null,
    workspaceRoleId: FIELD_ROLE,
    label: 'custom field role',
  }),
  seedAccount('SUPPLIER', {
    uid: 'seed-supplier',
    email: 'supplier@bemyhand.test',
    name: 'مخبز الخير',
    userType: 'supplier',
    systemRoleId: null,
    workspaceRoleId: null,
    label: 'approved supplier',
  }),
  seedAccount('SUPPLIER2', {
    uid: 'seed-supplier-hygiene',
    email: 'hygiene@bemyhand.test',
    name: 'نظافة البيت',
    userType: 'supplier',
    systemRoleId: null,
    workspaceRoleId: null,
    label: 'approved hygiene supplier',
  }),
];

const creator = accounts.find((account) => account.uid === 'seed-ceo')!;
const member = accounts.find((account) => account.uid === 'seed-member')!;
const workspaceAccounts = accounts.filter((account) => account.workspaceRoleId);

type Write = { ref: DocumentReference; data: DocumentData };

function nameSearch(value: string): string {
  return normalizeArabicText(value);
}

/** Returns the number of root collections found (0 means nothing to delete). */
async function wipeFirestore(): Promise<number> {
  const collections = await db.listCollections();
  if (collections.length === 0) {
    console.log('Firestore is already empty (no root collections).');
    return 0;
  }
  for (const collection of collections) {
    const count = (await collection.count().get()).data().count;
    console.log(
      `${apply ? 'delete' : 'would delete'} ${collection.id} (${count} root docs, including subcollections)`,
    );
    if (apply) await db.recursiveDelete(collection);
  }
  return collections.length;
}

/** Returns the number of Auth users found (0 means nothing to delete). */
async function wipeAuth(auth: Auth): Promise<number> {
  const uids: string[] = [];
  let page = await auth.listUsers(1000);
  for (;;) {
    uids.push(...page.users.map((user) => user.uid));
    if (!page.pageToken) break;
    page = await auth.listUsers(1000, page.pageToken);
  }
  console.log(
    `${apply ? 'delete' : 'would delete'} ${uids.length} Auth user(s)`,
  );
  if (!apply || uids.length === 0) return uids.length;
  for (let i = 0; i < uids.length; i += 1000) {
    await auth.deleteUsers(uids.slice(i, i + 1000));
  }
  return uids.length;
}

async function seedAuth(auth: Auth): Promise<void> {
  for (const account of accounts) {
    console.log(
      `${apply ? 'auth' : 'would auth'} ${account.email} (${account.uid})`,
    );
    if (!apply) continue;
    const byEmail = await auth
      .getUserByEmail(account.email)
      .catch((error: { code?: string }) => {
        if (error.code === 'auth/user-not-found') return null;
        throw error;
      });
    if (byEmail && byEmail.uid !== account.uid)
      await auth.deleteUser(byEmail.uid);
    const existing = await auth
      .getUser(account.uid)
      .catch((error: { code?: string }) => {
        if (error.code === 'auth/user-not-found') return null;
        throw error;
      });
    const profile = {
      email: account.email,
      password: account.password,
      displayName: account.name,
      emailVerified: true,
    };
    if (existing) await auth.updateUser(account.uid, profile);
    else await auth.createUser({ uid: account.uid, ...profile });
  }
}

function phone(
  id: string,
  e164: string,
  label: string,
  isPrimary: boolean,
  at: Timestamp,
) {
  return { id, number: e164, raw: e164, label, isPrimary, createdAt: at };
}

function seedWrites(database: Firestore): Write[] {
  const now = Timestamp.now();
  const day = 24 * 60 * 60 * 1000;
  const earlier = Timestamp.fromMillis(now.toMillis() - day);
  const serverNow = FieldValue.serverTimestamp();
  const actor = { uid: creator.uid, name: creator.name };
  const writes: Write[] = [];
  const put = (ref: DocumentReference, data: DocumentData) =>
    writes.push({ ref, data });

  for (const def of PERMISSION_CATALOG) {
    put(database.doc(`permissions/${def.key}`), {
      key: def.key,
      group: def.group,
      scope: def.scope,
      order: def.order,
      label: def.label,
      description: def.description,
      baseline: def.baseline ?? false,
    });
  }
  for (const group of PERMISSION_GROUPS) {
    put(database.doc(`permissionGroups/${group.id}`), {
      name: group.name,
      scope: group.scope,
      order: group.order,
    });
  }
  for (const preset of PRESET_SEEDS) {
    put(database.doc(`permissionPresets/${preset.id}`), {
      name: preset.name,
      scope: preset.scope,
      permissions: preset.permissions,
      isDeleted: false,
      createdBy: 'seed',
      createdAt: serverNow,
      updatedAt: serverNow,
    });
  }
  for (const role of SYSTEM_ROLE_SEEDS) {
    put(database.doc(`systemRoles/${role.id}`), {
      name: role.name,
      permissions: role.permissions,
      isLocked: role.isLocked,
      isDeleted: false,
      createdBy: 'seed',
      createdAt: serverNow,
      updatedAt: serverNow,
    });
  }

  for (const account of accounts) {
    put(database.doc(`users/${account.uid}`), {
      displayName: account.name,
      email: account.email,
      locale: 'ar',
      themePreference: 'system',
      userType: account.userType,
      systemRoleId: account.systemRoleId,
      supplierStatus: account.userType === 'supplier' ? 'approved' : 'none',
      status: 'active',
      isDeleted: false,
      onboarding: { step: 'done', completedAt: serverNow },
      lastWorkspaceId: account.workspaceRoleId ? WORKSPACE_ID : null,
      schemaVersion: USER_SCHEMA_VERSION,
      createdAt: serverNow,
      updatedAt: serverNow,
    });
  }

  const supplierAccounts = accounts.filter((account) => account.userType === 'supplier');
  const bakery = accounts.find((account) => account.uid === 'seed-supplier')!;
  const hygiene = accounts.find((account) => account.uid === 'seed-supplier-hygiene')!;

  for (const supplier of supplierAccounts) {
    put(database.doc(`supplierRequests/${supplier.uid}`), {
      userId: supplier.uid,
      displayName: supplier.name,
      email: supplier.email,
      message:
        supplier.uid === bakery.uid
          ? 'مخبز في مدينة نصر، نوفّر الخبز للأسر المسجّلة.'
          : 'متجر نظافة في المعادي، نوفّر الصابون والمنظفات للأسر.',
      status: 'approved',
      reason: null,
      reviewedBy: accounts[0]!.uid,
      reviewedAt: serverNow,
      createdAt: earlier,
      updatedAt: serverNow,
    });
  }

  // ---------- store (V7) ----------
  put(database.doc(`suppliers/${bakery.uid}`), {
    name: bakery.name,
    nameSearch: nameSearch(bakery.name),
    bio: {
      ar: 'مخبز خيري في مدينة نصر يوفّر الخبز والسلع الأساسية للأسر المسجّلة.',
      en: 'A charity bakery in Nasr City supplying bread and staples for registered families.',
    },
    logoPublicId: null,
    coverPublicId: null,
    categoryIds: ['food', 'staples', 'bakery'],
    serviceArea: 'مدينة نصر، القاهرة',
    contacts: { phone: '+201000000099', whatsapp: '+201000000099', email: bakery.email },
    isVerified: true,
    status: 'active',
    itemsCount: 5,
    ratingSum: 9,
    ratingCount: 2,
    bagsDonatedCount: 2,
    isDeleted: false,
    createdAt: earlier,
    createdBy: accounts[0]!.uid,
    updatedAt: serverNow,
    updatedBy: accounts[0]!.uid,
  });

  put(database.doc(`suppliers/${hygiene.uid}`), {
    name: hygiene.name,
    nameSearch: nameSearch(hygiene.name),
    bio: {
      ar: 'متجر نظافة في المعادي يوفّر الصابون والمنظفات بأسعار مناسبة.',
      en: 'A hygiene shop in Maadi offering soap and cleaners at fair prices.',
    },
    logoPublicId: null,
    coverPublicId: null,
    categoryIds: ['hygiene', 'soap'],
    serviceArea: 'المعادي، القاهرة',
    contacts: { phone: '+201000000088', whatsapp: '+201000000088', email: hygiene.email },
    isVerified: true,
    status: 'active',
    itemsCount: 4,
    ratingSum: 5,
    ratingCount: 1,
    bagsDonatedCount: 1,
    isDeleted: false,
    createdAt: earlier,
    createdBy: accounts[0]!.uid,
    updatedAt: serverNow,
    updatedBy: accounts[0]!.uid,
  });

  const storeCategories = [
    { id: 'food', parentId: null, level: 1 as const, name: { ar: 'مواد غذائية', en: 'Food' }, order: 0, itemsCount: 0 },
    { id: 'staples', parentId: 'food', level: 2 as const, name: { ar: 'أساسيات', en: 'Staples' }, order: 0, itemsCount: 4 },
    { id: 'bakery', parentId: 'food', level: 2 as const, name: { ar: 'مخبوزات', en: 'Bakery' }, order: 1, itemsCount: 1 },
    { id: 'hygiene', parentId: null, level: 1 as const, name: { ar: 'نظافة', en: 'Hygiene' }, order: 1, itemsCount: 0 },
    { id: 'soap', parentId: 'hygiene', level: 2 as const, name: { ar: 'صابون', en: 'Soap' }, order: 0, itemsCount: 4 },
  ];
  for (const cat of storeCategories) {
    put(database.doc(`storeCategories/${cat.id}`), {
      parentId: cat.parentId,
      level: cat.level,
      name: cat.name,
      iconPublicId: null,
      order: cat.order,
      isActive: true,
      itemsCount: cat.itemsCount,
      isDeleted: false,
      createdAt: earlier,
      createdBy: accounts[0]!.uid,
      updatedAt: serverNow,
      updatedBy: accounts[0]!.uid,
    });
  }

  const storeItems = [
    {
      id: 'rice-5kg',
      supplierId: bakery.uid,
      supplierName: bakery.name,
      categoryId: 'food',
      subCategoryId: 'staples',
      name: { ar: 'أرز ٥ كجم', en: 'Rice 5 kg' },
      description: { ar: 'كيس أرز مصري.', en: 'Egyptian rice bag.' },
      priceMinor: 15000,
      unit: 'bag',
      bagsCount: 5,
    },
    {
      id: 'oil-1l',
      supplierId: bakery.uid,
      supplierName: bakery.name,
      categoryId: 'food',
      subCategoryId: 'staples',
      name: { ar: 'زيت ١ لتر', en: 'Oil 1 L' },
      description: { ar: 'زيت طبخ.', en: 'Cooking oil.' },
      priceMinor: 8500,
      unit: 'bottle',
      bagsCount: 3,
    },
    {
      id: 'sugar-1kg',
      supplierId: bakery.uid,
      supplierName: bakery.name,
      categoryId: 'food',
      subCategoryId: 'staples',
      name: { ar: 'سكر ١ كجم', en: 'Sugar 1 kg' },
      description: { ar: 'سكر أبيض.', en: 'White sugar.' },
      priceMinor: 4500,
      unit: 'bag',
      bagsCount: 2,
    },
    {
      id: 'pasta-400g',
      supplierId: bakery.uid,
      supplierName: bakery.name,
      categoryId: 'food',
      subCategoryId: 'staples',
      name: { ar: 'مكرونة ٤٠٠ جم', en: 'Pasta 400 g' },
      description: { ar: 'عبوة مكرونة.', en: 'Pasta pack.' },
      priceMinor: 2500,
      unit: 'pack',
      bagsCount: 1,
    },
    {
      id: 'bread-pack',
      supplierId: bakery.uid,
      supplierName: bakery.name,
      categoryId: 'food',
      subCategoryId: 'bakery',
      name: { ar: 'عيش بلدي', en: 'Baladi bread' },
      description: { ar: 'عبوة ١٠ أرغفة.', en: 'Pack of 10 loaves.' },
      priceMinor: 2000,
      unit: 'pack',
      bagsCount: 7,
    },
    {
      id: 'soap-bar',
      supplierId: hygiene.uid,
      supplierName: hygiene.name,
      categoryId: 'hygiene',
      subCategoryId: 'soap',
      name: { ar: 'صابون غسيل', en: 'Laundry soap' },
      description: { ar: 'قالب صابون للملابس.', en: 'Bar soap for laundry.' },
      priceMinor: 1200,
      unit: 'bar',
      bagsCount: 4,
    },
    {
      id: 'dish-soap',
      supplierId: hygiene.uid,
      supplierName: hygiene.name,
      categoryId: 'hygiene',
      subCategoryId: 'soap',
      name: { ar: 'سائل أطباق', en: 'Dish soap' },
      description: { ar: 'زجاجة ٥٠٠ مل.', en: '500 ml bottle.' },
      priceMinor: 3000,
      unit: 'bottle',
      bagsCount: 2,
    },
    {
      id: 'hand-wash',
      supplierId: hygiene.uid,
      supplierName: hygiene.name,
      categoryId: 'hygiene',
      subCategoryId: 'soap',
      name: { ar: 'غسول يد', en: 'Hand wash' },
      description: { ar: 'غسول يد ٢٥٠ مل.', en: '250 ml hand wash.' },
      priceMinor: 3500,
      unit: 'bottle',
      bagsCount: 1,
    },
    {
      id: 'cleaner-1l',
      supplierId: hygiene.uid,
      supplierName: hygiene.name,
      categoryId: 'hygiene',
      subCategoryId: 'soap',
      name: { ar: 'منظف أرضيات', en: 'Floor cleaner' },
      description: { ar: 'منظف ١ لتر.', en: '1 L floor cleaner.' },
      priceMinor: 4000,
      unit: 'bottle',
      bagsCount: 0,
    },
  ];
  for (const item of storeItems) {
    put(database.doc(`storeItems/${item.id}`), {
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      categoryId: item.categoryId,
      subCategoryId: item.subCategoryId,
      name: item.name,
      nameSearch: nameSearch(item.name.en),
      description: item.description,
      imagePublicIds: [],
      priceMinor: item.priceMinor,
      currency: 'EGP',
      unit: item.unit,
      stock: 50,
      isAvailable: true,
      status: 'active',
      bagsCount: item.bagsCount,
      isDeleted: false,
      createdAt: earlier,
      createdBy: item.supplierId,
      updatedAt: serverNow,
      updatedBy: item.supplierId,
    });
  }

  put(database.doc(`suppliers/${bakery.uid}/reviews/${member.uid}`), {
    rating: 5,
    text: 'خبز طازج وتسليم سريع.',
    reviewerName: member.name,
    reviewerAvatarPublicId: null,
    isHidden: false,
    createdAt: earlier,
    updatedAt: earlier,
  });
  put(database.doc(`suppliers/${bakery.uid}/reviews/${creator.uid}`), {
    rating: 4,
    text: 'Reliable staple packs.',
    reviewerName: creator.name,
    reviewerAvatarPublicId: null,
    isHidden: false,
    createdAt: earlier,
    updatedAt: earlier,
  });
  put(database.doc(`suppliers/${hygiene.uid}/reviews/${member.uid}`), {
    rating: 5,
    text: 'منتجات نظافة جيدة وسعر مناسب.',
    reviewerName: member.name,
    reviewerAvatarPublicId: null,
    isHidden: false,
    createdAt: earlier,
    updatedAt: earlier,
  });

  const bags = [
    {
      id: 'seed-bag',
      name: 'سلة رمضان التجريبية',
      note: 'حقيبة عامة للتجربة.',
      token: 'SEEDBAGTOKENABCDEFGHJKLMNPQR',
      donationsCount: 5,
      items: [
        { key: 'rice', storeItemId: 'rice-5kg', supplierId: bakery.uid, supplierName: bakery.name, name: { ar: 'أرز ٥ كجم', en: 'Rice 5 kg' }, unitPriceMinor: 15000, quantity: 1 },
        { key: 'oil', storeItemId: 'oil-1l', supplierId: bakery.uid, supplierName: bakery.name, name: { ar: 'زيت ١ لتر', en: 'Oil 1 L' }, unitPriceMinor: 8500, quantity: 1 },
      ],
    },
    {
      id: 'seed-bag-family',
      name: 'حقيبة الأسرة',
      note: 'أساسيات لأسرة مكونة من أربعة.',
      token: 'SEEDBAGFAMILYTOKENABCDEFGHJK',
      donationsCount: 3,
      items: [
        { key: 'rice', storeItemId: 'rice-5kg', supplierId: bakery.uid, supplierName: bakery.name, name: { ar: 'أرز ٥ كجم', en: 'Rice 5 kg' }, unitPriceMinor: 15000, quantity: 1 },
        { key: 'sugar', storeItemId: 'sugar-1kg', supplierId: bakery.uid, supplierName: bakery.name, name: { ar: 'سكر ١ كجم', en: 'Sugar 1 kg' }, unitPriceMinor: 4500, quantity: 2 },
        { key: 'soap', storeItemId: 'soap-bar', supplierId: hygiene.uid, supplierName: hygiene.name, name: { ar: 'صابون غسيل', en: 'Laundry soap' }, unitPriceMinor: 1200, quantity: 2 },
      ],
    },
    {
      id: 'seed-bag-hygiene',
      name: 'حقيبة النظافة',
      note: 'منتجات نظافة أساسية.',
      token: 'SEEDBAGHYGIENETOKENABCDEFGH',
      donationsCount: 1,
      items: [
        { key: 'soap', storeItemId: 'soap-bar', supplierId: hygiene.uid, supplierName: hygiene.name, name: { ar: 'صابون غسيل', en: 'Laundry soap' }, unitPriceMinor: 1200, quantity: 3 },
        { key: 'dish', storeItemId: 'dish-soap', supplierId: hygiene.uid, supplierName: hygiene.name, name: { ar: 'سائل أطباق', en: 'Dish soap' }, unitPriceMinor: 3000, quantity: 1 },
      ],
    },
  ];

  for (const bag of bags) {
    const totalMinor = bag.items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
    const supplierTotals: Record<string, number> = {};
    for (const item of bag.items) {
      supplierTotals[item.supplierId] = (supplierTotals[item.supplierId] ?? 0) + item.unitPriceMinor * item.quantity;
    }
    put(database.doc(`bags/${bag.id}`), {
      name: bag.name,
      note: bag.note,
      coverPublicId: null,
      creatorId: creator.uid,
      creatorName: creator.name,
      workspaceId: WORKSPACE_ID,
      isPublic: true,
      accessMode: 'collaborative',
      linkToken: bag.token,
      status: 'active',
      version: 1,
      itemsCount: bag.items.length,
      totalMinor,
      currency: 'EGP',
      supplierTotals,
      donationsCount: bag.donationsCount,
      isDeleted: false,
      createdAt: earlier,
      updatedAt: serverNow,
    });
    put(database.doc(`bagLinks/${bag.token}`), {
      bagId: bag.id,
      isActive: true,
      createdAt: earlier,
    });
    for (const item of bag.items) {
      put(database.doc(`bags/${bag.id}/items/${item.key}`), {
        storeItemId: item.storeItemId,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        name: item.name,
        imagePublicId: null,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        addedBy: creator.uid,
        updatedAt: earlier,
      });
    }
    put(database.doc(`bags/${bag.id}/versions/1`), {
      version: 1,
      items: bag.items.map((item) => ({
        storeItemId: item.storeItemId,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        name: item.name,
        imagePublicId: null,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        addedBy: creator.uid,
      })),
      totalMinor,
      itemsCount: bag.items.length,
      supplierTotals,
      note: bag.note,
      createdAt: earlier,
      createdBy: creator.uid,
    });
  }

  put(database.doc('appConfig/store'), {
    popularItemsCount: 8,
    popularSuppliersCount: 8,
    topBagsCount: 5,
    updatedAt: serverNow,
    updatedBy: accounts[0]!.uid,
  });

  const cities = [
    { id: 'cairo', name: 'القاهرة' },
    { id: 'giza', name: 'الجيزة' },
    { id: 'sadat', name: 'مدينة السادات' },
  ];
  const areas = [
    {
      id: 'nasr',
      name: 'مدينة نصر',
      cityId: 'cairo',
      cityName: 'القاهرة',
      beneficiaryCount: 3,
    },
    {
      id: 'maadi',
      name: 'المعادي',
      cityId: 'cairo',
      cityName: 'القاهرة',
      beneficiaryCount: 1,
    },
    {
      id: 'dokki',
      name: 'الدقي',
      cityId: 'giza',
      cityName: 'الجيزة',
      beneficiaryCount: 1,
    },
    ...[
      ['sadat-zone-3', 'المنطقة ٣'],
      ['sadat-zone-5', 'المنطقة ٥'],
      ['sadat-zone-6', 'المنطقة ٦'],
      ['sadat-zone-7', 'المنطقة ٧'],
      ['sadat-zone-9', 'المنطقة ٩'],
      ['sadat-zone-11', 'المنطقة ١١'],
      ['sadat-zone-12', 'المنطقة ١٢'],
      ['sadat-zone-14', 'المنطقة ١٤'],
      ['sadat-zone-15', 'المنطقة ١٥'],
      ['sadat-zone-21', 'المنطقة ٢١'],
      ['sadat-zone-22', 'المنطقة ٢٢'],
      ['sadat-zone-24', 'المنطقة ٢٤'],
      ['sadat-zone-25', 'المنطقة ٢٥'],
      ['sadat-zone-29', 'المنطقة ٢٩'],
      ['sadat-zone-33', 'المنطقة ٣٣'],
      ['sadat-zone-34', 'المنطقة ٣٤'],
      ['sadat-zone-36', 'المنطقة ٣٦'],
      ['sadat-zaytoun', 'حي الزيتون'],
      ['sadat-rawda', 'حي الروضة'],
      ['sadat-rayhan', 'حي الريحان'],
    ].map(([id, name]) => ({
      id,
      name,
      cityId: 'sadat',
      cityName: 'مدينة السادات',
      beneficiaryCount: 0,
    })),
  ];

  put(database.doc(`workspaces/${WORKSPACE_ID}`), {
    name: 'فريق القاهرة',
    description: 'بيانات تجريبية للتوزيع في القاهرة والجيزة ومدينة السادات.',
    ownerId: creator.uid,
    beneficiaryCount: 5,
    areaCount: areas.length,
    cityCount: cities.length,
    sessionCount: 1,
    isDeleted: false,
    isArchived: false,
    createdAt: serverNow,
    updatedAt: serverNow,
  });

  const workspaceRoles = [
    ...WORKSPACE_ROLE_SEEDS.map((role) => ({
      id: role.id,
      name: role.name.ar,
      permissions: role.permissions,
      isLocked: role.isLocked,
    })),
    { id: FIELD_ROLE, name: fieldPreset.name.ar, permissions: fieldPreset.permissions, isLocked: false },
  ];
  for (const role of workspaceRoles) {
    put(database.doc(`workspaces/${WORKSPACE_ID}/roles/${role.id}`), {
      name: role.name,
      permissions: role.permissions,
      isLocked: role.isLocked,
      isDeleted: false,
      createdBy: creator.uid,
      createdAt: serverNow,
      updatedAt: serverNow,
    });
  }

  for (const account of workspaceAccounts) {
    put(database.doc(`workspaces/${WORKSPACE_ID}/members/${account.uid}`), {
      userId: account.uid,
      roleId: account.workspaceRoleId,
      status: 'active',
      joinedAt: serverNow,
      displayName: account.name,
      email: account.email,
    });
  }

  put(database.doc(`workspaces/${WORKSPACE_ID}/invites/${INVITE_CODE}`), {
    workspaceId: WORKSPACE_ID,
    workspaceName: 'فريق القاهرة',
    roleId: WORKSPACE_MEMBER_ROLE,
    roleName: workspaceRoles.find((role) => role.id === WORKSPACE_MEMBER_ROLE)!.name,
    createdBy: creator.uid,
    createdAt: serverNow,
    expiresAt: Timestamp.fromMillis(now.toMillis() + 14 * day),
    used: false,
    usedBy: null,
    usedAt: null,
  });

  for (const city of cities) {
    put(database.doc(`workspaces/${WORKSPACE_ID}/cities/${city.id}`), {
      name: city.name,
      nameSearch: nameSearch(city.name),
      isArchived: false,
      createdAt: serverNow,
      createdBy: creator.uid,
      updatedAt: serverNow,
    });
  }
  for (const area of areas) {
    put(database.doc(`workspaces/${WORKSPACE_ID}/areas/${area.id}`), {
      name: area.name,
      nameSearch: nameSearch(area.name),
      cityId: area.cityId,
      cityName: area.cityName,
      description: null,
      isActive: true,
      beneficiaryCount: area.beneficiaryCount,
      createdAt: serverNow,
      createdBy: creator.uid,
      updatedAt: serverNow,
    });
  }

  const aminaPhones = [
    phone('p-amina-1', '+201012300001', 'موبايل', true, earlier),
    phone('p-amina-2', '+201555300009', 'المنزل', false, earlier),
  ];
  const people: {
    id: string;
    fullName: string;
    householdCount: number;
    cityId: string;
    cityName: string;
    areaId: string;
    areaName: string;
    residentialAddress: string;
    pickupLocation: string;
    notes: string | null;
    phones: ReturnType<typeof phone>[];
    archived?: boolean;
    pin?: { lat: number; lng: number; label: string };
  }[] = [
    {
      id: 'amina',
      fullName: 'أمينة عبد الرحمن',
      householdCount: 4,
      cityId: 'cairo',
      cityName: 'القاهرة',
      areaId: 'nasr',
      areaName: 'مدينة نصر',
      residentialAddress: 'شارع عباس العقاد، عمارة ١٢',
      pickupLocation: 'مسجد التوحيد',
      notes: 'يفضل التسليم مساءً.',
      phones: aminaPhones,
    },
    {
      id: 'khaled',
      fullName: 'خالد مصطفى',
      householdCount: 2,
      cityId: 'cairo',
      cityName: 'القاهرة',
      areaId: 'nasr',
      areaName: 'مدينة نصر',
      residentialAddress: 'منطقة السراج، شارع حسن المأمون',
      pickupLocation: 'جمعية السراج',
      notes: null,
      phones: [phone('p-khaled', '+201112300002', 'موبايل', true, earlier)],
    },
    {
      id: 'nourhan',
      fullName: 'نورهان سعيد',
      householdCount: 5,
      cityId: 'cairo',
      cityName: 'القاهرة',
      areaId: 'nasr',
      areaName: 'مدينة نصر',
      residentialAddress: 'امتداد رمسيس، برج النصر',
      pickupLocation: 'أمام البرج',
      notes: null,
      phones: [phone('p-nourhan', '+201212300003', 'موبايل', true, earlier)],
    },
    {
      id: 'fatma',
      fullName: 'فاطمة علي',
      householdCount: 3,
      cityId: 'cairo',
      cityName: 'القاهرة',
      areaId: 'maadi',
      areaName: 'المعادي',
      residentialAddress: 'شارع ٩، المعادي',
      pickupLocation: 'نادي المعادي',
      notes: 'تم تسليم سلة غذائية.',
      phones: [phone('p-fatma', '+201512300004', 'موبايل', true, earlier)],
    },
    {
      id: 'youssef',
      fullName: 'يوسف إبراهيم',
      householdCount: 1,
      cityId: 'cairo',
      cityName: 'القاهرة',
      areaId: 'maadi',
      areaName: 'المعادي',
      residentialAddress: 'دجلة، المعادي',
      pickupLocation: 'بوابة دجلة',
      notes: 'انتقل خارج المنطقة.',
      phones: [phone('p-youssef', '+201012300005', 'موبايل', true, earlier)],
      archived: true,
    },
    {
      id: 'mariam',
      fullName: 'مريم حسن',
      householdCount: 6,
      cityId: 'giza',
      cityName: 'الجيزة',
      areaId: 'dokki',
      areaName: 'الدقي',
      residentialAddress: 'شارع التحرير، الدقي',
      pickupLocation: 'مترو الدقي',
      notes: null,
      phones: [phone('p-mariam', '+201112300006', 'موبايل', true, earlier)],
      pin: { lat: 30.0384, lng: 31.2125, label: 'المنزل' },
    },
  ];

  for (const person of people) {
    const primary = person.phones.find((item) => item.isPrimary) ?? null;
    put(database.doc(`workspaces/${WORKSPACE_ID}/beneficiaries/${person.id}`), {
      workspaceId: WORKSPACE_ID,
      fullName: person.fullName,
      nameSearch: nameSearch(person.fullName),
      householdCount: person.householdCount,
      cityId: person.cityId,
      cityName: person.cityName,
      areaId: person.areaId,
      areaName: person.areaName,
      residentialAddress: person.residentialAddress,
      pickupLocation: person.pickupLocation,
      notes: person.notes,
      phones: person.phones,
      primaryPhone: primary?.number ?? null,
      phoneDigits: person.phones.map((item) => item.number),
      mapPins: person.pin
        ? [
            {
              id: `pin-${person.id}`,
              lat: person.pin.lat,
              lng: person.pin.lng,
              label: person.pin.label,
              description: null,
              createdAt: earlier,
              updatedAt: earlier,
              createdBy: creator.uid,
            },
          ]
        : [],
      lastConfirmedAssistanceAt: person.id === 'fatma' ? earlier : null,
      lastConfirmedAssistanceRecordId: person.id === 'fatma' ? 'food-1' : null,
      isArchived: Boolean(person.archived),
      archivedAt: person.archived ? earlier : null,
      extra: {},
      schemaVersion: 1,
      createdBy: creator.uid,
      createdAt: serverNow,
      updatedAt: serverNow,
      updatedBy: creator.uid,
    });
    put(
      database.doc(
        `workspaces/${WORKSPACE_ID}/beneficiaries/${person.id}/history/created`,
      ),
      {
        id: 'created',
        workspaceId: WORKSPACE_ID,
        beneficiaryId: person.id,
        actorId: actor.uid,
        actorName: actor.name,
        type: 'beneficiary_created',
        createdAt: serverNow,
        clientAt: earlier,
        metadata: { fullName: person.fullName },
      },
    );
  }

  put(
    database.doc(
      `workspaces/${WORKSPACE_ID}/beneficiaries/fatma/assistanceRecords/food-1`,
    ),
    {
      workspaceId: WORKSPACE_ID,
      beneficiaryId: 'fatma',
      type: 'food',
      description: 'سلة غذائية',
      sessionId: null,
      deliveredAt: earlier,
      recordedBy: creator.uid,
      recordedByName: creator.name,
      notes: null,
      confirmationStatus: 'confirmed',
      confirmedAt: serverNow,
      confirmedBy: creator.uid,
      createdAt: serverNow,
      clientAt: earlier,
    },
  );
  put(
    database.doc(
      `workspaces/${WORKSPACE_ID}/beneficiaries/fatma/history/assistance`,
    ),
    {
      id: 'assistance',
      workspaceId: WORKSPACE_ID,
      beneficiaryId: 'fatma',
      actorId: actor.uid,
      actorName: actor.name,
      type: 'assistance_confirmed',
      createdAt: serverNow,
      clientAt: earlier,
      metadata: { recordId: 'food-1', type: 'food' },
    },
  );

  const sessionId = 'nasr-round-1';
  const sessionItems: {
    id: string;
    status: 'checked' | 'ignored' | 'pending';
  }[] = [
    { id: 'amina', status: 'checked' },
    { id: 'khaled', status: 'ignored' },
    { id: 'nourhan', status: 'pending' },
  ];
  put(database.doc(`workspaces/${WORKSPACE_ID}/sessions/${sessionId}`), {
    workspaceId: WORKSPACE_ID,
    name: 'توزيع مدينة نصر',
    cityId: 'cairo',
    cityName: 'القاهرة',
    areaIds: ['nasr'],
    areaNames: ['مدينة نصر'],
    status: 'active',
    createdBy: creator.uid,
    operatorId: member.uid,
    operatorName: member.name,
    startedBy: creator.uid,
    startedAt: serverNow,
    endedAt: null,
    endedBy: null,
    beneficiaryCount: sessionItems.length,
    checkedCount: 1,
    ignoredCount: 1,
    pendingCount: 1,
    contactActionsCount: 0,
    summary: null,
    createdAt: serverNow,
    clientAt: now,
    lastProcessedAt: serverNow,
    updatedAt: serverNow,
  });

  sessionItems.forEach((item, order) => {
    const person = people.find((entry) => entry.id === item.id)!;
    const processed = item.status !== 'pending';
    put(
      database.doc(
        `workspaces/${WORKSPACE_ID}/sessions/${sessionId}/items/${person.id}`,
      ),
      {
        beneficiaryId: person.id,
        order,
        fullName: person.fullName,
        householdCount: person.householdCount,
        primaryPhone:
          person.phones.find((entry) => entry.isPrimary)?.number ?? null,
        phones: person.phones,
        areaId: person.areaId,
        areaName: person.areaName,
        pickupLocation: person.pickupLocation,
        residentialAddress: person.residentialAddress,
        notes: person.notes,
        mapPins: [],
        status: item.status,
        processedAt: processed ? serverNow : null,
        processedBy: processed ? member.uid : null,
        processedClientAt: processed ? now : null,
        note: null,
      },
    );
    if (!processed) return;
    const type = item.status === 'checked' ? 'checked' : 'ignored';
    put(
      database.doc(
        `workspaces/${WORKSPACE_ID}/sessions/${sessionId}/events/${type}`,
      ),
      {
        id: type,
        workspaceId: WORKSPACE_ID,
        sessionId,
        actorId: member.uid,
        actorName: member.name,
        type,
        createdAt: serverNow,
        clientAt: now,
        metadata: { beneficiaryId: person.id },
      },
    );
    put(
      database.doc(
        `workspaces/${WORKSPACE_ID}/beneficiaries/${person.id}/history/session`,
      ),
      {
        id: 'session',
        workspaceId: WORKSPACE_ID,
        sessionId,
        beneficiaryId: person.id,
        actorId: member.uid,
        actorName: member.name,
        type: item.status === 'checked' ? 'session_checked' : 'session_ignored',
        createdAt: serverNow,
        clientAt: now,
        metadata: { sessionName: 'توزيع مدينة نصر' },
      },
    );
  });

  put(
    database.doc(
      `workspaces/${WORKSPACE_ID}/sessions/${sessionId}/events/session_created`,
    ),
    {
      id: 'session_created',
      workspaceId: WORKSPACE_ID,
      sessionId,
      actorId: actor.uid,
      actorName: actor.name,
      type: 'session_created',
      createdAt: serverNow,
      clientAt: now,
      metadata: { count: sessionItems.length },
    },
  );

  put(database.doc(`workspaces/${WORKSPACE_ID}/auditLog/workspace_created`), {
    id: 'workspace_created',
    workspaceId: WORKSPACE_ID,
    actorId: actor.uid,
    actorName: actor.name,
    type: 'workspace_created',
    createdAt: serverNow,
    clientAt: now,
    metadata: { name: 'فريق القاهرة' },
  });

  put(database.doc('platformStats/global'), {
    usersCount: accounts.length,
    workspacesCount: 1,
    membersCount: workspaceAccounts.length,
    sessionsCount: 1,
    updatedAt: serverNow,
  });

  return writes;
}

async function commitWrites(writes: Write[]): Promise<void> {
  const chunk = 400;
  for (let i = 0; i < writes.length; i += chunk) {
    const batch = db.batch();
    for (const write of writes.slice(i, i + chunk))
      batch.set(write.ref, write.data);
    await batch.commit();
  }
}

type Localized = { ar: string; en: string };
type SeedBanner = {
  id: string;
  order: number;
  isActive: boolean;
  title: Localized;
  subtitle: Localized;
  cta?: { label: Localized; type: 'route' | 'url'; target: string };
};

async function seedMarketing(options: { skipStats: boolean }): Promise<number> {
  const seedFile = JSON.parse(
    readFileSync(
      new URL('../banners/banners-seed.json', import.meta.url),
      'utf8',
    ),
  ) as {
    banners: SeedBanner[];
  };
  const banners = seedFile.banners.map((b) => ({
    id: b.id,
    data: {
      title: b.title,
      subtitle: b.subtitle,
      imagePublicId: BANNER_ASSETS[b.id as keyof typeof BANNER_ASSETS] ?? {
        ar: null,
        en: null,
      },
      cta: b.cta ?? null,
      order: b.order,
      isActive: b.isActive,
    },
  }));

  const day = 24 * 60 * 60 * 1000;
  const news = [
    {
      id: 'welcome',
      data: {
        title: { ar: 'مرحباً بك في Be My Hand', en: 'Welcome to Be My Hand' },
        summary: {
          ar: 'تطبيق مجاني يساعد الفرق التطوعية على تنظيم المستفيدين وجلسات التوزيع.',
          en: 'A free app that helps volunteer teams organize beneficiaries and distribution sessions.',
        },
        body: {
          ar: 'أنشئ مساحة عمل لفريقك، وادعُ الأعضاء، وسجّل المستفيدين حسب المدينة والمنطقة.\n\nيعمل التطبيق دون اتصال، وتتم المزامنة تلقائياً عند عودة الإنترنت.',
          en: 'Create a workspace for your team, invite members and record beneficiaries by city and area.\n\nThe app works offline and syncs automatically when you are back online.',
        },
        coverImagePublicId: null,
        category: 'announcement',
        isPublished: true,
        isPinned: true,
        publishedAt: Timestamp.fromMillis(Date.now() - day),
      },
    },
    {
      id: 'offline-sessions',
      data: {
        title: {
          ar: 'جلسات التوزيع تعمل دون إنترنت',
          en: 'Distribution sessions work offline',
        },
        summary: {
          ar: 'سجّل التسليم في الميدان حتى مع ضعف الشبكة.',
          en: 'Record deliveries in the field even with a weak connection.',
        },
        body: {
          ar: 'تُحفظ كل خطوة على جهازك أولاً، ثم تُرفع عند توفر الاتصال. يظهر مؤشر المزامنة أعلى الشاشة.',
          en: 'Every step is saved on your device first and uploaded when a connection is available. The sync indicator at the top shows the status.',
        },
        coverImagePublicId: null,
        category: 'feature',
        isPublished: true,
        isPinned: false,
        publishedAt: Timestamp.fromMillis(Date.now() - 3 * day),
      },
    },
  ];

  const cards = [
    {
      id: 'tip-offline',
      data: {
        type: 'tip',
        title: { ar: 'يعمل دون اتصال', en: 'Works offline' },
        subtitle: {
          ar: 'سجّل في الميدان وتتم المزامنة لاحقاً.',
          en: 'Record in the field and sync later.',
        },
        icon: 'wifi-off',
        order: 1,
        isActive: true,
      },
    },
    {
      id: 'tip-permissions',
      data: {
        type: 'feature',
        title: { ar: 'صلاحيات لكل عضو', en: 'Permissions per member' },
        subtitle: {
          ar: 'حدّد ما يمكن لكل شخص رؤيته وتعديله.',
          en: 'Choose what each person can see and change.',
        },
        icon: 'shield',
        order: 2,
        isActive: true,
      },
    },
  ];

  // Developer credit for About. Created only when missing; edit it in the Firebase console.
  // (appConfig/support used to hold the payment details too; those moved to supportMethods.)
  const developer = {
    developerName: 'REPLACE_WITH_DEVELOPER_NAME',
    developerWebsite: 'https://asalih.vercel.app',
  };

  // InstaPay values can come from .env.scripts or from an older appConfig/support document, so the
  // migration needs no manual copying. Placeholders count as missing.
  const old = (await db.doc('appConfig/support').get()).data() ?? {};
  const realOld = (key: string) =>
    typeof old[key] === 'string' && !isPlaceholder(old[key] as string) ? (old[key] as string) : '';
  const instapay = {
    link: instapayLink || realOld('instapayLink'),
    address: instapayAddress || realOld('instapayAddress'),
  };

  // Payment methods, InstaPay first. Created only when missing so dashboard edits survive a re-seed;
  // real values from the env or the old document are applied on top (setFields). A method without a
  // real value stays hidden: the app never shows a placeholder.
  const supportMethods = [
    {
      id: 'instapay',
      data: {
        title: { ar: 'إنستا باي', en: 'InstaPay' },
        description: {
          ar: 'تبرّع بسرعة من تطبيق البنك: امسح الرمز أو انسخ العنوان.',
          en: 'Donate quickly from your banking app: scan the code or copy the address.',
        },
        imagePublicId: null,
        copyValue: instapay.address || 'REPLACE_WITH_INSTAPAY_ADDRESS',
        copyLabel: { ar: 'عنوان إنستا باي', en: 'InstaPay address' },
        ...(instapay.link ? { linkUrl: instapay.link } : {}),
        order: 0,
        isActive: !!(instapay.address || instapay.link),
        isDeleted: false,
      },
      real: instapay.address || instapay.link
        ? {
            ...(instapay.address ? { copyValue: instapay.address } : {}),
            ...(instapay.link ? { linkUrl: instapay.link } : {}),
            isActive: true,
          }
        : null,
    },
    {
      id: 'vodafone-cash',
      data: {
        title: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
        description: {
          ar: 'حوّل إلى المحفظة الإلكترونية من تطبيق فودافون.',
          en: 'Send to the wallet from the Vodafone app.',
        },
        imagePublicId: null,
        copyValue: vodafoneCashNumber || 'REPLACE_WITH_VODAFONE_CASH_NUMBER',
        copyLabel: { ar: 'رقم المحفظة', en: 'Wallet number' },
        order: 1,
        isActive: !!vodafoneCashNumber,
        isDeleted: false,
      },
      real: vodafoneCashNumber ? { copyValue: vodafoneCashNumber, isActive: true } : null,
    },
  ];

  // The one system message V6 builds on. The app keeps its own text until a message is published
  // under this key; this one matches that text.
  const systemMessages = [
    {
      id: 'sync_queue_info',
      data: {
        key: 'sync_queue_info',
        category: 'info-text',
        type: 'info',
        text: {
          ar: 'تُحفظ التغييرات على جهازك وتُرفع عند عودة الاتصال.',
          en: 'Changes are saved on your device and uploaded when you are back online.',
        },
        placement: 'sync-sheet',
        audience: { kind: 'all', values: [] },
        startsAt: null,
        endsAt: null,
        isPublished: true,
        isDeleted: false,
      },
    },
  ];

  // Library records for the banner art that already lives in Cloudinary (uploaded by hand), so the
  // media library starts with the files the banners use. Sizes are unknown for these.
  const media = Object.entries(BANNER_ASSETS).flatMap(([bannerId, ids]) =>
    (['ar', 'en'] as const).flatMap((lang) =>
      ids[lang]
        ? [
            {
              id: `seed-${bannerId}-${lang}`,
              data: {
                publicId: ids[lang],
                resourceType: 'image',
                preset: 'seed',
                folder: '',
                width: 0,
                height: 0,
                format: '',
                bytes: 0,
                entityType: 'banner',
                entityId: bannerId,
                lang,
                label: `${bannerId} (${lang})`,
                ownerId: 'seed',
                isDeleted: false,
              },
            },
          ]
        : [],
    ),
  );
  const stats = {
    usersCount: 0,
    workspacesCount: 0,
    membersCount: 0,
    sessionsCount: 0,
  };

  type Op = {
    path: string;
    data: Record<string, unknown>;
    mode: 'merge' | 'createIfMissing' | 'setFields';
  };
  const ops: Op[] = [
    ...banners.map((b) => ({
      path: `banners/${b.id}`,
      data: b.data,
      mode: 'merge' as const,
    })),
    ...news.map((n) => ({
      path: `news/${n.id}`,
      data: n.data,
      mode: 'merge' as const,
    })),
    ...cards.map((c) => ({
      path: `marketingCards/${c.id}`,
      data: c.data,
      mode: 'merge' as const,
    })),
    { path: 'appConfig/support', data: developer, mode: 'createIfMissing' },
    {
      path: 'appConfig/home',
      data: { sections: HOME_SECTION_DEFAULTS },
      mode: 'createIfMissing',
    },
    {
      path: 'appConfig/store',
      data: {
        popularItemsCount: 8,
        popularSuppliersCount: 8,
        topBagsCount: 5,
      },
      mode: 'createIfMissing',
    },
    ...supportMethods.flatMap((m) => [
      { path: `supportMethods/${m.id}`, data: m.data, mode: 'createIfMissing' as const },
      ...(m.real
        ? [{ path: `supportMethods/${m.id}`, data: m.real, mode: 'setFields' as const }]
        : []),
    ]),
    ...systemMessages.map((m) => ({
      path: `systemMessages/${m.id}`,
      data: m.data,
      mode: 'createIfMissing' as const,
    })),
    ...media.map((m) => ({
      path: `media/${m.id}`,
      data: m.data,
      mode: 'createIfMissing' as const,
    })),
    ...(options.skipStats
      ? []
      : [
          {
            path: 'platformStats/global',
            data: stats,
            mode: 'createIfMissing' as const,
          },
        ]),
  ];

  let written = 0;
  for (const op of ops) {
    const ref = db.doc(op.path);
    const existing = await ref.get();
    if (op.mode === 'createIfMissing' && existing.exists) {
      console.log(`skip   ${op.path} (exists)`);
      continue;
    }
    const { publishedAt, ...rest } = op.data;
    const data = {
      ...rest,
      ...(publishedAt !== undefined && !existing.get('publishedAt')
        ? { publishedAt }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    };
    console.log(`${apply ? 'write' : 'would write'} ${op.path}`);
    if (apply) {
      await ref.set(data, { merge: true });
      written += 1;
    }
  }

  const unmapped = banners.flatMap((b) =>
    (['ar', 'en'] as const)
      .filter((l) => !b.data.imagePublicId[l])
      .map((l) => `${b.id}/${l}`),
  );
  if (unmapped.length)
    console.log(
      `\nBanners without art (gradient fallback): ${unmapped.join(', ')}`,
    );
  return written;
}

async function verifyMarketing(): Promise<void> {
  const problems: string[] = [];
  const banners = (
    await db
      .collection('banners')
      .where('isActive', '==', true)
      .orderBy('order')
      .get()
  ).docs.map((d) => parseDoc(bannerSchema, d.id, d.data()));
  const visible = visibleBanners(banners, Date.now());
  if (visible.length === 0) problems.push('no visible banners');
  for (const b of visible) {
    if (!b.title.ar || !b.title.en)
      problems.push(`banner ${b.id}: missing title`);
    if (b.cta && !resolveCta(b.cta))
      problems.push(
        `banner ${b.id}: CTA "${b.cta.target}" is not an allowed destination`,
      );
  }

  const news = (
    await db
      .collection('news')
      .where('isPublished', '==', true)
      .orderBy('publishedAt', 'desc')
      .get()
  ).docs.map((d) => parseDoc(newsSchema, d.id, d.data()));
  if (news.length === 0) problems.push('no published news');
  for (const n of news)
    if (!n.publishedAt) problems.push(`news ${n.id}: missing publishedAt`);

  const cards = (
    await db
      .collection('marketingCards')
      .where('isActive', '==', true)
      .orderBy('order')
      .get()
  ).docs.map((d) => parseDoc(marketingCardSchema, d.id, d.data()));
  // The app's own rules for a visible method live in src/domain/support-method.ts (not importable
  // here); the check below mirrors them: an active method needs a real value to copy or open.
  const real = (v: unknown) => typeof v === 'string' && v.trim() !== '' && !isPlaceholder(v);
  const methodDocs = await db.collection('supportMethods').orderBy('order').get();
  const shownMethods = methodDocs.docs.filter((d) => {
    const m = d.data();
    return m.isActive === true && m.isDeleted !== true && (real(m.copyValue) || real(m.linkUrl));
  });
  for (const d of methodDocs.docs) {
    const m = d.data();
    if (m.isActive === true && !shownMethods.some((x) => x.id === d.id))
      problems.push(`supportMethods/${d.id} is active but has no real value to copy or open`);
    if (!m.title?.ar || !m.title?.en) problems.push(`supportMethods/${d.id}: missing title`);
  }
  const methods = methodDocs.docs;
  const shown = shownMethods;
  const info = await db.doc('systemMessages/sync_queue_info').get();
  const infoData = info.data();
  if (!info.exists) problems.push('systemMessages/sync_queue_info missing');
  else if (
    infoData?.isPublished !== true ||
    infoData?.isDeleted === true ||
    !infoData?.text?.ar ||
    !infoData?.text?.en
  )
    problems.push('systemMessages/sync_queue_info is not a published, bilingual message');
  const mediaCount = (await db.collection('media').where('isDeleted', '==', false).count().get()).data().count;
  const stats = await db.doc('platformStats/global').get();
  if (!stats.exists) problems.push('platformStats/global missing');
  const homeDoc = await db.doc('appConfig/home').get();
  const home = homeSections(homeDoc.data() ?? null);
  if (!homeDoc.exists) problems.push('appConfig/home missing');
  if (home.length !== HOME_SECTION_KEYS.length) problems.push('appConfig/home is missing sections');
  const homeKeys = new Set(home.map((section) => section.key));
  for (const key of HOME_SECTION_KEYS) {
    if (!homeKeys.has(key)) problems.push(`appConfig/home missing ${key}`);
  }

  const storeConfig = await db.doc('appConfig/store').get();
  if (!storeConfig.exists) problems.push('appConfig/store missing');
  const categories = await db.collection('storeCategories').where('isDeleted', '==', false).get();
  if (categories.size < 2) problems.push('storeCategories: need at least a parent and a child');
  const items = await db
    .collection('storeItems')
    .where('status', '==', 'active')
    .where('isDeleted', '==', false)
    .get();
  if (items.size < 8) problems.push(`expected at least 8 active storeItems, got ${items.size}`);
  for (const sid of ['seed-supplier', 'seed-supplier-hygiene']) {
    const supplierDoc = await db.doc(`suppliers/${sid}`).get();
    if (!supplierDoc.exists || supplierDoc.get('isDeleted') === true) {
      problems.push(`suppliers/${sid} missing`);
    }
  }
  const publicBags = await db
    .collection('bags')
    .where('isPublic', '==', true)
    .where('isDeleted', '==', false)
    .get();
  if (publicBags.size < 3) problems.push(`expected at least 3 public bags, got ${publicBags.size}`);

  console.log(
    `banners ${visible.length}, news ${news.length}, cards ${cards.length}, home ${home.filter((section) => section.visible).length}/${home.length}, support methods shown ${shown.length}/${methods.length}, media ${mediaCount}, categories ${categories.size}, items ${items.size}, bags ${publicBags.size}`,
  );
  if (problems.length) {
    console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('OK: seeded content parses and renders.');
}

/** Deletes catalog docs for keys or groups that are no longer in catalog.ts. */
async function pruneCatalog(): Promise<number> {
  const keep = {
    permissions: new Set<string>(PERMISSION_KEYS),
    permissionGroups: new Set<string>(PERMISSION_GROUPS.map((group) => group.id)),
  };
  let pruned = 0;
  for (const [name, ids] of Object.entries(keep)) {
    const stale = (await db.collection(name).get()).docs.filter((d) => !ids.has(d.id));
    for (const d of stale) {
      console.log(`${apply ? 'delete' : 'would delete'} ${d.ref.path} (not in catalog)`);
      if (apply) await d.ref.delete();
      pruned += 1;
    }
  }
  return pruned;
}

function sameKeys(a: unknown, b: readonly string[]): boolean {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((key) => set.has(key));
}

async function verifyRbac(): Promise<void> {
  const problems: string[] = [];
  const scopeOf = new Map<string, string>(PERMISSION_CATALOG.map((def) => [def.key, def.scope]));

  const permissions = await db.collection('permissions').get();
  const seen = new Set(permissions.docs.map((d) => d.id));
  for (const def of PERMISSION_CATALOG) {
    const d = permissions.docs.find((p) => p.id === def.key);
    if (!d) problems.push(`permissions/${def.key} missing`);
    else if (d.get('scope') !== def.scope || d.get('group') !== def.group)
      problems.push(`permissions/${def.key}: scope or group differs from catalog.ts`);
  }
  for (const id of seen)
    if (!scopeOf.has(id)) problems.push(`permissions/${id} is not in catalog.ts`);

  const groups = await db.collection('permissionGroups').get();
  if (!sameKeys(groups.docs.map((d) => d.id), PERMISSION_GROUPS.map((group) => group.id)))
    problems.push('permissionGroups do not match catalog.ts');

  for (const preset of PRESET_SEEDS) {
    const d = await db.doc(`permissionPresets/${preset.id}`).get();
    if (!d.exists || d.get('isDeleted') !== false) problems.push(`permissionPresets/${preset.id} missing`);
    else if (!sameKeys(d.get('permissions'), preset.permissions))
      problems.push(`permissionPresets/${preset.id}: keys differ`);
  }

  for (const role of SYSTEM_ROLE_SEEDS) {
    const d = await db.doc(`systemRoles/${role.id}`).get();
    if (!d.exists || d.get('isDeleted') !== false) problems.push(`systemRoles/${role.id} missing`);
    else if (!sameKeys(d.get('permissions'), role.permissions) || d.get('isLocked') !== role.isLocked)
      problems.push(`systemRoles/${role.id}: keys or lock differ`);
  }
  const support = SYSTEM_ROLE_SEEDS.find((role) => role.id === 'support');
  if (support?.permissions.some((key) => key.startsWith('chat.')))
    problems.push('systemRoles/support must not hold chat keys');

  const roleDocs = await db.collection(`workspaces/${WORKSPACE_ID}/roles`).get();
  const roles = new Map(roleDocs.docs.map((d) => [d.id, d.data()]));
  for (const [id, data] of roles) {
    const keys = Array.isArray(data.permissions) ? (data.permissions as string[]) : [];
    const bad = keys.filter((key) => scopeOf.get(key) === 'system' || !scopeOf.has(key));
    if (bad.length) problems.push(`roles/${id}: non-workspace keys ${bad.join(', ')}`);
  }
  if (roles.get(WORKSPACE_ADMIN_ROLE)?.isLocked !== true) problems.push(`roles/${WORKSPACE_ADMIN_ROLE} must be locked`);

  const auth = getAuth();
  for (const account of accounts) {
    const user = (await db.doc(`users/${account.uid}`).get()).data();
    if (!user) {
      problems.push(`users/${account.uid} missing`);
      continue;
    }
    if (user.userType !== account.userType || (user.systemRoleId ?? null) !== account.systemRoleId)
      problems.push(`users/${account.uid}: expected ${account.userType}/${account.systemRoleId}`);
    if (user.schemaVersion !== USER_SCHEMA_VERSION) problems.push(`users/${account.uid}: schemaVersion ${user.schemaVersion}`);
    const authUser = await auth.getUser(account.uid).catch(() => null);
    if (authUser?.email !== account.email) problems.push(`auth ${account.uid}: missing or wrong email`);

    if (!account.workspaceRoleId) continue;
    const m = (await db.doc(`workspaces/${WORKSPACE_ID}/members/${account.uid}`).get()).data();
    if (m?.roleId !== account.workspaceRoleId) problems.push(`members/${account.uid}: roleId ${m?.roleId}`);
    const role = roles.get(account.workspaceRoleId);
    if (!role || role.isDeleted !== false) problems.push(`members/${account.uid}: role ${account.workspaceRoleId} missing`);
  }

  const ws = (await db.doc(`workspaces/${WORKSPACE_ID}`).get()).data();
  const ownerMember = ws && (await db.doc(`workspaces/${WORKSPACE_ID}/members/${ws.ownerId}`).get()).data();
  if (ownerMember?.roleId !== WORKSPACE_ADMIN_ROLE) problems.push('workspace creator is not an admin');
  const invite = (await db.doc(`workspaces/${WORKSPACE_ID}/invites/${INVITE_CODE}`).get()).data();
  if (!invite || !roles.has(invite.roleId)) problems.push('invite roleId does not point at a live role');

  console.log(
    `permissions ${permissions.size}/${PERMISSION_KEYS.length}, groups ${groups.size}, system roles ${SYSTEM_ROLE_SEEDS.length}, workspace roles ${roles.size}, accounts ${accounts.length}`,
  );
  if (problems.length) {
    console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('OK: catalog, roles and assignments match catalog.ts.');
}

console.log(
  `${onEmulator ? 'Emulator' : 'LIVE'} project ${projectId}${apply ? '' : ' (dry run)'}`,
);

if (isLive && touchesDemo) {
  console.log(
    apply
      ? `WARNING: writing to the LIVE project ${projectId}. This deletes/overwrites real data.`
      : `Dry run against the LIVE project ${projectId}. No changes written.`,
  );
}

let wipedAnything = false;

try {
  if (wipe) {
    const rootCollections = await wipeFirestore();
    const authUsers = await wipeAuth(getAuth());
    wipedAnything = rootCollections + authUsers > 0;
    if (!wipedAnything)
      console.log(`Nothing to wipe: ${projectId} had no data.`);
  }

  if (seed) {
    if (apply) {
      await db.recursiveDelete(db.doc(`workspaces/${WORKSPACE_ID}`));
      console.log(`cleared workspaces/${WORKSPACE_ID}`);
    }
    const writes = seedWrites(db);
    console.log(
      `${apply ? 'write' : 'would write'} ${writes.length} documents (workspace ${WORKSPACE_ID})`,
    );
    if (apply) await commitWrites(writes);
    await pruneCatalog();
    await seedAuth(getAuth());
  }

  if (doMarketing) {
    const written = await seedMarketing({ skipStats: seed });
    if (apply) console.log(`Marketing: ${written} document(s) written.`);
  }

  if (seed) {
    console.log(`
Accounts (demo password ${password}; staff passwords from .env.scripts when set):
  ${accounts.map((account) => `${account.email.padEnd(28)} ${account.label}`).join('\n  ')}
Invite: ${WORKSPACE_ID}.${INVITE_CODE}`);
  }

  if (verify) {
    await verifyRbac();
    await verifyMarketing();
  }

  if (wipedAnything && !seed && !doMarketing) {
    console.log(
      `\nHome content ${apply ? 'was removed' : 'would be removed'} with the wipe. Restore it with:\n  pnpm data -- --seed --apply\n  pnpm data -- --marketing --apply`,
    );
  }

  const writes = wipe || seed || doMarketing;
  if (writes)
    console.log(apply ? '\nDone.' : '\nDry run. Re-run with --apply to write.');
} catch (error) {
  console.error(error);
  process.exit(1);
}
