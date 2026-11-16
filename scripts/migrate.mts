/**
 * One-off data migration for refactor v3/v4. Runs on the developer machine only.
 *
 *   Emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate.mts --project demo-be-my-hand [--apply]
 *   Live:      GOOGLE_APPLICATION_CREDENTIALS=/path/outside/repo/key.json node scripts/migrate.mts --project bemyhand-8de0e [--apply]
 *
 * Dry run by default (prints what would change). Idempotent: running it twice changes nothing
 * the second time. The service-account key must never be committed or bundled into the app.
 *
 * Steps:
 *  1. users v2 backfill: globalRole 'user', status 'active', schemaVersion 2 (never touches an existing role).
 *  2. onboarding backfill: users with an active membership get onboarding { step: 'done', completedAt }.
 *  3. workspaceId audit on tenant docs that carry the field; mismatches are fixed to the parent path id.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentReference, type Firestore } from 'firebase-admin/firestore';

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
const db: Firestore = getFirestore();

type Change = { ref: DocumentReference; data: Record<string, unknown>; reason: string };
const changes: Change[] = [];

async function backfillUsers(): Promise<void> {
  const members = await db.collectionGroup('members').where('status', '==', 'active').get();
  const withMembership = new Set(members.docs.map((d) => d.get('userId') as string));
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const data = user.data();
    const patch: Record<string, unknown> = {};
    if (data.globalRole === undefined) patch.globalRole = 'user';
    if (data.status === undefined) patch.status = 'active';
    if (data.schemaVersion !== 2) patch.schemaVersion = 2;
    if (data.onboarding === undefined && withMembership.has(user.id)) {
      patch.onboarding = { step: 'done', completedAt: FieldValue.serverTimestamp() };
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = FieldValue.serverTimestamp();
      changes.push({ ref: user.ref, data: patch, reason: `users v2 (${Object.keys(patch).join(', ')})` });
    }
  }
}

// Collections whose documents store their own workspaceId.
const SCOPED = ['beneficiaries', 'history', 'assistanceRecords', 'sessions', 'events', 'auditLog', 'invites'];

function workspaceOf(ref: DocumentReference): string | null {
  const parts = ref.path.split('/');
  return parts[0] === 'workspaces' ? parts[1] : null;
}

async function auditWorkspaceIds(): Promise<void> {
  for (const name of SCOPED) {
    const snapshot = await db.collectionGroup(name).get();
    for (const docSnap of snapshot.docs) {
      const expected = workspaceOf(docSnap.ref);
      if (!expected) continue;
      const actual = docSnap.get('workspaceId');
      if (actual !== expected) {
        changes.push({
          ref: docSnap.ref,
          data: { workspaceId: expected },
          reason: `workspaceId ${actual === undefined ? 'missing' : `'${String(actual)}'`} -> '${expected}'`,
        });
      }
    }
  }
}

async function main() {
  await backfillUsers();
  await auditWorkspaceIds();
  for (const change of changes) console.log(`${apply ? 'APPLY' : 'DRY  '} ${change.ref.path}: ${change.reason}`);
  if (apply) {
    for (let i = 0; i < changes.length; i += 400) {
      const batch = db.batch();
      changes.slice(i, i + 400).forEach((change) => batch.set(change.ref, change.data, { merge: true }));
      await batch.commit();
    }
  }
  console.log(`${changes.length} change(s) ${apply ? 'applied' : 'found (dry run, add --apply to write)'} on ${projectId}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
