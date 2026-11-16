---
tags: [be-my-hand, docs, m0]
---

# Firestore schema

Everything except `users/{uid}` lives under `workspaces/{wid}`, which is the tenant boundary. Rules in `firestore.rules` enforce that boundary (see [[security]]).

```
users/{uid}                       displayName, email, locale, createdAt, lastWorkspaceId
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
- `users/{uid}` is private to its owner.
- See [[security]].

## Expected growth

| Collection | Size |
|---|---|
| beneficiaries | ~500 per workspace |
| areas / cities | tens |
| sessions | a few per month, ≤100 items each |
| history | grows with every change; paginated |
| auditLog | grows slowly (membership, imports, exports) |

## Historical preservation

- Events (`history`, `events`, `auditLog`) are create-only in rules.
- Session items are snapshots and ended sessions are immutable.
- Beneficiaries, cities and areas are archived, never deleted.
- Assistance records are never deleted; only `unconfirmed → confirmed`.
