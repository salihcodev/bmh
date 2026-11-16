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

**Users**: `users/{uid}` readable and writable only by that user; limited fields.

**Default deny**: anything not matched is denied.

## Tests

`tests/firestore.rules.test.ts` runs against the Firebase Emulator Suite (`pnpm test:rules`, needs Java 21+). Results and dates are recorded in [[../APP_PROGRESS|APP_PROGRESS]]. These tests have not been run against a live project.
