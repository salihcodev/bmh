# Cloudinary setup

Be My Hand stores avatars, banner, news and support images (and, in later phases, store, supplier, bag,
chat and beneficiary images) on Cloudinary (free tier, cloud `rrphuvne`). Firebase Storage and Cloud
Functions are not used. Firestore stores **public IDs**, never full URLs; the app builds delivery URLs
with `src/services/media/cloudinary.ts` (`cld(publicId, preset)`).

## What lives where

| Value | Where | Secret? |
| --- | --- | --- |
| Cloud name `rrphuvne` | `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` (default in `src/config/env.ts`) | No |
| Preset prefix, for example `bmh_` | `EXPO_PUBLIC_CLOUDINARY_PRESET_PREFIX` | No (unsigned presets are designed to be public) |
| Upload root folder | `EXPO_PUBLIC_CLOUDINARY_FOLDER` (default `be-my-hand`) | No |
| API key and API secret | `.env.scripts` on the developer machine only | **Yes** |

Everything prefixed `EXPO_PUBLIC_` is bundled into the app and readable by anyone who downloads it.
The API secret must never be put in an `EXPO_PUBLIC_` variable, in `app.config.ts`, in EAS
environment variables of type "plain text", or committed. `.env.scripts` is git-ignored and is only
read by local Node scripts. The app has no code path that uses the API key or secret.

## 1. Create the nine unsigned upload presets (manual console step)

Each image belongs to an entity, each entity to one upload group, and each group is one preset named
`<prefix><group>`. The code builds the name (`uploadPresetName` in `src/services/media/groups.ts`), so
the names below must match exactly when the prefix is `bmh_`.

| Preset | Group folder | Used for (entity) | Client resize (longest side) |
| --- | --- | --- | --- |
| `bmh_avatars` | `be-my-hand/avatars` | profile photos (`avatar`) | 512 px |
| `bmh_banners` | `be-my-hand/banners` | Home banners and news covers (`banner`, `news`) | 1600 px |
| `bmh_support` | `be-my-hand/support` | support method images such as QR codes (`support`) | 1200 px |
| `bmh_store` | `be-my-hand/store` | store items (`store`, V7) | 1200 px |
| `bmh_suppliers` | `be-my-hand/suppliers` | supplier covers and logos (`supplier`, V7) | 1200 px |
| `bmh_bags` | `be-my-hand/bags` | bag covers (`bag`, V7) | 1200 px |
| `bmh_chat` | `be-my-hand/chat` | chat attachments (`chat`, V9) | 1600 px |
| `bmh_beneficiaries` | `be-my-hand/beneficiaries` | beneficiary photos (`beneficiary`, V8) | 1200 px |
| `bmh_misc` | `be-my-hand/misc` | anything else (`other`) | 1600 px |

Cloudinary console, **Settings, Upload, Upload presets, Add upload preset**, the same settings for all nine
(only the name and the folder change):

- **Signing mode:** Unsigned.
- **Folder:** the group folder from the table (asset folder). The app also sends `folder` itself.
- **Allowed formats:** `jpg, jpeg, png, webp`.
- **Max file size:** 5 MB (`max_file_size` 5000000). The app checks the same limit before uploading.
- **Incoming transformation:** `c_limit,w_2400,h_2400` so originals stay small.
- **Overwrite:** **off**. The app sends the media ID as `public_id`, so a retry of the same upload
  returns the asset that is already there instead of creating a duplicate.
- **Unique filename:** off (the public ID is the media ID). **Use filename:** off.
- **Return delete token:** on. The dashboard uses it to undo an upload for about 10 minutes
  (`POST /v1_1/rrphuvne/delete_by_token`).
- **Tags:** `be-my-hand`. The app adds the group, entity and language as tags, and `entity`,
  `entityId` and `owner` as upload `context`.

Put the prefix in `.env` as `EXPO_PUBLIC_CLOUDINARY_PRESET_PREFIX=bmh_`. Leaving it blank disables
every upload in the app (Manage shows a "not configured" state, the avatar button is hidden);
delivery keeps working.

### Abuse limits of an unsigned preset

Anyone who extracts a preset name from the app can upload to that preset's folder. The preset
settings bound the damage (format and size limits, fixed folder, no overwrite). An upload is not
referenced anywhere until a `media` document exists (the rules allow it only for the owner's own
avatar or for staff with `media.upload`) and a banner, news item or support method points at it, so a
stray upload is never shown in the app. Review the folders in the Media Library periodically, and
rotate a preset (create a new one, update the prefix or the app, delete the old one) if it is abused.

## 2. Local files

`.env` (git-ignored, copied from `.env.example`):

```bash
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=rrphuvne
EXPO_PUBLIC_CLOUDINARY_PRESET_PREFIX=bmh_
EXPO_PUBLIC_CLOUDINARY_FOLDER=be-my-hand
```

`.env.scripts` (git-ignored, only for local maintenance scripts; optional today):

