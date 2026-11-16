---
tags: [be-my-hand, docs, m0]
---

# Firestore schema

Tenant data lives under `workspaces/{wid}`, which is the tenant boundary. Outside it are only `users/{uid}` and the platform collections (Home content, media records, admin audit). Rules in `firestore.rules` enforce both boundaries (see [[security]]).

```
users/{uid}                       users v2, see below
banners/{id}                      platform Home carousel (super admin writes)
news/{id}                         platform news
marketingCards/{id}               platform tips / features / stat cards
platformStats/global              aggregate counts shown on Home
appConfig/{support|general}       Support screen config (InstaPay, developer site)
mediaAssets/{id}                  Cloudinary upload records (super admin only)
adminAuditLog/{id}                append-only super admin actions
workspaces/{wid}                  name, description, ownerId, beneficiaryCount, areaCount, cityCount,
                                  sessionCount, createdAt, updatedAt
  members/{uid}                   userId, role, permissions{}, status, joinedAt, inviteCode?, displayName, email
  invites/{code}                  workspaceId, workspaceName, role, permissions{}, createdBy, createdAt,
                                  expiresAt, used, usedBy, usedAt
  cities/{cityId}                 name, nameSearch, isArchived, createdAt, createdBy, updatedAt
  areas/{areaId}                  name, nameSearch, cityId, cityName, description?, isActive,
                                  beneficiaryCount, createdAt, createdBy, updatedAt
  beneficiaries/{bid}             see below
    history/{eventId}             append-only event envelope
    assistanceRecords/{recordId}  type, description, sessionId?, deliveredAt, recordedBy, notes,
                                  confirmationStatus, confirmedAt?, confirmedBy?, createdAt, clientAt
  sessions/{sid}                  see below
    items/{beneficiaryId}         snapshot + status
    events/{eventId}              append-only
  auditLog/{eventId}              append-only
```

## User (v2)

```
displayName (1..80), email?, phone? (E.164 or null), locale? (ar | en),
themePreference? (system | light | dark),
globalRole (user | superadmin), status (active | suspended),
onboarding { step: intro | profile | workspace | done, completedAt },
lastWorkspaceId?, lastLoginAt?, createdAt, updatedAt, schemaVersion (2)
```

