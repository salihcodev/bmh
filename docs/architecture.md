---
tags: [be-my-hand, docs, architecture]
---

# Architecture

Expo (development builds) + React Native Firebase on the Firebase **Spark** plan. The phone talks directly to Firestore; Security Rules are the only backend logic. No Cloud Functions, Cloud Storage, Admin SDK or second backend.

```mermaid
flowchart TB
  subgraph Device
    UI["Screens (src/app)"] --> Features["Feature hooks + components (src/features)"]
    Features --> Services["Services: Firestore reads/writes (src/services)"]
    Features --> Domain["Domain: pure logic (src/domain)"]
    Services --> Domain
    Services --> RNFB["React Native Firebase (native SDK, offline cache + write queue)"]
    Services --> MMKV["MMKV: preferences + outbox"]
    Services --> Cloudinary["Cloudinary (unsigned upload, delivery URLs)"]
  end
  RNFB <--> Firestore[("Cloud Firestore + Security Rules")]
  RNFB <--> Auth["Firebase Auth (email/password, Google, phone)"]
```

## Layers

| Folder | Role | Rules |
|---|---|---|
| `src/app` | Expo Router screens | Compose UI only. No Firestore calls. Route groups below. |
| `src/features/*` | Hooks (`useBeneficiaryList`, `useSessions`, …) and feature components | Listeners and pagination live here; writes go through services. |
| `src/services/*` | Firestore refs, batches, online-only operations, files/share | The only place that builds batches. Offline writes use `commitInBackground`; online-only flows use `requireOnline()` + `commitOnline`. |
| `src/domain/*` | Types, zod schemas, phone/search/maps/session/import/export logic | Pure TypeScript, no React or Firebase runtime imports. Unit tested. |
| `src/providers` | Auth, current user (`useCurrentUser`, platform role), active workspace, `useCan()` | Providers below auth are remounted per uid. Workspace switching uses `pickActiveWorkspace()`. |
| `src/theme` | Tokens, `ThemeProvider` / `useTheme()`, font resolver | The only source of colors, type, spacing, radii and sizes. See [[design-system]]. |
| `src/components` | Design system (`ui/`), brand mark, layout (`AppHeader`, `SyncPill`, tab bar) | Tokens only (`pnpm check:tokens`). RTL via logical styles (`start`/`end`). |
| `src/hooks` | `usePaginatedQuery` and small shared hooks | Pagination state logic is pure and lives in `src/lib/pagination.ts`. |
| `src/config` | `env.ts` (zod-validated `EXPO_PUBLIC_*`), onboarding steps, Cloudinary banner asset map | Public values only; no secrets. |
| `firestore.rules` | Authorization and data shape | Mirrors `src/services/permissions/matrix.ts`; tested on the emulator. |

## Route groups

| Group | Guard | Contents |
|---|---|---|
| `(auth)` | signed out | Login (email and Google), register, phone, forgot password |
| `onboarding` | signed in, onboarding not `done` | Intro, profile, create or join a workspace (resumable) |
| `suspended` | `status == 'suspended'` | Notice and sign out only |
| `join`, `complete-profile` | signed in | Invite deep link (`bemyhand://join`), legacy profile completion |
| `(app)/(tabs)` | signed in, active | Home, Activities, Sessions, Settings, Profile. Support, About, Appearance and News sit beside the tabs in `(app)`. |
| `(app)/(ws)` | a verified membership for the current uid | Every workspace screen; renders nothing until the membership exists, so no query runs with an empty workspace id |
| `(admin)` | `globalRole == 'superadmin'` and active | Entered from a card at the top of Settings. `/manage` hub, media, banners, users, audit; the rules enforce the same check |
| `dev` | `__DEV__` only | `/dev/design-system` |

`RouteGuard` (`src/domain/route-guard.ts`, unit tested) picks the destination from auth, profile and membership state. The root layout mounts `ToastProvider` and `ConfirmHost` (`confirmAsync()` for confirmations from non-component code).

## Dependencies and why