```bash
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## 3. EAS builds

`.env` is not uploaded to EAS. Create the three `EXPO_PUBLIC_CLOUDINARY_*` variables for each
environment (development, preview, production):

```bash
eas env:create --environment production --name EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME --value rrphuvne --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_CLOUDINARY_PRESET_PREFIX --value bmh_ --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_CLOUDINARY_FOLDER --value be-my-hand --visibility plaintext
```

Do not create the API key or secret on EAS; no build step needs them.

## 4. Delivery rules (enforced in code)

- Every URL carries `f_auto,q_auto` (format and quality chosen per device).
- Screens ask for a named size with `cld(publicId, preset)`: `avatar` (192 px square, face crop),
  `avatarSm` (96 px), `banner` (1080 x 540), `card` (720 x 480), `thumb` (240 px), `full`
  (up to 1440 px, never upscaled). Each adds `dpr_auto`, which only has an effect where the client
  sends hints.
- Width is the layout width x 3, capped at 1440 px (`MAX_DELIVERY_WIDTH`), with `c_limit` so images
  are never upscaled.
- A tiny blurred preview (`w_32,e_blur:300`) is used as the `expo-image` placeholder.
- `expo-image` caches on disk, so banners show offline after the first view.
- Only `res.cloudinary.com/rrphuvne/...` URLs are accepted by `parsePublicId`; other hosts return
  null and the UI falls back.
- `scripts/check-tokens.mjs` fails the build if a Cloudinary URL is hardcoded outside
  `src/services/media/cloudinary.ts`.

## 5. Banner art mapping

Banner art has its title baked into the image, so a banner shows art only in the language the art
was made for. If a language has no art, the app renders the gradient card with the localized title
from Firestore (never the other language's art).

Resolution order for `banners/{id}` in language `L`:

1. `imagePublicId[L]` in Firestore (set from Manage, or by the seed script).
2. `BANNER_ASSETS[id][L]` in `src/config/cloudinaryAssets.ts`.
3. Gradient fallback.

### How the mapping was made

The existing uploads in the cloud were matched against the local reference files in `banners/`
by downloading a `w_600,f_png` preview of each upload and comparing it visually with
`banners/banner-*-{ar,en}.png`. An entry was set only when the design and the baked-in text matched.

| Banner | Arabic | English |
| --- | --- | --- |
| helping-hands | `mulgwg6el6jdtpzydbyu` | `eofu45brelnfw0xa8qkz` |
| offline | `eec5ymnz5jk9eiom08xx` | `mytsk6ruhpanrloigkti` |
| teams | `lcqjijwplncff6i7dxbe` | `pztyleswg298cmyvgjwz` |
| export | `flfvoz8yaqba9xzjzrso` | `snhkxmfzezvp6osrxnba` |

Four designs were uploaded twice (a ~50 KB WebP and a ~1.1 MB PNG). The WebP is mapped; the PNG
is listed in `UNMAPPED_PUBLIC_IDS` and is not used:

| Banner | Language | Unused PNG |
| --- | --- | --- |
| export | Arabic | `jfsnfzghyvbdkamwqvkp` |
| export | English | `xekwojqimaois4pnua9t` |
| teams | Arabic | `v8k7u4ux3saiugwvwx95` |
| teams | English | `r2ltxvfxnz6gk2zbsn8n` |

Those PNGs can be deleted from the Media Library. Helping-hands and offline exist only as PNG, so
those IDs are the ones in use.

## 6. What the app cannot do without a backend (MEDIA-08)

The app has no server, so it never holds the API secret. That limits what it can do to a file:

- **No list.** The Admin API is not reachable. The library shows what Firestore knows (`media`), not
  what is in the Cloudinary folders.
- **No overwrite.** Presets keep overwrite off. To change an image, upload a new one and point the
  document at it; the old file becomes an orphan.
- **No delete, except right after an upload.** `delete_by_token` works for about 10 minutes (the app
  stops offering it after 9). Later, removing a file means the Cloudinary console.
- **Orphans are tracked by hand.** Replacing or removing an image soft-deletes its `media` document
  and writes `mediaOrphans/{id}` (`publicId`, `mediaId`, `reason`) in the same batch. Staff with
  `media.view` read that list in the dashboard (Media, Removed). Cleaning up is a manual routine: open
  the Cloudinary Media Library, search by public ID, delete the file. Nothing is lost by waiting;
  orphans only use free-tier storage.
- **An offline avatar upload is queued on the phone** (outbox job `media_upload`) and runs when the
  phone is online again. Dashboard uploads are online only.

## 7. Seeding marketing content

```bash
# Emulator (no credentials needed)
npx firebase emulators:exec --only firestore \
  "pnpm data -- --marketing --project demo-be-my-hand --apply && pnpm data -- --verify --project demo-be-my-hand" \
  --project demo-be-my-hand

# Live project: service-account key stored OUTSIDE the repo
GOOGLE_APPLICATION_CREDENTIALS=~/keys/be-my-hand-admin.json pnpm data -- --marketing --project bemyhand-8de0e        # dry run
GOOGLE_APPLICATION_CREDENTIALS=~/keys/be-my-hand-admin.json pnpm data -- --marketing --project bemyhand-8de0e --apply
```

The seed merges banners, news and cards by id and creates `appConfig/support` (developer credit),
`appConfig/home`, `supportMethods`, `systemMessages/sync_queue_info`, `media` records for the banner
art and `platformStats/global` only when missing. Payment methods stay hidden until they have a real
value. The seed loads git-ignored `.env.scripts` (`INSTAPAY_LINK`, `INSTAPAY_ADDRESS`,
`VODAFONE_CASH_NUMBER`) and, when a value is set, writes it to `supportMethods/instapay` or
`supportMethods/vodafone-cash` and turns that method on. Without env values it reuses real values
from an older `appConfig/support` document. Shell variables win over the file.

Verified on the Firestore emulator (two consecutive `--apply` runs, then
`pnpm data -- --verify`). It has not been run against the live project.
