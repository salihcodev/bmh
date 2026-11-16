# Refactor plan (prompts v3 + v4)

Status of each milestone is tracked in [APP_PROGRESS.md](../APP_PROGRESS.md). This file records the audit findings and the order of work.

## 1. Findings: cross-user data access

### 1.1 Server side: the live project runs test-mode rules (root cause)

Evidence, read on 2026-11-16 from the Firebase Rules API (`GET projects/bemyhand-8de0e/releases`):

- Release `cloud.firestore` points at ruleset `f60030b7-f295-4cb9-bd5d-68eb08a233d3`, created `2026-11-16T18:25:48Z`.
- Its source is the console's default test-mode rule:

```
match /{document=**} {
  allow read, write: if request.time < timestamp.date(2026, 12, 16);
}
```

Any client (signed in or not) can read and write every document of every workspace until 2026-12-16, after which every request is denied. `firestore.rules` in this repository is correct (default deny, `isMember`/`hasPerm`), but it was never deployed: `APP_PROGRESS.md` lists "Deploy `firestore.rules` and `firestore.indexes.json`" as open.

**Fix:** deploy the repository rules (`pnpm deploy:rules`) and keep the rules suite in CI. See [security.md](security.md#deploying-rules).

### 1.2 Client side: nothing isolates two accounts on the same device

Even with correct rules, the device leaked data between accounts:

| Problem | Where | Effect |
|---|---|---|
| Firestore persistence never cleared | `src/services/firebase/client.ts`, `auth-provider.tsx` `signOutUser` | 100 MB cache of user A stays on disk; the local cache does not evaluate rules, so cache-served snapshots can show A's documents to B. |
| Workspace state not reset on user change | `src/providers/workspace-provider.tsx` | `memberships`/`workspaces` keep A's values; workspace-doc listeners are built from raw `memberships`, so A's workspace docs stay subscribed after sign-out and while B's memberships load. |
| Empty workspace fallback | `useActiveWorkspace()` returns `wid: ''` | Screens could run without a verified membership. |
| Storage keys not namespaced by uid | `preferences.v1.lastWorkspaceId`, outbox (`appStorage`) | A's last workspace and queued jobs survive into B's session. |
| In-memory stores not reset | `useSyncStore` | A's sync failures and retry closures stay visible to B. |
| No pending-writes check on sign-out | `signOutUser` | Unsynced offline writes silently lost or sent under the wrong context. |

**Fix:** `resetSession()` (unsubscribe listener registry, reset stores, delete uid-namespaced keys, `terminate` + `clearPersistence`, then `signOut`), uid-keyed providers, a `(ws)` route group that only renders once a verified membership exists.

### 1.3 Rules hardening

- `users/{uid}` gains the v2 fields (`globalRole`, `status`, `onboarding`, `themePreference`, `lastLoginAt`, `updatedAt`, `schemaVersion`). Clients can never set their own `globalRole` or `status`.
- Platform super admin = `users/{uid}.globalRole == 'superadmin'` and `status == 'active'`, granted only in the Firebase console.
- The super admin does **not** get access to tenant data (beneficiaries, sessions, history, assistance). See [open-product-decisions.md](open-product-decisions.md).
- `invites/{code}` `get` for any signed-in user stays: the code is a 24+ character random secret and the invite only contains the workspace name and role.

## 2. Screen inventory

| Screen | Problems against the UX rules | Target |
|---|---|---|
| `(tabs)/index` dashboard | Workspace data on Home; teal theme; no skeletons | Becomes **Activities** hub; Home becomes marketing |
| `(tabs)/beneficiaries` | Separate tab; plain list | Global beneficiary list route reachable from Activities |
| `(tabs)/sessions` | Load-limited list | Active session card + infinite history grouped by date |
| `(tabs)/more` | Mixed menu | **Settings** grouped rows + Manage card (super admin) |
| — | No profile tab | **Profile** tab (avatar with lime ring, Personal info card) |
| `complete-profile`, `onboarding/*`, `join` | Not resumable, no intro, separate screens | One onboarding flow: intro, profile, workspace, done |
| `(auth)/*` | Teal styling | Brand mark, filled fields, dark pill CTA |
| `areas/[areaId]`, `cities/*` | Top-right primary actions | Sticky search, white rounded list card, pinned CTA |
| `beneficiaries/[id]`, `new`, `edit` | Long flat forms | Grouped cards, sticky save bar |
| `members/*` | Plain list | Role badges, permission editor in a sheet |
| `sessions/new`, `sessions/[sid]` | Small buttons | Stepper with selectable cards; field mode with thumb-zone Check/Ignore |
| `import`, `export`, `audit`, `workspace`, `settings` | Ad-hoc styles | Shared components, all states |

All screens use the shared `components/ui` set. Restyling that set to the reference tokens re-skins every screen at once; screens then get structural fixes.

## 3. Order of work

1. **R0** security: failing tests, rules, client isolation, sign-out, migration, deploy, docs.
2. **R1** design system (tokens, fonts, components, pagination hook, `/dev/design-system`).
3. **R2** splash, route guard, onboarding.
4. **R3** Cloudinary helper, 5-tab shell, marketing Home.
5. **R4** super admin Manage area (media, banners, users, audit).
6. **R5–R8** Activities, lists and forms, sessions, support/settings/profile.
7. **R9** QA and docs.

Risks: `clearPersistence` requires a terminated instance (handled by reloading the JS runtime after clearing); route moves touch every screen (URLs are stable because route groups do not change paths).

## 4. Dependency changes

| Package | Why |
|---|---|
| `@expo-google-fonts/space-grotesk` | Latin/numeral brand font |
| `expo-image` | Cached Cloudinary images with blur placeholders |
| `expo-image-picker` | Pick images for the media library upload |
| `react-native-qrcode-svg` | InstaPay QR on the Support screen |
| `expo-clipboard` | Copy public IDs, URLs and support links |
| `expo-linear-gradient` | Banner and image fallbacks |
| `expo-haptics` | Feedback on session Check/Ignore |
| `firebase-admin` (dev) | Local migration and seed scripts only |

IBM Plex Sans Arabic stays (weight 600 added). No Cloudinary SDK: uploads use `XMLHttpRequest`, URLs come from a pure helper.

## 5. Migration

`scripts/migrate.ts` (local, `firebase-admin`, credentials from `GOOGLE_APPLICATION_CREDENTIALS`, never committed). Dry run by default, `--apply` to write, idempotent:

- `workspaceId` audit on beneficiaries, sessions, history, assistance records, events.
- `users` v2 backfill: `globalRole: 'user'`, `status: 'active'`, `schemaVersion: 2`.
- `onboarding.completedAt` for users that already have an active membership.

The client also treats a profile without `onboarding` but with a membership as complete.

## 6. Open questions

- The mapping of the 5 known Cloudinary public IDs to the 8 banner concepts must be confirmed by the developer (see `src/config/cloudinaryAssets.ts`).
- The unsigned upload preset name must be created in Cloudinary and set in `.env`.
