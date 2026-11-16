# Cloudinary setup

Be My Hand stores banner, news and admin-uploaded images on Cloudinary (free tier, cloud `rrphuvne`).
Firebase Storage and Cloud Functions are not used. Firestore stores **public IDs**, never full URLs;
the app builds delivery URLs with `src/services/media/cloudinary.ts`.

## What lives where

| Value | Where | Secret? |
| --- | --- | --- |
| Cloud name `rrphuvne` | `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` (default in `src/config/env.ts`) | No |
| Unsigned upload preset name | `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | No (it is designed to be public) |
| Upload folder | `EXPO_PUBLIC_CLOUDINARY_FOLDER` (default `be-my-hand`) | No |
| API key and API secret | `.env.scripts` on the developer machine only | **Yes** |

Everything prefixed `EXPO_PUBLIC_` is bundled into the app and readable by anyone who downloads it.
The API secret must never be put in an `EXPO_PUBLIC_` variable, in `app.config.ts`, in EAS
environment variables of type "plain text", or committed. `.env.scripts` is git-ignored and is only
read by local Node scripts. The app has no code path that uses the API key or secret.

## 1. Create the unsigned upload preset

Cloudinary console, **Settings, Upload, Upload presets, Add upload preset**:

- **Signing mode:** Unsigned.
- **Folder:** `be-my-hand` (asset folder). Uploads land in `be-my-hand/<kind>` (the app sends the sub-folder).
- **Allowed formats:** `jpg, jpeg, png, webp`.
- **Max file size:** 5 MB (`max_file_size` 5000000). The app checks the same limit before uploading.
- **Incoming transformation:** `c_limit,w_2400,h_2400` so originals stay small.
- **Unique filename:** on. **Overwrite:** off. **Use filename:** off.
- **Return delete token:** on. The app uses it to undo an upload for about 10 minutes
  (`POST /v1_1/rrphuvne/delete_by_token`). After that, deleting needs the Media Library or a
  signed script.
- **Tags:** `be-my-hand`.

Put the preset name in `.env` as `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. Leaving it blank disables
uploads in the app (Manage shows a "not configured" state); delivery keeps working.

### Abuse limits of an unsigned preset

Anyone who extracts the preset name from the app can upload to the folder above. The preset
settings bound the damage (format and size limits, fixed folder, no overwrite). Uploads are not
referenced anywhere until a super admin saves the public ID to Firestore, which the rules allow only
for super admins, so a stray upload is never shown in the app. Review the folder in the Media
Library periodically, and rotate the preset (create a new one, update `.env`, ship a build, delete
the old one) if it is abused.

## 2. Local files

`.env` (git-ignored, copied from `.env.example`):

```bash
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=rrphuvne
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<your unsigned preset>
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
eas env:create --environment production --name EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET --value <preset> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_CLOUDINARY_FOLDER --value be-my-hand --visibility plaintext
```

Do not create the API key or secret on EAS; no build step needs them.

## 4. Delivery rules (enforced in code)

- Every URL carries `f_auto,q_auto` (format and quality chosen per device).
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
| helping-hands | `mulgwg6el6jdtpzydbyu` | not uploaded |
| offline | `eec5ymnz5jk9eiom08xx` | not uploaded |
| teams | not uploaded | not uploaded |
| export | `flfvoz8yaqba9xzjzrso` | `xekwojqimaois4pnua9t` |

`jfsnfzghyvbdkamwqvkp` is the same Arabic export design uploaded a second time from the 1.1 MB PNG
(the mapped `flfvoz8yaqba9xzjzrso` came from the 50 KB WebP). It is listed in
`UNMAPPED_PUBLIC_IDS` and is not used; it can be deleted from the Media Library.

### Filling the gaps

Upload the missing files (`banners/banner-1-helping-hands-en.webp`, `banner-2-offline-en.webp`,
`banner-3-teams-ar.webp`, `banner-3-teams-en.webp`) from **Manage, Banners** (or the Cloudinary
console), then either pick them on the banner in Manage (writes `imagePublicId`) or add the new IDs
to `BANNER_ASSETS` and re-run the seed.

## 6. Seeding marketing content

```bash
# Emulator (no credentials needed)
npx firebase emulators:exec --only firestore \
  "pnpm seed:marketing --project demo-be-my-hand --apply && pnpm seed:marketing:verify --project demo-be-my-hand" \
  --project demo-be-my-hand

# Live project: service-account key stored OUTSIDE the repo
GOOGLE_APPLICATION_CREDENTIALS=~/keys/be-my-hand-admin.json pnpm seed:marketing --project bemyhand-8de0e        # dry run
GOOGLE_APPLICATION_CREDENTIALS=~/keys/be-my-hand-admin.json pnpm seed:marketing --project bemyhand-8de0e --apply
```

The seed merges banners, news and cards by id, and creates `appConfig/support` and
`platformStats/global` only when missing. `appConfig/support` is created with
`REPLACE_WITH_*` placeholders and `isEnabled: false`. The InstaPay values are not in the source:
pass them as environment variables, which set only `instapayLink` and `instapayAddress` on every run
that sets them (`isEnabled` is never changed by the seed):

```bash
INSTAPAY_LINK='https://ipn.eg/S/<account>/instapay/<code>' INSTAPAY_ADDRESS='<handle>@instapay' \
GOOGLE_APPLICATION_CREDENTIALS=~/keys/be-my-hand-admin.json pnpm seed:marketing --project bemyhand-8de0e --apply
```

Then set `isEnabled: true` in the console once the link has been tried on a phone. The app treats
unreplaced placeholders as missing.

Verified on the Firestore emulator (two consecutive `--apply` runs, then
`seed:marketing:verify`). It has not been run against the live project.
