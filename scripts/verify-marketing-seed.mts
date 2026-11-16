/**
 * Emulator-only check for seed-marketing.mts: reads the seeded docs back through the app's
 * normalizers (src/domain/marketing.ts) and fails on anything the app would not render.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/verify-marketing-seed.mts --project demo-be-my-hand
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  bannerSchema,
  isPlaceholder,
  marketingCardSchema,
  newsSchema,
  parseDoc,
  resolveCta,
  supportConfigSchema,
  visibleBanners,
} from '../src/domain/marketing.ts';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Emulator only: set FIRESTORE_EMULATOR_HOST.');
  process.exit(1);
}
const projectIndex = process.argv.indexOf('--project');
initializeApp({ projectId: process.argv[projectIndex + 1] ?? 'demo-be-my-hand' });
const db = getFirestore();
const problems: string[] = [];

const banners = (await db.collection('banners').where('isActive', '==', true).orderBy('order').get()).docs.map((d) =>
  parseDoc(bannerSchema, d.id, d.data()),
);
const visible = visibleBanners(banners, Date.now());
if (visible.length === 0) problems.push('no visible banners');
for (const b of visible) {
  if (!b.title.ar || !b.title.en) problems.push(`banner ${b.id}: missing title`);
  if (b.cta && !resolveCta(b.cta)) problems.push(`banner ${b.id}: CTA "${b.cta.target}" is not an allowed destination`);
}

const news = (await db.collection('news').where('isPublished', '==', true).orderBy('publishedAt', 'desc').get()).docs.map((d) =>
  parseDoc(newsSchema, d.id, d.data()),
);
if (news.length === 0) problems.push('no published news');
for (const n of news) if (!n.publishedAt) problems.push(`news ${n.id}: missing publishedAt`);

const cards = (await db.collection('marketingCards').where('isActive', '==', true).orderBy('order').get()).docs.map((d) =>
  parseDoc(marketingCardSchema, d.id, d.data()),
);
const support = supportConfigSchema.parse((await db.doc('appConfig/support').get()).data() ?? {});
if (support.isEnabled && isPlaceholder(support.instapayLink) && isPlaceholder(support.instapayAddress)) {
  problems.push('support is enabled but still has placeholder payment details');
}
const stats = await db.doc('platformStats/global').get();
if (!stats.exists) problems.push('platformStats/global missing');

console.log(`banners ${visible.length}, news ${news.length}, cards ${cards.length}, support enabled ${support.isEnabled}`);
if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
  process.exit(1);
}
console.log('OK: seeded content parses and renders.');
