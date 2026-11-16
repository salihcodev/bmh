---
tags: [be-my-hand, docs, m0]
---

# Mafrash reuse report

Mafrash (`../mafrash`) is the developer's earlier Arabic inventory app on Firebase. It was inspected read-only. Generic parts were first extracted into `templates/expo-firebase-starter`, and Be My Hand was created from that template. Nothing was copied from Mafrash's `.env`, `google-services.json`, `GoogleService-Info.plist`, or data.

> [!note] Later change
> The adapted theme (`constants/theme.ts`, `useAppTheme`) was replaced in refactor v4 by `src/theme` (`useTheme()`, design tokens). The rows below describe what was reused at the time. See [[design-system]].

## What Mafrash uses

| Area | Mafrash |
|---|---|
| Expo / RN / React | Expo SDK 57, React Native 0.86.3, React 19.2.3 |
| TypeScript | 6.0, `strict: true`, `@/*` alias |
| Firebase SDK | **React Native Firebase 26** (native): app, auth, firestore, functions, storage. The JS `firebase` package is only a dev dependency for rules tests. |
| Navigation | Expo Router 57, `src/app`, groups `(auth)` and `(tabs)` |
| Theme | `constants/theme.ts` token object (colors light/dark, fonts, spacing, radii, shadows), `useAppTheme` with persisted preference |
| RTL / i18n | Forced RTL with `I18nManager.forceRTL` + `reloadAppAsync`; `useI18n()` stub returning text as-is; Arabic text inline in components |
| Fonts | IBM Plex Sans Arabic via `@expo-google-fonts` |
| Auth | Email/password + Google Sign-In, account linking, `users/{uid}` profile snapshot |
| Firestore patterns | `firebase/repository.ts` and `domain/operations/*` executed on device; an AsyncStorage queue for business operations that wait for the network |
| Rules | `firestore.rules` with role/yard checks; tests with `@firebase/rules-unit-testing` + emulator |
| Config | `app.json`, `.env` for Google client id, placeholder native config files in repo root |
| Build | Dev client, EAS profiles (development, preview APK, production), `withRNFirebaseDisableSPM` plugin for iOS |
| State | Zustand + AsyncStorage persistence |
| Forms | react-hook-form + zod |

## Decisions

| Item | Decision | Reason |
|---|---|---|
| React Native Firebase (native) | **Reuse** | Durable offline persistence across restarts; the JS SDK on RN does not have it. Required by the spec. |
| Expo 57 / RN 0.86 / TS strict | **Reuse** | Known-good versions already building on the developer's machine. |
| Expo Router layout, auth gate | **Adapt** | Groups become `(auth)`, `onboarding`, `(app)`; gate also checks workspace membership. |
| Theme tokens + `useAppTheme` | **Adapt** | Same shape, neutral teal palette, extra semantic tokens (`onPrimary`, `successSoft`, ...). |
| RTL bootstrap | **Adapt** | Direction follows the active language instead of always forcing RTL; still reloads once. |
| `useI18n` stub | **Replace** | `i18next` + `react-i18next` + `expo-localization`, `ar` default, `en` ready, no inline strings. |
| UI kit | **Adapt** | Split into small primitives; removed calendar and inventory sync banner; added `ErrorState`, `PressableCard`. |
| Toast + action feedback bus | **Reuse** | Lets services surface errors without React coupling. |
| Auth provider | **Adapt** | Email/password only, adds register. Google moved to an optional template module, not used here. |
| Functions / Storage modules | **Drop** | Spark plan only; no Cloud Functions, no Storage uploads. |
| AsyncStorage operations queue | **Replace** | Mafrash queues business operations. Be My Hand lets Firestore queue its own writes and uses a small MMKV outbox only for non-Firestore jobs (`services/sync/outbox.ts`). |
| Zustand preferences | **Reuse** | Theme and language. |
| react-hook-form + zod | **Reuse** | Same form pattern. |
| Rules test harness | **Adapt** | Same emulator approach, new tests for workspaces, invites, sessions. |
| `withRNFirebaseDisableSPM` | **Reuse** | Needed for iOS builds with RN Firebase. |
| `app.json` | **Replace** | `app.config.ts` reads identity and per-environment native config paths. |
| Inventory domain, Skia, map/polygon editors, image picker | **Drop** | Not related to this product. |

## Files and patterns reused (via the template)

- `plugins/withRNFirebaseDisableSPM.js` (unchanged)
- `eas.json` profiles (env added)
- Native Firebase client module pattern (`src/services/firebase/client.ts`)
- Auth provider shape, `users/{uid}` snapshot (`src/providers/auth-provider.tsx`)
- Auth error code mapping (now translation keys)
- Root layout: fonts, splash, RTL reload, theme provider, toast, auth (`src/app/_layout.tsx`)
- Theme token object and `useAppTheme`
- Toast provider and action feedback bus
- Arabic digit and text normalization (`src/utils/arabic.ts`)
- Rules test setup with `@firebase/rules-unit-testing`

## Deviations from Mafrash

- No Google Sign-In, Functions, or Storage.
- Firestore native queue is the write queue; no app-level queue for Firestore writes.
- Real localization with `ar` and `en` files.
- Native config files are never committed; they live in gitignored `firebase/dev` and `firebase/prod`.
- Separate Firebase projects for Be My Hand (dev and prod). Nothing is shared with Mafrash.
