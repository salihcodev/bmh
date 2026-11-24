---
tags: [be-my-hand, docs, m0]
---

# Security

Security is enforced by `firestore.rules`. The app's `can()` layer (`src/services/permissions/can.ts`) mirrors the rules to hide or disable actions, but it is never trusted. The app has no Admin SDK credentials or service accounts.

## Roles

- **Owner**: creator of the workspace. Exactly one. Everything an Admin can do, plus transfer ownership and delete the workspace. Cannot leave or be removed until ownership is transferred.
- **Admin**: full operational access.
- **Member**: only the permissions explicitly granted on their `members/{uid}` doc.

## Permission matrix (defaults, changeable)

Source of truth: `src/services/permissions/matrix.ts`. Keys use underscores so they are safe Firestore field paths.

| Key | Owner | Admin | Member default |
|---|---|---|---|
| `beneficiaries_view` | yes | yes | yes |
| `beneficiaries_create` | yes | yes | no |
| `beneficiaries_edit` | yes | yes | no |
| `beneficiaries_archive` | yes | yes | no |
| `beneficiaries_export` | yes | yes | no |
| `beneficiaries_import` | yes | yes | no |
| `areas_manage` | yes | yes | no |
| `members_manage` | yes | yes | no |
| `sessions_create` | yes | yes | no |
| `sessions_run` | yes | yes | no |
| `sessions_reassign` | yes | yes | no |
| `sessions_view_history` | yes | yes | yes |
| `assistance_record` | yes | yes | no |
| `history_view` | yes | yes | yes |

> [!warning] `members_manage` is powerful
> A Member granted `members_manage` can edit other non-owner members (including making them Admin). Nobody can edit their own role or permissions.

## Rule helpers

- `isMember(wid)`: `members/{uid}` exists and `status == 'active'`.
- `hasPerm(wid, perm)`: Owner/Admin, or `permissions[perm] == true`.
- `isOwnerOrAdmin(wid)`, `isOwner(wid)`.

Each helper does a `get()` on the member doc. Firestore caches identical `get()` calls within one request, and at this scale the extra read per evaluation is acceptable.

## What the rules enforce

**Members**
- Created only by (a) the owner bootstrap batch (workspace does not exist before, `ownerId == uid` after) or (b) invite redemption (`get` invite: unused and unexpired; `getAfter` invite: used by me; role and permissions copied exactly).
- Nobody edits their own role or permissions. Managers edit others, never the Owner doc.
- Owner doc cannot be deleted. Ownership transfer is one batch: workspace `ownerId` moves, target becomes `owner`, previous owner becomes `admin`.

**Invites**
- `get` by any signed-in user who knows the code (≥24 random chars from `expo-crypto`). `list` only for managers (deviation: lets admins see and revoke pending invites; see [[open-product-decisions]]).
- Created only by `members_manage`; expiry must be in the future and under 31 days.
- Redemption only flips `used/usedBy/usedAt`, only to the caller, only with the caller's member doc in the same batch. Revoke = delete.

**Beneficiaries**
- Field types and sizes validated; `workspaceId` must match the path.
- `phones` and `mapPins` ≤ 10; `phoneDigits.size() == phones.size()`; `primaryPhone` must be in `phoneDigits` (or null with no phones).
- Profile edits cannot touch `isArchived` or `lastConfirmedAssistanceAt`.
- `lastConfirmedAssistanceAt` changes only alongside a confirmed assistance record (checked with `getAfter`) whose `deliveredAt` matches.
- Never deleted.

**Sessions**
- Create: `sessions_create`, `status == 'active'`, `1 ≤ beneficiaryCount ≤ 100`, counters zero, operator = creator.
- Items: created only in the batch that creates the session; transitions only `pending → checked|ignored` and `ignored → pending`; only by the operator or `sessions_reassign` holder; only while active.
- Reassign: `sessions_reassign`, target must be an active member.
- Ended sessions are immutable. Sessions are never deleted.

**Append-only**: `history`, `events`, `auditLog`, and assistance records allow no delete; events allow no update. `actorId == uid` and `createdAt == request.time` on create.

**Users (schema v2)**: `users/{uid}` is readable by that user and by an active super admin. Fields are whitelisted. On create, `globalRole` must be `'user'` and `status` `'active'`. The owner can never change their own `globalRole`, `status`, `email` or `createdAt`, and a suspended account cannot edit its profile. The super admin can change only `status` (and `updatedAt`) of other users.

**Default deny**: anything not matched is denied.

## Platform roles (super admin)

Platform roles are separate from workspace roles. `users/{uid}.globalRole` is `'user'` or `'superadmin'`; platform permissions (`platform_manage_users`, `platform_manage_content`, `platform_manage_media`, `platform_view_reports`) live in `src/services/permissions/platform.ts` and only `superadmin` holds them.

`isSuperAdmin()` in the rules requires `globalRole == 'superadmin'` **and** `status == 'active'`. It costs one billed read, so it is used only on rare paths: platform content (`banners`, `news`, `marketingCards`, `platformStats`, `appConfig`: read for signed-in users, write for the super admin), `mediaAssets` and `adminAuditLog` (super admin only; the log is create-only with `actorId == uid`), and user management.

