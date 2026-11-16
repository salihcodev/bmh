/**
 * Seeds platform marketing content: banners, news, marketing cards, platformStats/global and
 * appConfig/support. Runs on the developer machine only (same credentials model as migrate.mts).
 *
 *   Emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-marketing.mts --project demo-be-my-hand [--apply]
 *   Live:      GOOGLE_APPLICATION_CREDENTIALS=/path/outside/repo/key.json node scripts/seed-marketing.mts --project bemyhand-8de0e [--apply]
 *
 * Dry run by default. Re-running is safe: content docs are merged by id, and appConfig/support and
 * platformStats/global are only created when missing, so placeholders never overwrite real values.
 * Banner art comes from src/config/cloudinaryAssets.ts (never guessed); unmapped languages fall
 * back to the in-app gradient card.
 */
import { readFileSync } from 'node:fs';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

import { BANNER_ASSETS } from '../src/config/cloudinaryAssets.ts';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectIndex = args.indexOf('--project');
const projectId = projectIndex >= 0 ? args[projectIndex + 1] : undefined;

if (!projectId) {
  console.error('Missing --project <id>.');
  process.exit(1);
}
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set FIRESTORE_EMULATOR_HOST (emulator) or GOOGLE_APPLICATION_CREDENTIALS (live, key stored outside the repo).');
  process.exit(1);
}

initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential: applicationDefault() });
const db = getFirestore();

type Localized = { ar: string; en: string };
type SeedBanner = {
  id: string;
  order: number;
  isActive: boolean;
  title: Localized;
  subtitle: Localized;
  cta?: { label: Localized; type: 'route' | 'url'; target: string };
};

const seed = JSON.parse(readFileSync(new URL('../banners/banners-seed.json', import.meta.url), 'utf8')) as {
  banners: SeedBanner[];
};

const banners = seed.banners.map((b) => ({
  id: b.id,
  data: {
    title: b.title,
    subtitle: b.subtitle,
    imagePublicId: BANNER_ASSETS[b.id as keyof typeof BANNER_ASSETS] ?? { ar: null, en: null },
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
      title: { ar: 'جلسات التوزيع تعمل دون إنترنت', en: 'Distribution sessions work offline' },
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
      subtitle: { ar: 'سجّل في الميدان وتتم المزامنة لاحقاً.', en: 'Record in the field and sync later.' },
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
      subtitle: { ar: 'حدّد ما يمكن لكل شخص رؤيته وتعديله.', en: 'Choose what each person can see and change.' },
      icon: 'shield',
      order: 2,
      isActive: true,
    },
  },
];

// Created only when missing. Replace in the Firebase console (or via Manage) before release.
const support = {
  instapayLink: 'REPLACE_WITH_INSTAPAY_LINK',
  instapayAddress: 'REPLACE_WITH_INSTAPAY_ADDRESS',
  message: {
    ar: 'Be My Hand مجاني ومبني بشكل مستقل. دعمك يساعد على استمراره.',
    en: 'Be My Hand is free and independently built. Your support keeps it going.',
  },
  developerName: 'REPLACE_WITH_DEVELOPER_NAME',
  developerWebsite: 'https://asalih.vercel.app',
  isEnabled: false,
};
const stats = { usersCount: 0, workspacesCount: 0, membersCount: 0, sessionsCount: 0 };

type Op = { path: string; data: Record<string, unknown>; mode: 'merge' | 'createIfMissing' };
const ops: Op[] = [
  ...banners.map((b) => ({ path: `banners/${b.id}`, data: b.data, mode: 'merge' as const })),
  ...news.map((n) => ({ path: `news/${n.id}`, data: n.data, mode: 'merge' as const })),
  ...cards.map((c) => ({ path: `marketingCards/${c.id}`, data: c.data, mode: 'merge' as const })),
  { path: 'appConfig/support', data: support, mode: 'createIfMissing' },
  { path: 'platformStats/global', data: stats, mode: 'createIfMissing' },
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
    ...(publishedAt !== undefined && !existing.get('publishedAt') ? { publishedAt } : {}),
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
  (['ar', 'en'] as const).filter((l) => !b.data.imagePublicId[l]).map((l) => `${b.id}/${l}`),
);
if (unmapped.length) console.log(`\nBanners without art (gradient fallback): ${unmapped.join(', ')}`);
console.log(apply ? `\nDone: ${written} document(s) written.` : '\nDry run. Re-run with --apply to write.');
