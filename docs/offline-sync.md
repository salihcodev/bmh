---
tags: [be-my-hand, docs, offline]
---

# Offline and sync

**Principle:** Firestore's native persistence (React Native Firebase) is the local cache and the write queue. There is no second database.

## Layers

| Concern | Implementation |
|---|---|
| Local cache | RN Firebase native persistence, `cacheSizeBytes` 100 MB (`src/services/firebase/client.ts`) |
| Firestore write queue | Native. Writes are applied to the cache immediately and sent when online. |
| Optimistic UI | Writes are committed with `commitInBackground()` (`src/services/firebase/write.ts`). The UI never awaits server acknowledgement in offline-capable flows. |
| Pending count | `commitInBackground()` tracks in-flight batches; `onSnapshotsInSync` and NetInfo feed `useSyncStatus()` |
| Failures | A rejected batch (for example a rules denial after reconnect) is stored in the sync store with its label and shown in the sync sheet with Retry / Dismiss. Nothing is dropped silently. |
| Connectivity | `@react-native-community/netinfo` (`src/services/sync/connectivity.ts`) |
| Non-Firestore jobs | MMKV outbox (`src/services/sync/outbox.ts`) |

## Sync status UI

The global sync pill (`src/components/layout/sync-pill.tsx`) shows one of:

- **Offline**: no connection; "N changes waiting to sync" if any.
- **Syncing / N changes waiting to sync**: online with pending writes.
- **All changes synced**.
- **Sync problem**: a write was rejected; tap to see details and retry or dismiss.

The UI also says "syncs when the app is open".

## Background reality

True background sync is unreliable on iOS and restricted on Android. Sync runs while the app is open and online. No background task is relied on.

## Timestamps

Every audit write stores `createdAt: serverTimestamp()` and `clientAt` (device time). Offline, the server timestamp resolves at sync time; `clientAt` records when it happened. `serverTimestamp()` is not allowed inside array elements, so phones and pins use client `Timestamp`s. Firestore is configured with `serverTimestampBehavior: 'estimate'` so pending timestamps render.

## Conflicts

Last write wins per field: edits use `update()` with only the changed fields. Phones and pins arrays are rewritten whole (last write wins as a unit). Every change logs a history event with before/after values.

## Transactions

Transactions do not work offline and are not used anywhere. Batched writes, deterministic ids (session item id = beneficiary id, invite code = doc id) and idempotent operations are used instead.

## Outbox

`services/sync/outbox.ts` is a typed persistent queue in MMKV for work that is not a plain Firestore write. Job fields: `id`, `type`, `payload`, `idempotencyKey`, `attempts`, `nextRetryAt`, `status`, `lastError`.

- Flushed on app launch, app foreground, and NetInfo reconnect.
- Exponential backoff (2s base, ×2, capped at 10 minutes), max 8 attempts, then `failed` (visible in the sync sheet).
- Enqueuing with an existing `idempotencyKey` returns the existing job.
- Current job types: `password_reset` (when requested offline). Ordinary Firestore writes are never put in the outbox.

## What needs a connection

Register, first login, password reset (queued in the outbox if offline), joining a workspace by invite, starting a session (fresh snapshot), and Excel/CSV import. The app checks connectivity first and shows "connect to continue".

## What works offline

Browse and search cached beneficiaries (only cached documents are visible; a hint says so), view details, call, open pins in Maps, edit beneficiaries, run an active session (Check / Ignore / reopen / notes), view session progress, end a session (finalizes from cached items), and export from cache (labelled "from local data, may be out of date").

## Prepare for offline

When a session starts, the snapshot batch writes every item to the local cache. Each item carries what the runner needs (name, household, phones, pickup, address, notes, pins), so the runner works fully offline from items alone. The session screen keeps one listener on `items`, and while online it prefetches the live beneficiary docs once per session per app run (≤100 reads, `usePrefetchSessionBeneficiaries`) so "View details" also opens offline.

**Before going to the field:** open the app online, open each active session once, and open the beneficiary list for the areas you will visit. Anything never loaded on this device is not in the cache.

## Known limitations

- **Rejected writes after a restart.** A batch rejected by the server (for example a permission revoked while the device was offline) is shown in the sync sheet with Retry. If the app was killed before the server answered, the native SDK still sends the write on next launch, but a rejection then is not surfaced (the in-memory failure list starts empty). The sync pill shows "waiting" until `waitForPendingWrites` resolves.
- **Session history without `beneficiaries_view`.** An operator who lacks `beneficiaries_view` processes items normally, but the per-beneficiary `session_checked`/`session_ignored` history event is skipped (rules require that permission). Session events are always written.
- **Audit for create/join is written after the commit.** The `workspace_created` and `member_joined` audit events need the member doc to exist first, so they are a second write. If the app dies in between, the workspace/membership exists without its audit line.
- **Renames need two permissions.** Renaming a city or area rewrites denormalized names on beneficiaries, so it needs `areas_manage` **and** `beneficiaries_edit`, and a connection.
- **Counters can drift** under concurrent offline edits (for example two devices archiving the same beneficiary). They are display only; "Recount" on the workspace screen repairs them.
- **Offline lists show cached documents only.** Search and pagination offline cover what this device has loaded before. The list's search hint switches to the offline wording when data came from cache, and the details screen shows "may be out of date".
- **Session end offline** recounts from the cached items. If another device processed items that never reached this device, the counters are corrected only when both devices sync; item statuses are always authoritative.
- **No background sync.** Writes are sent while the app is open and online.
- **Tested where:** offline behaviour is covered by unit tests with a simulated offline SDK (`tests/session-offline.test.ts`) and by rules tests on the emulator. It has **not** yet been verified on a physical device in airplane mode or against a live Firebase project.