- A user creates their own doc with `globalRole == 'user'` and `status == 'active'`; rules reject anything else.
- The owner may change profile fields, onboarding and `lastWorkspaceId`, never `globalRole`, `status`, `email` or `createdAt`. A suspended user cannot write their doc.
- `globalRole: 'superadmin'` is set only by hand in the Firebase console. No client path grants it.
- A super admin may change `status` of other non-super-admin users (suspend / reactivate) and nothing else.
- v1 docs (no `schemaVersion`) are read with safe defaults (`globalRole` falls back to `user`); `scripts/migrate.mts` backfills them (see [[security#Data migration]]).

## Platform collections

All read by any signed-in user (news only when `isPublished`), written only by an active super admin. Text fields are `{ ar, en }`. Normalizers in `src/domain/marketing.ts` default every missing or malformed field, so a bad doc never crashes Home.

| Collection | Fields |
|---|---|
| `banners` | `title`, `subtitle`, `imagePublicId { ar, en }` (Cloudinary public id per language), `gradient?`, `cta { label, type: route \| url, target }?`, `order`, `isActive`, `startsAt?`, `endsAt?` |
| `news` | `title`, `summary`, `body`, `coverImagePublicId?`, `category`, `isPublished`, `isPinned`, `publishedAt` |
| `marketingCards` | `type (stat \| tip \| feature)`, `title`, `subtitle?`, `icon` (fixed set), `statKey?`, `order`, `isActive` |
| `platformStats/global` | `usersCount`, `workspacesCount`, `membersCount`, `sessionsCount`, `updatedAt` (refreshed from the Manage area; display only) |
| `appConfig/support` | `instapayLink`, `instapayAddress`, `message`, `developerName`, `developerWebsite`, `isEnabled`. The seed uses `REPLACE_WITH_*` placeholders, which the app treats as missing. |

**`mediaAssets/{id}`** (super admin read/write, never deleted): `publicId, secureUrl, width, height, format, bytes, version, folder, tags, kind, lang (ar | en | null), label, isArchived, uploadedBy, createdAt, clientAt`. Images are stored in Cloudinary; Firestore only keeps the record. Removing an asset archives the record (and deletes the file with `delete_by_token` only inside Cloudinary's 10-minute window). See [[cloudinary-setup]].

**`adminAuditLog/{id}`** (create-only): `actorId, actorName, action, targetType, targetId, metadata, createdAt, clientAt`. Written in the same batch as the admin change it records.

## Beneficiary

```
workspaceId, fullName, nameSearch, householdCount,
cityId, cityName, areaId, areaName,
residentialAddress, pickupLocation, notes,
phones: [{ id, number (E.164), raw, label?, isPrimary, createdAt (client Timestamp) }]   max 10
primaryPhone        E.164 of the primary phone, or null
phoneDigits         [E.164...] for exact phone search
mapPins: [{ id, lat, lng, label?, description?, createdAt, updatedAt, createdBy }]       max 10
lastConfirmedAssistanceAt, lastConfirmedAssistanceRecordId
isArchived, archivedAt, extra {}, schemaVersion (1),
createdBy, createdAt, updatedAt, updatedBy
```

**Why phones and pins are embedded bounded arrays.** At ~500 beneficiaries, subcollections would multiply reads for every list page and export (1 + phones + pins per beneficiary) and complicate offline use. Embedded arrays capped at 10, each element with a stable `id`, keep reads at 1 per beneficiary, make edits atomic, and work offline. Arrays are rewritten as a whole (last write wins for the array). `serverTimestamp()` cannot be used inside arrays, so element timestamps are client `Timestamp`s. History and assistance stay in subcollections because they grow without bound.

## Session

```
workspaceId, name, cityId, cityName, areaIds[], areaNames[], status (active | ended),
createdBy, operatorId, startedBy, startedAt, endedAt, endedBy,
beneficiaryCount (<= 100), checkedCount, ignoredCount, pendingCount, contactActionsCount,
summary, createdAt, clientAt, lastProcessedAt, updatedAt
```

Sessions are created already `active` in the snapshot batch. `draft` exists in the type for a later "save setup" feature but is not written in v1.

**Item** (`items/{beneficiaryId}`): `beneficiaryId, order, fullName, householdCount, primaryPhone, phones[], areaId, areaName, pickupLocation, residentialAddress, notes, mapPins[], status (pending | checked | ignored), processedAt, processedBy, processedClientAt, note`. The item id equals the beneficiary id, so the same beneficiary cannot appear twice and retries are idempotent. Items are snapshots: later profile edits never rewrite them.

## Event envelope

`id, workspaceId, sessionId?, beneficiaryId?, actorId, actorName, type, createdAt (serverTimestamp), clientAt (device time), metadata { before?, after?, ... }`.

Event types live in `src/domain/events.ts`.

## Query patterns

| Screen | Query | Index |
|---|---|---|
| Workspace switcher | `collectionGroup('members').where('userId','==',uid)` then `getDoc(workspace)` per result | members.userId collection-group override |
| Global list | `beneficiaries.where('isArchived','==',false).orderBy('nameSearch').startAt(q).endAt(q+'\uf8ff').limit(20).startAfter(last)` | (isArchived, nameSearch) |
| Area list | same + `where('areaId','==',id)` | (isArchived, areaId, nameSearch) |
| City filter | same + `where('cityId','==',id)` | (isArchived, cityId, nameSearch) |
| Phone search | `where('isArchived','==',false).where('phoneDigits','array-contains',e164)` | (isArchived, phoneDigits contains) |
| Session snapshot | `where('isArchived','==',false).where('areaId','in',areaIds≤30)` limit 101 | single-field merge |
| Sessions list | `orderBy('createdAt','desc')` (+ `status` filter) | (status, createdAt desc) |
| My sessions (member without history permission) | `where('operatorId','==',uid).orderBy('createdAt','desc')` | (operatorId, createdAt desc) |
| Session items | `items.orderBy('order')` (≤100 docs, one listener) | single-field |
| Areas of a city | `areas.where('cityId','==',id).orderBy('nameSearch')` | (cityId, nameSearch) |
| Beneficiary history | `history.orderBy('createdAt','desc').limit(20)` | single-field |
| Home banners | `banners.where('isActive','==',true).orderBy('order').limit(n)`, `startsAt`/`endsAt` filtered on device | (isActive, order) |
| News list | `news.where('isPublished','==',true).orderBy('publishedAt','desc')`, paginated; pinned items show a tag | (isPublished, publishedAt desc); (isPublished, isPinned, publishedAt desc) is committed for a later pinned-only query |
| Home cards | `marketingCards.where('isActive','==',true).orderBy('order').limit(12)` | (isActive, order) |
| Media library | `mediaAssets.where('isArchived','==',x).orderBy('createdAt','desc')` (+ `kind`) | (isArchived, createdAt desc), (kind, isArchived, createdAt desc) |
| Manage users | `users` paginated by document id, or `where('status','==','suspended')` | single-field; (status, createdAt desc) is committed for a later sort |
| Admin audit | `adminAuditLog.orderBy('createdAt','desc')` | single-field |
| Recent activity | `collectionGroup('history').where('workspaceId','==',wid).orderBy('createdAt','desc').limit(5)` | history collection-group (workspaceId, createdAt desc) |

All indexes are committed in `firestore.indexes.json`.

## Denormalizations

| Field | Copy of | Why | Kept in sync by |
|---|---|---|---|
| `beneficiary.cityName`, `areaName` | city/area name | list rows and exports without extra reads | renaming a city/area updates its beneficiaries in batches of 400 (≈500 docs max) |
| `beneficiary.primaryPhone`, `phoneDigits` | `phones[]` | quick call and exact phone search | written with every phones change |
| `beneficiary.nameSearch` | `fullName` | Arabic-normalized prefix search | written with every name change |
| `area.cityName` | city name | area pickers | city rename batch |
| `workspace.*Count`, `area.beneficiaryCount` | counts | dashboard without counting reads | `increment()` in the same batch as create/archive/move; admin "recount" repairs drift |
| `session.*Count` | items | progress without reading items | `increment()` with each Check/Ignore/reopen; recounted from items on End |
| `member.displayName`, `email` | user profile | member lists without reading `users/*` (not readable by others) | written on join |
| `invite.workspaceName` | workspace name | join screen can show the name before membership | written on invite creation |
| Session items | beneficiary | field snapshot, history preservation | never synced (by design) |

## Security boundaries

- Only members of a workspace read anything under it. Membership = `members/{uid}` with `status == 'active'`.
- Invites are fetched by code (`get`), never listed except by managers.
- `users/{uid}` is private to its owner; an active super admin can read it and change `status` only.
- The super admin reads workspace metadata and memberships, never anything under a workspace (beneficiaries, sessions, history). Tests in `tests/rules/admin.test.ts` pin this.
- See [[security]].

## Expected growth

| Collection | Size |
|---|---|
| beneficiaries | ~500 per workspace |
| areas / cities | tens |
| sessions | a few per month, ≤100 items each |
| history | grows with every change; paginated |
| auditLog | grows slowly (membership, imports, exports) |
| users | one per account |
| banners / news / marketingCards | tens |
| mediaAssets, adminAuditLog | grow slowly with admin work; paginated |

## Historical preservation

- Events (`history`, `events`, `auditLog`) are create-only in rules.
- Session items are snapshots and ended sessions are immutable.
- Beneficiaries, cities and areas are archived, never deleted.
- Assistance records are never deleted; only `unconfirmed → confirmed`.
