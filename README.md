# Be My Hand

> Helping hands, organized.

A multi-workspace mobile app for small charities and volunteer teams: manage beneficiaries by city and area, and run one-operator distribution sessions in the field, online or offline. Arabic first (RTL), English ready. Android and iOS from one codebase. Runs entirely on the Firebase **Spark (free)** plan.

Progress and test status: [APP_PROGRESS.md](APP_PROGRESS.md) (open the `be-my-hand` folder as an Obsidian vault).

## Docs

- [Architecture](docs/architecture.md)
- [Firestore schema](docs/firestore-schema.md)
- [Security and permissions](docs/security.md)
- [Product flows](docs/product-flows.md)
- [Session workflow](docs/session-workflow.md)
- [Offline and sync](docs/offline-sync.md)
- [Import and export](docs/import-export.md)
- [Product decisions](docs/open-product-decisions.md)
- [Mafrash reuse report](docs/mafrash-reuse-report.md)

## Stack

Expo SDK 57 (development builds, not Expo Go), React Native 0.86, TypeScript strict, Expo Router, React Native Firebase (app, auth, firestore), MMKV, NetInfo, Zod, libphonenumber-js, FlashList, i18next, SheetJS, expo-print. Backend: Firebase Authentication (email/password), Cloud Firestore, Firestore Security Rules. Nothing else.

## Firebase setup

You need two Firebase projects: one for development and one for production. Do not reuse the Mafrash project.

1. [Firebase console](https://console.firebase.google.com/) > **Add project** (for example `be-my-hand-dev`, then `be-my-hand-prod`). Stay on **Spark**. Analytics is optional.
2. **Build > Authentication > Get started > Email/Password > Enable.**
3. **Build > Firestore Database > Create database**, production mode, pick a region close to Egypt (for example `europe-west1`/`me-central1` if available on Spark).
4. **Project settings > Your apps**, in each project:
   - Android app, package `com.salihcodev.bemyhand.dev` (dev project) or `com.salihcodev.bemyhand` (prod project). Download `google-services.json`.
   - iOS app with the same bundle ids. Download `GoogleService-Info.plist`.
5. Put the files here (gitignored):
   ```
   firebase/dev/google-services.json
   firebase/dev/GoogleService-Info.plist
   firebase/prod/google-services.json
   firebase/prod/GoogleService-Info.plist
   ```
6. Deploy rules and indexes to each project:
   ```bash
   npx firebase login
   npx firebase use --add          # pick be-my-hand-dev, alias "dev"; repeat for prod
   npx firebase use dev && pnpm deploy:rules
   npx firebase use prod && pnpm deploy:rules
   ```
7. Password reset emails use Firebase's built-in template (free). Optionally translate it in **Authentication > Templates**.

## Run

```bash
cp .env.example .env              # APP_ENV=development
pnpm install
pnpm android                      # builds the dev client (Android Studio / SDK required)
pnpm ios                          # macOS + Xcode
pnpm start                        # Metro for an installed dev client
```

Production build: `APP_ENV=production` (EAS `production` profile sets it). iOS distribution to other people needs a paid Apple Developer account, which is outside the free tier; build and test on your own device until then.

### Local emulators

```bash
pnpm emulators                    # Firestore + Auth emulators, demo project
pnpm data -- --reset --apply
```

`pnpm data -- --reset --apply` wipes the emulator and seeds the permission catalog, presets, the Owner / Support / Moderator system roles, a workspace (`فريق القاهرة`) with `admin`, `member` and a custom `field` role, Home content, and eight accounts with password `test1234`: `ahmedsalihdev@gmail.com` (platform owner), `support@bemyhand.test`, `moderator@bemyhand.test`, `ceo@bemyhand.test`, `admin@bemyhand.test`, `member@bemyhand.test`, `field@bemyhand.test` and `supplier@bemyhand.test`. Emails, names and passwords are overridden in `.env.scripts` (see `.env.scripts.example`). Set `SEED_PASSWORD` (8+) for a live seed; per-account `SEED_*_PASSWORD` overrides it. The seed is idempotent, and `pnpm data -- --verify` checks the catalog, roles and assignments. Omit `--apply` for a dry run. `pnpm data -- --wipe --apply` and `pnpm data -- --seed --apply` run one step. Images use Cloudinary unsigned presets (setup and limits: [docs/cloudinary-setup.md](docs/cloudinary-setup.md)). Content only: `pnpm data -- --marketing --apply` (banners, news, cards, support methods, the `sync_queue_info` system message, media records for the banner art, Home layout). Payment methods are hidden until they have a real value: set `INSTAPAY_LINK`, `INSTAPAY_ADDRESS` and `VODAFONE_CASH_NUMBER` in `.env.scripts`, or edit them in the dashboard.

### Live Firebase project

```bash
pnpm data -- --wipe --project bemyhand-8de0e --confirm-live bemyhand-8de0e --apply
pnpm data -- --seed --project bemyhand-8de0e --confirm-live bemyhand-8de0e --apply
```

`--confirm-live` must match `--project`. The script uses your `firebase login`. `--wipe` deletes every Firestore collection and every Auth user; `--seed` creates the demo users in real Firebase Auth. Omit `--apply` for a dry run. A service-account key still works if `GOOGLE_APPLICATION_CREDENTIALS` points at a real file.

Set `EXPO_PUBLIC_USE_EMULATORS=true` in `.env` (and `EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2` on the Android emulator) and rebuild/reload.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test                         # unit tests (domain logic)
pnpm test:rules                   # security rules on the Firestore emulator (JDK 21+)
```

`pnpm emulators` and `pnpm test:rules` pick JDK 21 when it is installed (`brew install openjdk@21`), even if the shell default is older.

Testing status: unit tests and rules tests (Firestore emulator) pass. Nothing has been run on a device or against a live Firebase project yet; the manual release checklist is in [APP_PROGRESS.md](APP_PROGRESS.md#manual-checks-before-release-device--live).

## Free-tier budget

Spark allows about 50k reads and 20k writes per day. With ~500 beneficiaries, pages of 20, and sessions of ≤100 items, normal daily use is a few thousand reads and a few hundred writes. Details in [docs/architecture.md](docs/architecture.md#read-and-write-budget).