| Package | Why |
|---|---|
| `expo`, `expo-router`, `expo-dev-client`, `expo-build-properties` | App shell, file-based routes, dev builds (React Native Firebase needs native code, so no Expo Go) |
| `@react-native-firebase/app`, `auth`, `firestore` | Native SDKs: real offline persistence and write queue, which the web SDK lacks on React Native |
| `react-native-mmkv` (+ `react-native-nitro-modules`) | Fast synchronous storage for preferences (zustand persist) and the outbox |
| `zustand` | Small stores: preferences, sync status |
| `@react-native-community/netinfo` | Connectivity for the sync pill and `requireOnline()` |
| `i18next`, `react-i18next`, `expo-localization` | Arabic (default, RTL) and English, Arabic plural rules |
| `@expo-google-fonts/space-grotesk`, `@expo-google-fonts/ibm-plex-sans-arabic`, `expo-font`, `expo-asset` | Latin and Arabic UI fonts; `expo-asset` also loads the TTF so PDFs embed it |
| `expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-linear-gradient` | Cached Cloudinary images, picking images (photos or camera, square crop for avatars), resize and compress before upload, banner gradients |
| `expo-haptics`, `expo-clipboard`, `expo-constants`, `react-native-qrcode-svg` | Field-mode feedback, copying a payment value, app version on About, QR codes |
| `zod`, `react-hook-form`, `@hookform/resolvers` | One schema per form, shared by create, edit and import validation |
| `libphonenumber-js` (`/max` metadata) | Egyptian phone validation and E.164; the "min" metadata accepted invalid numbers |
| `@shopify/flash-list` | Long beneficiary lists |
| `lucide-react-native`, `react-native-svg` | Icons |
| `expo-crypto` | Invite codes (`getRandomBytes`) and phone/pin ids (`randomUUID`) |
| `expo-location` | Foreground location for beneficiary pins and the in-app map (permission asked only then; no background modes) |
| `@maplibre/maplibre-react-native` | Native map, clustered beneficiary layer, route line (dev-client rebuild required; v11.5.1, Expo SDK 57 / RN 0.86.3, New Architecture) |
| `@turf/distance`, `@turf/helpers` | Straight-line fallback distance when OSRM is unavailable |
| `expo-linking` | Deep links `bemyhand://join`, `tel:`, Maps |
| `expo-document-picker`, `expo-file-system` | Pick import files; write export files to cache |
| `xlsx` (SheetJS 0.20.3) | Read xlsx/csv, write xlsx, on device |
| `expo-print`, `expo-sharing` | HTML → PDF on device; system share sheet |
| `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `react-native-worklets` | Navigation and gesture runtime required by Expo Router |
| `@react-native-async-storage/async-storage` | Required by React Native Firebase Auth persistence |
| Dev: `vitest`, `@firebase/rules-unit-testing`, `firebase`, `firebase-tools` | Unit tests and rules tests on the Firestore emulator |
| Dev: `firebase-admin`, `dotenv` | Local script only (`scripts/data.mts`), run with a service-account key kept outside the repo. Never bundled. |

## Data access patterns

- **Lists** go through `usePaginatedQuery`: a live first page, keyed by workspace (or uid) so a switch never shows stale rows. Members, invites, cities and areas stay single live listeners (tens of docs).
- **Listeners** (`onSnapshot`): only for small or first-page data. Membership list, the active workspace doc, cities and areas (tens of docs), the first page (20) of lists, one session doc + its ≤100 items, the 5 most recent activity events.
- **Pages**: next pages use `getDocs` with `startAfter(cursor)`, 20 per page. No listener per page.
- **Search**: `nameSearch` prefix range (normalized Arabic) or exact `phoneDigits array-contains` (E.164). See `src/domain/search.ts`.
- **Counters**: `beneficiaryCount`, `areaCount`, `cityCount`, `sessionCount` and per-area `beneficiaryCount` move with `increment()` in the same batch as the change. Display only; an admin "recount" (`getCountFromServer`) repairs drift.
- **Writes**: batches, never transactions (transactions fail offline). Deterministic ids where retries matter (session item id = beneficiary id, invite code = doc id).

## Read and write budget

Spark free quota: **50,000 reads, 20,000 writes, 20,000 deletes per day**. Estimates below are for one workspace with ~500 beneficiaries, 30 areas, 5 active members.

### Reads

| Action | Reads | Notes |
|---|---|---|
| App open (memberships + workspace + cities + areas) | ~1 + 1 + 5 + 30 ≈ 40 | Cached afterwards; listeners only re-read changed docs |
| Beneficiary list, first page | 20 | Live listener: every change to one of those 20 docs costs 1 read per open listener |
| Each "load more" | 20 | `getDocs`, no listener |
| Search (name or phone) | ≤ 20 | One query per debounced input (300 ms) |
| Beneficiary details | 1 + history page (20) + assistance (≤ 20) | History only with `history_view` |
| Home recent activity | 5 | Collection-group listener, limit 5 |
| Session setup "check count" | ≤ 101 | `limit(max + 1)` across area chunks of 30 |
| Session runner | 1 + ≤ 100 | Session doc + items listener. Each Check/Ignore re-reads 1 item + the session doc on every device listening |
| Runner prefetch of beneficiary docs | ≤ 100, once per session per app run | Only for users with `beneficiaries_view`, only online; makes "View details" work offline |
| Members screen | members + pending invites | Tens |
| Audit / history pages | 20 per page | |
| Export, beneficiary list | ≤ 500 | One `getDocs` (cache when offline) |
| Import preview | ~500 + cities + areas | Server read for exact duplicate detection |
| Rename city/area | beneficiaries in that city/area | Fan-out update needs the ids |
| Recount | ~1 per 1000 counted docs per aggregation, ~35 aggregations | Plus area docs |

**Listener pagination cost:** the first page is a listener so edits show up live. While the list screen is open, every write to one of those 20 documents costs one read per device that has the list open. That stays small at this scale. Later pages are one-time reads; they are dropped and re-read (20 at a time, only if the user scrolls again) whenever the first page changes or the filter changes, so they never go stale for long.

**Typical day** (3 operators, 2 sessions of 100, 50 edits, a few searches and exports): about 2,000–5,000 reads.

### Writes

| Action | Writes |
|---|---|
| Create beneficiary | 4 (doc, workspace counter, area counter, history) |
| Edit beneficiary | 1 + 1 history per change type (+2 if the area changes) |
| Archive / restore | 4 |
| Pin add/edit/remove, call attempt | 2 / 1 |
| Assistance record (confirmed) | 3 (record, beneficiary, history) |
| Start session (N items) | N + 4 (session, items, counter, 2 events) ≤ 104 |
| Check / Ignore / Reopen | 3–4 (item, session counter, session event, optional history) |
| End session | 2 |
| Import (N rows) | ~2N + counters per batch |
| Rename city/area | 1 + number of affected beneficiaries (+ areas for a city) |
| Workspace create / invite / join | 2 / 2 / 3 + audit |

**Typical day:** two 100-item sessions ≈ 2 × (104 + 100 × 4 + 2) ≈ 1,000 writes; plus edits and logging ≈ a few hundred. Well under 20,000.

### What would break the budget

- Opening many devices on a large unfiltered list for hours while someone bulk-edits (listener re-reads).
- Repeated import previews or full exports of very large workspaces (each reads every beneficiary).
- Renaming a city with thousands of beneficiaries (one write each).

The design keeps those rare and explicit (online-only, behind permissions, with confirmation).

## Indexes

Composite indexes are in `firestore.indexes.json`: platform content (`banners`, `marketingCards` by `isActive` + `order`; `news` by `isPublished` + `publishedAt`; `media`; `systemMessages` by `category` + `createdAt`; `users` by `status`), beneficiaries by `isArchived` + `nameSearch` (and per area / city), `isArchived` + `phoneDigits`, sessions by `operatorId`/`status` + `createdAt`, areas by `cityId` + `nameSearch`, collection-group `history` by `workspaceId` + `createdAt`, and a collection-group field override for `members.userId`. Deploy with `pnpm deploy:rules`.

## Known limitations

See [[offline-sync#Known limitations]] and [[open-product-decisions]].

## Media and content (V4)

- **Upload pipeline** (`src/services/media`): pick (`pick.ts`) → resize and compress (`prepare.ts`, `expo-image-manipulator`) → unsigned Cloudinary upload with progress and cancel (preset `bmh_<group>`, `public_id = mediaId`, folder `be-my-hand/<group>`) → one Firestore batch that writes the `media` record (and, for avatars, `users/{uid}.avatarPublicId`). The pure parts are in `avatar-job.ts` and unit tested.
- **Offline.** Only the user's own avatar is queued: the prepared file is parked in app storage and a `media_upload` outbox job uploads it when online. The outbox removes the job and `sweepQueuedFiles` removes the file on sign-out. Dashboard uploads need a connection.
- **Display.** `cld(publicId, preset)` builds delivery URLs; documents store public IDs only.
- **Dashboard.** `useUploader` and `MediaPickerSheet` serve banners, news and support methods; the media library lists `media` with a Removed view. Content CRUD (banners, news, messages, support methods) lives in `src/services/admin/content-writes.ts`, each write with its audit entry in the same batch.
- **System messages.** `<SystemMessage messageKey fallback />` shows a published, in-window, audience-matching message and otherwise the app's own i18n text, so the app is never blank when Firestore has nothing.