**Granting super admin (console only, no client path exists):**
1. Firebase console > Firestore > `users` > the user's document.
2. Set `globalRole` to `superadmin` (string) and make sure `status` is `active`.
3. The user restarts the app; the Manage card appears in Settings.

Revoke by setting `globalRole` back to `user`.

**Privacy boundary:** the super admin can read workspace metadata (`workspaces/{wid}`: name, owner, counters) and memberships, but **not** beneficiaries, sessions, history, assistance records or invites of any workspace they are not a member of. The tenant rules do not mention the super admin at all. See [open-product-decisions](open-product-decisions.md).

**Suspended users:** blocked by the app gate (`/suspended` screen with sign-out). The rules additionally block profile edits and platform writes by suspended accounts. Workspace rules do not check suspension, because that would add one billed read to every tenant request; a suspended user is effectively locked out by the app, and an owner can disable their membership for a hard stop.

## Tenant isolation guarantees

1. **Server:** every workspace path requires an active membership (`isMember`) and writes require the specific permission (`hasPerm`). Collection-group reads are allowed only for `members` where `userId == uid` (or the super admin) and `history` where the caller has `history_view` in that workspace. Documents store `workspaceId`, which must match the path.
2. **Client scoping:** `WorkspaceProvider` exposes a `workspaceId` only when a membership doc for the current user exists. `useActiveWorkspace()` throws instead of falling back to an empty id. The provider is remounted per uid (`key={uid}`), so no state crosses accounts.
3. **Device isolation:** per-user device data lives under `u:{uid}:` MMKV keys; outbox jobs carry their `uid`; every Firestore listener goes through `services/firebase/listeners.ts` so it can be stopped at once.

## Sign-out procedure

`useSignOut()` (`src/features/auth/use-sign-out.ts`) runs:

1. `checkPendingWrites()`: waits up to 2.5 s for `waitForPendingWrites`. If writes are still pending (offline), the user is warned that signing out discards them and can cancel.
2. `resetSession()` (`src/services/session/reset.ts`): unsubscribe every listener, sign out of Google and Firebase Auth, reset in-memory stores, delete the user's MMKV keys and outbox jobs, `terminate(db)` + `clearPersistence(db)`, then reload the JS runtime.

If a session ends without this procedure (revoked token, crash), the auth listener compares the new uid with `session.lastUid` and purges the device before showing anything. Builds before this change never cleared the cache, so the first launch without a signed-in user purges once (`session.cacheVersion`).

## Deploying rules

The live project ran the console's test-mode rule (`allow read, write: if request.time < 2026-12-16`) until **2026-11-16**, when the repository rules were deployed with:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project bemyhand-8de0e   # = pnpm deploy:rules
```

The super-admin suspension hardening (R4) was deployed on 2026-11-16 at 22:31 UTC. Right after, the live release (`cloud.firestore`, ruleset `b9a41bd3-…`) was read back through the Firebase Rules API and is byte-identical to `firestore.rules`. All 15 composite indexes are live.

Verify after every deploy: Firebase console > Firestore > Rules shows the repository file (it ends with `match /{document=**} { allow read, write: if false; }`). CI runs the rules suite on every push; deploy only from a green commit.

## Data migration

`pnpm data -- --migrate` (`scripts/data.mts`) backfills users v2, onboarding and `workspaceId` (dry run by default, `--apply` to write, idempotent). Run it on the emulator first. For the live project use a service-account key stored **outside the repository** (`GOOGLE_APPLICATION_CREDENTIALS=/abs/path/key.json pnpm data -- --migrate --project bemyhand-8de0e --apply`) and delete the key afterwards. The app never contains Admin credentials.

## Tests

`tests/rules/*.test.ts` run against the Firestore emulator (`pnpm test:rules`, Java 21+): workspace and member RBAC, invites, beneficiaries, sessions, cross-tenant isolation (`isolation.test.ts`), users v2 (`users.test.ts`) and platform/admin collections including the super admin privacy boundary (`admin.test.ts`). `RULES_FILE=tests/rules/fixtures/deployed-test-mode.rules` runs the suite against the old live ruleset (51 of 52 isolation tests fail there, which is the reproduction of the incident). Results are recorded in [APP_PROGRESS](../APP_PROGRESS.md). The rules were not exercised by a live client after deployment yet.

## V6: audit log and sync health

- `adminAuditLog` create validates the whole v2 shape (`hasOnly`/`hasAll`, string sizes, `platform` in ios/android/web, `summary` map with only `before`/`after`), requires a staff user, `actorId == uid`, and `createdAt == request.time`. The 2 KB summary limit is enforced by the client. Entries are never updated or deleted. Old app builds that write the v1 shape are rejected, so ship the app before or with the rules.
- `syncHealth/{uid}_{deviceId}`: the document id must equal `uid + '_' + deviceId`; counts are integers 0..100000; timestamps are numbers or null; `updatedAt` is the server time. Create needs an active user; update also needs 30 seconds since the last update; read needs `sync-queue.view` (moderator and owner, not support); delete needs `sync-queue.manage` (owner). Emulator tests: `tests/rules/monitoring.test.ts`, `tests/rules/admin.test.ts`.
