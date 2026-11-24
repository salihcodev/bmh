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
appConfig/{support|home|store}    developer credit (About), Home layout, store counts
supportMethods/{id}               payment / donation methods on the Support screen
systemMessages/{key}              texts the app shows, with local fallbacks
media/{id}, mediaOrphans/{id}     Cloudinary upload records and files to clean by hand
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
- v1 docs (no `schemaVersion`) are read with safe defaults (`globalRole` falls back to `user`); `pnpm data -- --migrate` (`scripts/data.mts`) backfills them (see [[security#Data migration]]).

## Platform collections

All read by any signed-in user (news only when `isPublished`), written only by an active super admin. Text fields are `{ ar, en }`. Normalizers in `src/domain/marketing.ts` default every missing or malformed field, so a bad doc never crashes Home.

| Collection | Fields |
|---|---|
| `banners` | `title`, `subtitle`, `imagePublicId { ar, en }` (Cloudinary public id per language), `gradient?`, `cta { label, type: route \| url, target }?`, `order`, `isActive`, `startsAt?`, `endsAt?` |
| `news` | `title`, `summary`, `body`, `coverImagePublicId?`, `category`, `isPublished`, `isPinned`, `publishedAt` |
| `marketingCards` | `type (stat \| tip \| feature)`, `title`, `subtitle?`, `icon` (fixed set), `statKey?`, `order`, `isActive` |
| `platformStats/global` | `usersCount`, `workspacesCount`, `membersCount`, `sessionsCount`, `updatedAt` (refreshed from the Manage area; display only) |
| `appConfig/support` | `developerName`, `developerWebsite` only (About screen; writing needs `app-settings.manage`). The payment details that used to live here are `supportMethods`; the seed copies real values from the old document or `.env.scripts`. `REPLACE_WITH_*` placeholders are treated as missing. |

**Media** is the `media` collection described under [[#Media]] (it replaces `mediaAssets`). Firestore keeps public IDs and metadata only, never URLs. Removing a record soft-deletes it; the file stays in Cloudinary and is listed in `mediaOrphans` for manual cleanup. See [[cloudinary-setup]].

**Soft delete.** Banners, news, system messages and support methods carry `isDeleted`, `deletedAt`, `deletedBy`; the admin audit entry is written in the same batch. Lists filter deleted items on the device.

**`adminAuditLog/{id}`** (create-only, v2 since V6): `actorId, actorName, actorAvatarPublicId?, action, icon, targetType, targetId, targetName?, workspaceId?, summary { before?, after? }, metadata, platform, appVersion, createdAt, clientAt`. Written in the same batch as the admin change it records. See the v5 section for limits. Workspace city, area and beneficiary changes are logged in the workspace `auditLog` and per-beneficiary `history`.

**`syncHealth/{uid}_{deviceId}`**: per-device outbox counts written by the client (never payloads). See the v5 section.

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
| Media library | `media.where('isDeleted','==',x).orderBy('createdAt','desc')` (+ `entityType`) | see the Indexes list below |
| System messages (dashboard) | one query per category: `systemMessages.where('category','==',c).orderBy('createdAt','desc')` (the rules cannot prove `in` queries) | (category, createdAt desc) |
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
| media, mediaOrphans, adminAuditLog | grow slowly with admin work; paginated |

## Historical preservation

- Events (`history`, `events`, `auditLog`) are create-only in rules.
- Session items are snapshots and ended sessions are immutable.
- Beneficiaries, cities and areas are archived, never deleted.
- Assistance records are never deleted; only `unconfirmed → confirmed`.

---

## v5 plan (draft, V0-05)

> [!warning] Draft for review
> The target for phases V2 to V10 of [[../APP_PROGRESS#Refactor v5 (V0–V12)]]. Live data is wiped and reseeded (D-03), so every change here is a schema change, not a migration. Permission keys come from [[permissions-catalog]].

> [!note] Built in V2 (users v3, RBAC docs, workspace roles, `supplierRequests`), with these differences
> - No `holdersCount` on roles. The app refuses to delete a role that still has holders (a `members` query on `roleId`, limit 1) and the roles list counts holders from the members it already loads. Deleting is a soft delete, and members left on a deleted role lose its keys in rules.
> - Members hold `roleId` only (no `roleName`); invites hold `roleId` + `roleName`.
> - The platform owner reads tenant records read-only through `workspaces.data-view`; Support and Moderator cannot read them.
> - Writes to a soft-deleted workspace are not blocked in rules yet; `isArchived` and the presets UI come with V3, `suppliers/{uid}` profiles with V7.
> - Legacy v2 user docs fail `validProfile`, so live needs the wipe and reseed.

### Conventions (all new collections)

- Bilingual text is `{ ar, en }`. Images are Cloudinary `publicId`s, never URLs.
- Soft delete: `isDeleted (bool)`, `deletedAt`, `deletedBy`. Lists query `where('isDeleted','==',false)`. Rules allow `isDeleted: false → true` only with the entity's `.delete` key (or baseline ownership), and never hard `delete`.
- Every create sets `createdAt == request.time` and `createdBy == uid()`; every update sets `updatedAt`, `updatedBy`.
- Every delete, role change and permission change writes an `adminAuditLog` (system) or `auditLog` (workspace) entry in the **same batch**; rules check the entry with `getAfter` where the action is sensitive (role assignment, user type change, suspension).
- Money is an integer in piasters (`priceMinor`, 1 EGP = 100), `currency: 'EGP'`. No floats in totals.

### Collection map

```
users/{uid}                              v3 (below)
supplierRequests/{uid}                   one per user: status, message, reviewedBy, reviewedAt
permissions/{key}                        catalog, read-only for clients (seed writes)
permissionGroups/{groupId}               name{ar,en}, scope, order
permissionPresets/{presetId}             name{ar,en}, scope, permissions[], isDeleted
systemRoles/{roleId}                     name{ar,en}, permissions[], isLocked, holdersCount, isDeleted
workspaces/{wid}                         + isArchived, isDeleted, chat summary fields
  members/{uid}                          role → roleId (+ roleName denormalized)
  roles/{roleId}                         name{ar,en}?, name, permissions[], isLocked, holdersCount, isDeleted
  invites/{code}                         role, permissions{} → roleId, roleName
  chat/{messageId}                       workspace chat messages
  chatReads/{uid}                        lastReadAt per member
  ... cities, areas, beneficiaries, sessions, auditLog unchanged except permission keys
media/{id}                               replaces mediaAssets
mediaOrphans/{id}                        publicIds no longer referenced
systemMessages/{key}                     doc id = message key
supportMethods/{id}
pages/{slug}                             About, Help, legal page bodies
appConfig/home                           Home sections config
appConfig/store                          popular counts, featured ids
banners, news, marketingCards            unchanged shape; + isDeleted, rules on content keys
storeCategories/{id}                     two levels
storeItems/{id}
suppliers/{uid}                          supplier profile, doc id = supplier uid
  reviews/{reviewerUid}                  one per user per supplier by doc id
bags/{bagId}
  items/{itemId}                         current lines (bounded, ≤ 100)
  changes/{changeId}                     append-only change log
  versions/{n}                           snapshot per restore point
  participants/{uid}                     link redemption + lastSeenVersion
bagLinks/{token}                         token → bagId, get only
conversations/{cid}                      supplier 1:1, cid = `${userUid}_${supplierUid}`
  messages/{messageId}
adminAuditLog/{id}                       v2 entry shape
syncHealth/{uid}_{deviceId}              per-device queue summary
rollups/{yyyy-mm-dd}                     daily counters
counters/global                          running totals
activeDays/{yyyy-mm-dd}/users/{uid}      one create per user per day (DAU via count())
```

`platformStats/global` is replaced by `counters/global`. `mediaAssets` is replaced by `media` (no copy step because of the wipe).

### Users v3

```
displayName, email?, phone?, locale?, themePreference?, avatarPublicId?,
userType (owner | support | moderator | custom | member | supplier),
systemRoleId? (system users only), supplierStatus (none | pending | approved | rejected),
status (active | suspended), isDeleted, deletedAt?,
onboarding { step, completedAt, skippedAt? }, lastWorkspaceId?, lastLoginAt?,
createdAt, updatedAt, schemaVersion (3)
```

- Self create: `userType == 'member'`, `supplierStatus == 'none'`, `status == 'active'`, no `systemRoleId`.
- Self update: profile fields, avatar, onboarding, `lastWorkspaceId`, `lastLoginAt`; never `userType`, `systemRoleId`, `supplierStatus` (except `none|rejected → pending` together with a new `supplierRequests/{uid}`), `status`, `email`.
- `users.edit` + `roles.assign`: set `userType` to a system type and `systemRoleId`, only if the assigner `hasAll` the target role's keys, never to or from `owner`.
- `users.suspend`: `status` only, never on an `owner`. `users.delete`: `isDeleted` only.
- `suppliers.approve`: `userType member → supplier` + `supplierStatus → approved`, in the same batch as `supplierRequests/{uid}.status = approved` and the new `suppliers/{uid}` doc.
- `owner` exists only from the seed (Admin SDK). `custom` means a system user whose role is not one of the three seeded ones.
- Readers: self, and `users.view`. A system user without `users.view` cannot read other users.

### RBAC docs

| Doc | Read | Write |
| --- | --- | --- |
| `permissions`, `permissionGroups` | any signed-in user (labels for the role editors) | nobody (seed only) |
| `permissionPresets` | `presets.view`; workspace-scope presets also any signed-in user (workspace role editor) | `presets.create/edit/delete`; keys must match the preset `scope` |
| `systemRoles` | `roles.view`, and a user reads their own role | `roles.create/edit/delete`, never `isLocked` docs, new key list ⊆ editor's keys |
| `workspaces/{wid}/roles` | members of `wid` | `workspace-roles.create/edit/delete`; never `admin`; key list ⊆ editor's keys; delete only when `holdersCount == 0` |

Rules cannot check a key against the catalog cheaply, so role and preset key lists are validated by **prefix shape** (`^[a-z-]+\\.[a-z-]+$`, ≤ 150 entries) and the app sanitizes against `catalog.ts`. Unknown keys never grant anything because every rule checks one specific key.

### Rule helpers (replace `hasPerm`, `isSuperAdmin`)

```
function me()               { return get(userPath(uid())).data; }
function activeUser()       { return signedIn() && me().status == 'active' && me().get('isDeleted', false) == false; }
function isOwnerUser()      { return activeUser() && me().userType == 'owner'; }
function isPlatformUser()   { return activeUser() && me().userType in ['member', 'supplier', 'owner']; }
function isSupplier()       { return activeUser() && me().userType == 'supplier' && me().supplierStatus == 'approved'; }
function sysRole()          { return get(/databases/$(database)/documents/systemRoles/$(me().systemRoleId)).data; }
function hasSys(p)          { return isOwnerUser()
                                || (activeUser() && me().get('systemRoleId', null) != null && p in sysRole().permissions); }

function wsRole(wid)        { return get(/databases/$(database)/documents/workspaces/$(wid)/roles/$(myMember(wid).roleId)).data; }
function isWsAdmin(wid)     { return isMember(wid) && myMember(wid).roleId == 'admin'; }
function hasPerm(wid, p)    { return isMember(wid) && (myMember(wid).roleId == 'admin' || p in wsRole(wid).permissions); }
```

Read cost: a workspace check is 1 `get` (member) for admins and 2 (member + role) for everyone else; a system check is 1 (`users/{uid}`) for the owner and 2 otherwise. `get()` results are cached within one request, so a 100-item session snapshot batch still reads the member and role doc once each, and stays under the 20-call batch limit. The alternative (copy role keys into each member doc) saves one read but needs a fan-out on every role edit and a rule to prove the copy is current; rejected.

**Privacy boundary** (Q-01 in [[permissions-catalog#Review answers (2026-11-19)]]): `workspaces.view` reads the workspace doc, members and roles only. The single exception is `workspaces.data-view`, which adds **read** on `beneficiaries` (+ `history`, `assistanceRecords`), `sessions` (+ `items`, `events`) and `auditLog` in every workspace. No system key writes tenant data, and no system key reads workspace `chat`. Each tenant read rule becomes `hasPerm(wid, '<key>') || hasSys('workspaces.data-view')`; the `hasSys` branch is evaluated only when the member branch fails, so members pay no extra read.

### Workspace changes

- Creation batch: `workspaces/{wid}` + `members/{uid}` (`roleId: 'admin'`) + `roles/admin` (locked) + `roles/member` (Mb defaults). Rule: `getAfter` on all three.
- `ownerId` stays as "creator / locked admin". Ownership transfer keeps working: the new holder of `ownerId` must have `roleId == 'admin'` after the batch.
- `members/{uid}`: `roleId`, `roleName` (display), no `permissions{}` map. Assigning a role: `members.edit-role` + target role exists + `hasAll` check + `roles/{old}.holdersCount -1` and `roles/{new}.holdersCount +1` in the batch.
- Invites carry `roleId`/`roleName`; redemption copies `roleId` exactly and checks the role still exists and is not deleted.
- `isArchived` (by `workspaces.archive` or `workspace.delete`): rules reject writes under an archived workspace except un-archive.

### Content

| Collection | Fields | Read | Write |
| --- | --- | --- | --- |
| `systemMessages/{key}` | `key`, `category (message\|alert\|info-text)`, `type (info\|success\|warning\|error)`, `title?{ar,en}`, `text{ar,en}`, `placement`, `audience { kind: all\|userType\|role, values[] }`, `startsAt?`, `endsAt?`, `isPublished`, `isDeleted` | signed-in when `isPublished`; drafts with the family's `.view` | family from `category`: `messages.*`, `alerts.*` or `info-texts.*`; changing `category` needs `edit` on both families |
| `supportMethods/{id}` | `title{ar,en}`, `description{ar,en}`, `imagePublicId?`, `copyValue?`, `copyLabel?{ar,en}`, `order`, `isActive`, `isDeleted` | signed-in when `isActive`; `support-methods.view` all | `support-methods.*` |
| `pages/{slug}` | `title{ar,en}`, `body{ar,en}` (markdown), `isPublished`, `version` | signed-in when published | `pages.*` |
| `appConfig/home` | `sections: [{ key, visible, order, count }]` for banners, news, stats, featuredItems, topBags, popularSuppliers, quickLinks, messages | signed-in | `home-config.manage` |
| `appConfig/store` | `popularItemsCount (8)`, `popularSuppliersCount`, `topBagsCount (5)` | signed-in | `home-config.manage` |

Audience filtering is done on the device after a `where('isPublished','==',true)` query; the messages are not secret, only targeted.

### Media

`media/{id}`: `publicId` (the document id equals it for uploads, so a retried upload cannot create a second record), `resourceType (image|video|raw)`, `preset`, `folder`, `width?`, `height?`, `format`, `bytes`, `entityType`, `entityId`, `lang?`, `label?`, `workspaceId?`, `ownerId`, `isDeleted`, `createdAt`. The seed adds `seed-<banner>-<lang>` records for the banner art uploaded by hand (sizes unknown, stored as 0).
- `users/{uid}.avatarPublicId`: public ID of the user's current avatar. Changing it soft-deletes the earlier avatar records and lists them in `mediaOrphans` (reason `replaced`) in the same batch.

- Create: `ownerId == uid()` and either baseline (entity owned by the uploader: own avatar, own bag, own supplier profile, a workspace chat the uploader can send to) or `media.upload`.
- Read: owner, and `media.view`. Delete: owner (own entity) or `media.delete`, soft only.
- `mediaOrphans/{id}`: `publicId`, `mediaId`, `reason (replaced|deleted|cancelled)`, `createdBy`, `createdAt`. Create by anyone who could soft-delete the media doc, in the same batch. Read and export by `media.view`. Cleanup is by hand in the Cloudinary console ([[cloudinary-setup]]).

### Store and suppliers

| Collection | Fields |
| --- | --- |
| `storeCategories/{id}` | `parentId (null for level 1)`, `level (1\|2)`, `name{ar,en}`, `iconPublicId?`, `order`, `isActive`, `itemsCount`, `isDeleted` |
| `storeItems/{id}` | `supplierId`, `supplierName`, `categoryId`, `subCategoryId`, `name{ar,en}`, `nameSearch`, `description{ar,en}`, `imagePublicIds[≤6]`, `priceMinor`, `currency`, `unit`, `stock?`, `isAvailable`, `status (draft\|active\|hidden)`, `bagsCount`, `isDeleted` |
| `suppliers/{uid}` | `name`, `nameSearch`, `bio{ar,en}`, `logoPublicId?`, `coverPublicId?`, `categoryIds[]`, `serviceArea`, `contacts { phone?, whatsapp?, email? }`, `isVerified`, `status (active\|hidden)`, `itemsCount`, `ratingSum`, `ratingCount`, `bagsDonatedCount`, `isDeleted` |
| `suppliers/{sid}/reviews/{reviewerUid}` | `rating (1..5 int)`, `text (≤ 1000)`, `reviewerName`, `reviewerAvatarPublicId?`, `isHidden`, `createdAt`, `updatedAt` |

- Items: read when `status == 'active' && !isDeleted` by any signed-in user; `store-items.view` sees all. Write by the supplier where `supplierId == uid()` and `isSupplier()`, or by `store-items.*`. `subCategoryId` must exist and have `parentId == categoryId` (`get`).
- `isVerified` changes only with `suppliers.verify`. Counters (`itemsCount`, `rating*`, `bagsDonatedCount`) move only by the exact delta of the batch they belong to.
- Reviews: doc id is the reviewer uid, so one review per user per supplier. Create requires `reviewerUid == uid()`, `sid != uid()` (**no self-review**), `isPlatformUser()`, and `suppliers/{sid}.ratingSum/ratingCount` updated by exactly that rating in the same batch (`getAfter`). Edit/delete by the author adjusts the counters the same way. `reviews.moderate` sets `isHidden` and adjusts counters.
- Search: `nameSearch` prefix, like beneficiaries. Price range and rating filters run on the device over the current page.

### Bags

`bags/{bagId}`: `name`, `note`, `coverPublicId?`, `creatorId`, `creatorName`, `workspaceId?`, `isPublic`, `accessMode (view-only|collaborative)`, `linkToken`, `status (active|archived)`, `version`, `itemsCount`, `totalMinor`, `currency`, `supplierTotals { [supplierId]: minor }`, `donationsCount`, `isDeleted`, `createdAt`, `updatedAt`.

- `items/{itemId}` (≤ 100): `storeItemId`, `supplierId`, `supplierName`, `name{ar,en}`, `imagePublicId?`, `unitPriceMinor` (frozen at add time), `quantity (1..999)`, `addedBy`, `updatedAt`.
- `changes/{changeId}` (create-only): `actorId`, `actorName`, `actorAvatarPublicId?`, `type (item-added|item-removed|quantity|note|revert|restore)`, `itemId?`, `itemName?`, `before`, `after`, `priceDeltaMinor`, `version`, `createdAt`.
- `versions/{n}`: frozen copy of items + totals at a restore point (written on create and on every restore, not on every edit).
- `participants/{uid}`: `token`, `lastSeenVersion`, `joinedAt`.
- `bagLinks/{token}`: `bagId`, `isActive`, `createdAt`. Token is 28+ random chars like invites.

Access without listing:

1. The deep link `/bag/<token>` does `get(bagLinks/{token})` (rule: signed in, `get` only, `list: false`).
2. First open writes `bags/{bagId}/participants/{uid}` with `token`; the rule checks `bagLinks/{token}.bagId == bagId`, `isActive`, and `bags/{bagId}.linkToken == token`.
3. `bags/{bagId}` and its subcollections are readable by the creator, a participant **whose token still equals `linkToken`** (so regenerating the link cuts every old participant off), `bags.view`, and anyone for `isPublic` bags (needed for the Top 5 query).
4. List queries are only allowed in two shapes: `where('creatorId','==',uid)` and `where('isPublic','==',true).orderBy('donationsCount','desc').limit(5)`.

Edits: every item/note write must bump `version` by exactly 1, add one `changes` doc with that version (`getAfter`), and keep `totalMinor`/`itemsCount` consistent with the deltas. Collaborative edits require participant + `accessMode == 'collaborative'`. Revert/restore: creator or `bags.revert-changes`. Regenerate link: creator or `bags.regenerate-link`; batch sets the old `bagLinks` doc `isActive: false`, creates the new one, updates `linkToken`.

Donations: `beneficiaries.assign-bag` writes the assistance record in the workspace and `bags/{bagId}.donationsCount + 1` and `suppliers/{sid}.bagsDonatedCount + 1` in the same batch.

### Chat

| Path | Fields |
| --- | --- |
| `workspaces/{wid}/chat/{mid}` | `authorId`, `authorName`, `authorAvatarPublicId?`, `text (≤ 4000)`, `attachments[≤ 6] { mediaId, publicId, resourceType, width?, height? }`, `replyTo? { mid, authorName, excerpt }`, `bagCard? { bagId, token?, name, totalMinor, itemsCount }`, `clientId` (outbox idempotency), `isEdited`, `isDeleted`, `createdAt`, `editedAt?` |
| `workspaces/{wid}` | + `chatLastMessage { excerpt, authorName, at }`, `chatMessageCount` |
| `workspaces/{wid}/chatReads/{uid}` | `lastReadAt` |
| `conversations/{cid}` | `participantIds [userUid, supplierUid]`, `supplierId`, `lastMessage {…}`, `unread { [uid]: int }`, `typing { [uid]: timestamp }` |
| `conversations/{cid}/messages/{mid}` | same as workspace messages |

- Workspace chat: read `chat.view`, create `chat.send` (`authorId == uid()`), edit/delete own with `chat.delete-own`, others with `chat.delete-any`. Message doc id = `clientId` so outbox retries are idempotent.
- Unread in workspace chat: `count()` aggregation of messages after `chatReads/{uid}.lastReadAt` (1 read per 1000 messages), no per-member counters to fan out.
- Supplier chat: read/write only by the two `participantIds`; `chat.moderate` can read reported messages and soft-delete. The conversation `unread` map is incremented for the other participant in the same batch.
- Typing: the `typing` map on the conversation (and a `chatTyping/{uid}` doc per workspace), written at most once every 5 s while typing; listeners use the conversation doc that is already open, so typing costs writes, not extra listeners.
- Support has no read path (no chat keys).

### Logs, sync, monitoring

- `adminAuditLog/{id}` v2: `actorId`, `actorName`, `actorAvatarPublicId?`, `action`, `icon`, `targetType`, `targetId`, `targetName?`, `workspaceId?`, `summary { before?, after? }` (≤ 2 KB), `platform (ios|android|web)`, `appVersion`, `createdAt`. Create by any system user acting with a key, or by platform users for their own soft deletes; read `logs.view`. Create-only.
- `syncHealth/{uid}_{deviceId}`: `uid`, `deviceId`, `platform`, `appVersion`, `pending`, `failed`, `oldestPendingAt?`, `lastSyncAt`, `updatedAt`. Owner writes their own, throttled to one write per 10 minutes or on state change; read `sync-queue.view`; delete stale ones with `sync-queue.manage`.
- `rollups/{yyyy-mm-dd}` and `counters/global`: numeric fields only (`usersNew`, `workspacesNew`, `beneficiariesNew`, `sessionsEnded`, `itemsChecked`, `itemsIgnored`, `bagsCreated`, `reviewsNew`, `chatMessages`, `mediaUploads`, `syncFailures`, …). Clients add them to the same batch as the action. Rule: only listed fields, each changed field is exactly `existing + 1` (or `+ n` where `n` matches the batch, for imports), never decreasing. Read `monitoring.view` / `reports.view`. Abuse is bounded to inflated counters, which are display only.
- `activeDays/{date}/users/{uid}`: create-only, empty doc, once per user per day; DAU/WAU/MAU via `count()` aggregation.

### Indexes to add

| Collection | Fields |
| --- | --- |
| `users` | (userType, createdAt desc), (userType, status, createdAt desc), (isDeleted, createdAt desc) |
| `supplierRequests` | (status, createdAt desc) |
| `systemRoles`, `permissionPresets` | (isDeleted, name) |
| `workspaces/*/roles` | (isDeleted, name) |
| `media` | (isDeleted, createdAt desc), (entityType, isDeleted, createdAt desc), (ownerId, createdAt desc) |
| `systemMessages` | (isPublished, placement) |
| `supportMethods` | (isActive, isDeleted, order) |
| `storeCategories` | (parentId, isActive, order) |
| `storeItems` | (status, isDeleted, bagsCount desc), (status, isDeleted, subCategoryId, nameSearch), (status, isDeleted, categoryId, nameSearch), (supplierId, isDeleted, createdAt desc), (status, isDeleted, nameSearch) |
| `suppliers` | (status, isDeleted, ratingCount desc), (status, isDeleted, nameSearch) |
| `reviews` (collection group) | (isHidden, createdAt desc) |
| `bags` | (isPublic, isDeleted, donationsCount desc), (creatorId, isDeleted, updatedAt desc) |
| `changes` | single-field `createdAt` |
| `chat` / `messages` | single-field `createdAt` |
| `conversations` | (participantIds array-contains, lastMessage.at desc) |
| `adminAuditLog` | (actorId, createdAt desc), (action, createdAt desc), (targetType, createdAt desc), (workspaceId, createdAt desc) |
| `syncHealth` | (failed desc, updatedAt desc) |

### Emulator tests to write (one file per area)

| File | Covers |
| --- | --- |
| `tests/rules/users-v3.test.ts` | self create as member only, no self-escalation, system role assignment with `hasAll`, owner untouchable, supplier request + approval batch |
| `tests/rules/rbac.test.ts` | catalog read-only, presets and roles CRUD by key, locked roles, subset rule, one test per permission group that a missing key denies |
| `tests/rules/workspaces.test.ts` (update) | creation batch with roles, invites with `roleId`, role change counters, archived workspace is read-only |
| `tests/rules/privacy.test.ts` | only `workspaces.data-view` reads beneficiaries, sessions and history; it never writes them; no system key reads workspace chat |
| `tests/rules/content.test.ts` | published vs draft reads, each content family gated by its own key |
| `tests/rules/media.test.ts` | baseline own uploads, `media.upload` for shared, orphans |
| `tests/rules/store.test.ts` | supplier owns items, sub-category parent check, no self-review, counter deltas |
| `tests/rules/bags.test.ts` | no list, link redemption, regenerate cuts old participants, version + change log, view-only vs collaborative, public Top 5 query |
| `tests/rules/chat.test.ts` | members only, delete own/any, supplier conversation participants only, Support denied |
| `tests/rules/monitoring.test.ts` | rollups +1 only, activeDays create-once, syncHealth owner writes |

### Spark quota notes

- Every non-admin permission check adds one billed read per request (cached within the request). With ~500 beneficiaries per workspace this is small next to list reads.
- Typing indicators and sync health are the only "chatty" writers; both are throttled above.
- Rollups add one write per action batch to a single hot doc per day. Firestore sustains about 1 write/s per doc; at the expected scale this is fine, and a sharded counter can replace it later without a schema change for readers.
