# Design system

Single source of truth: [`src/theme/tokens.ts`](../src/theme/tokens.ts). Components live in [`src/components/ui`](../src/components/ui) and read every value through `useTheme()` and the token exports. Screens never use raw hex colors, font names, numeric radii or Cloudinary URLs; `pnpm check:tokens` (in CI) fails if they do.

Open the dev catalogue at `/dev/design-system` (development builds only; production redirects home). It shows every token and component with light/dark and LTR/RTL toggles.

## Tokens

### Colors

The four reference colors are fixed and tested (`tests/design-tokens.test.ts`):

| Token | Value | Use |
|---|---|---|
| `palette.ink` | `#202020` | Text, primary buttons, selected chips, toasts |
| `palette.lime` | `#C9F158` | Brand accent: FAB, switches, avatar ring, tags, highlighted stat. Always carries ink text or icons |
| `palette.canvas` | `#F2F3F5` | Screen background, inputs, icon tiles |
| `palette.white` | `#FFFFFF` | Cards, grouped lists, sheets, tab bar |

Semantic colors (`colors.*`) are derived from these. Dark mode uses `#121212` background, `#1C1C1E` surfaces and lime as the primary action color (with ink text).

**Deviations from the prompt values, made for WCAG AA.** The contrast test checks every text/background pair in both themes:

| Token (light) | Prompt value | Used | Why |
|---|---|---|---|
| `textSecondary` | `#7B7F86` | `#6B6F76` | 4.5:1 on canvas and white |
| `textTertiary` | `#A3A7AD` | `#8A8F96` | 3:1 for placeholders, chevrons and captions |
| `success` | `#2E9E44` | `#237A36` | 4.5:1 on its tint (badges) |
| `warning` | `#F5A524` | `#8F5300` | 4.5:1 on its tint |
| `danger` | `#E5484D` | `#C4262C` | 4.5:1 on white and on its tint |
| `info` | `#3B82F6` | `#2560C8` | 4.5:1 on its tint |

Dark-mode status colors keep lighter values (for example `warning` `#FFB84D`) and pass the same test.

Lime on white is about 1.3:1, so lime is **never** used for text or thin icons on white.

### Typography

- Latin and numbers: **Space Grotesk** 400 / 500 / 700 (no 600 exists; semibold maps to 700).
- Arabic: **IBM Plex Sans Arabic** 400 / 500 / 600 / 700. Cairo is not used anywhere.
- `AppText` picks the family from the text itself (`detectScript`: any Arabic letter selects IBM Plex Sans Arabic). Non-text children fall back to the UI language.
- Arabic gets +1 size and +4 line height (`arabicAdjust`). Latin headings use -0.2 tracking.
- Numbers, phone numbers, emails and codes render LTR (`ltr` prop on `AppText`, `TextField`; `PhoneField` is always LTR).
- Font size scales with the OS setting up to 1.6x (`maxFontSizeMultiplier`).

| Variant | Size / line | Weight |
|---|---|---|
| `display` | 32 / 38 | bold |
| `h1` | 28 / 34 | bold |
| `h2` | 22 / 28 | bold |
| `h3` | 18 / 24 | bold |
| `bodyLg` | 16 / 24 | medium |
| `body` | 15 / 22 | regular |
| `bodySm` | 13 / 18 | regular |
| `label` | 13 / 18 | medium |
| `caption` | 12 / 16 | medium |

Legacy variants map to these: `title` to `h1`, `heading` to `h3`, `subtitle` to `bodySm`. The old `constants/theme.ts`, `useAppTheme()` and the named spacing and color aliases were removed in R9; `src/theme` is the only source.

### Spacing, radii, sizes

- 4pt grid: `spacing[1..12]` = 4 to 48. Screen side padding is `screenPadding` = 20.
- Radii: xs 8, sm 12 (icon tiles), md 16 (inputs), lg 20 (row tiles), xl 24 (cards), xxl 28 (bottom sheets, tab bar), `iconButton` 14, `pill` for buttons, chips and badges.
- Sizes: button 56 (compact 44), input 56, chip 40, icon button 44, icon tile 40, tab bar 72, FAB 60, field-mode thumb action 72 (`thumbAction`). Minimum touch target 44.
- Icons: lucide, 20pt, stroke 1.75.
- Elevation: only floating elements (FAB, tab bar, toast, sheets). Cards use contrast, never shadows.
- Motion: 150 / 250 / 350 ms; press scale 0.98; skeletons appear after 150 ms and stay at least 400 ms; carousel autoplay 5 s. Reduce motion turns off autoplay and shimmer.

## Components

| Component | Pattern |
|---|---|
| `Screen` | Grey canvas, safe-area top, 20pt padding, pinned `footer` for the primary CTA, `surface="white"` for focused forms |
| `Header` | Outlined 44x44 back button (radius 14, mirrored in RTL), centered title, trailing slot; `large` for tab roots; `tag` for "SUPER ADMIN" |
| `AppHeader` | `Header` plus the sync status icon (workspace screens) |
| `Button` | Pill, 56pt; `primary` (ink / lime in dark), `secondary` (outlined), `lime`, `ghost`, `destructive` (`danger` alias); async-aware loading |
| `IconButton` | 44x44 square-rounded; `outline`, `filled`, `ink`, `lime`, `ghost`; `round`; unread `dot` |
| `Card` / `PressableCard` | White, radius 24, padding 20, no shadow; tones `muted`, `ink`, `lime` |
| `GroupedList` + `ListRow` | White card with hairline dividers, or `tiles`; row = icon tile, label, hint, value, trailing control, RTL chevron |
| `SectionHeader` / `Section` | Bold title at start, small action link at end |
| `Chip` | Selected: ink pill with x; unselected: outlined, optional chevron (`dropdown`) |
| `Badge` / `Tag` | Small pill; lime is the brand tag |
| `Avatar` | Initials (no photo uploads), lime ring when active, edit badge |
| `Switch` | Lime track |
| `TextField` / `Field`, `PhoneField`, `SelectField` / `Select`, `SearchBar` / `SearchField` | Filled grey inputs, label above, helper or error below |
| `BottomSheet` / `Sheet` | Drag handle, radius 28, dimmed backdrop, optional pinned footer |
| `ConfirmDialog` | Bottom-sheet confirmation, destructive variant |
| `ConfirmHost` / `confirmAsync()` | The same dialog for non-component code (returns `Promise<boolean>`). Mounted once in the root layout. Native `Alert` is not used. |
| `SelectableCard` | Radio tile with ink border and dot when selected |
| `StatCard` | Big LTR number and label; `lime` for the highlighted one |
| `Carousel` | Paging with peek and dots; autoplay pauses on touch and under reduce motion |
| `EmptyState`, `ErrorState`, `NoPermissionState`, `ComingSoon`, `LoadingState`, `ListFooter` | Icon tile, title, hint, next action |
| `Skeleton*`, `useDelayedLoading` | Pulse placeholders shaped like the content |
| `ToastProvider` / `useToast` | Ink toast with status icon and optional action (Undo) |
| `InlineBanner`, `ProgressBar` | Offline / sync notices; upload and step progress |
| `Fab` | Lime 60pt circle (label is the accessibility name; `extended` shows it) |
| `TabBar` | Floating white bar; active tab is an ink pill with its label |

Lists use `usePaginatedQuery` ([`src/hooks/use-paginated-query.ts`](../src/hooks/use-paginated-query.ts)): live first page, 20-item cursor pages, de-duplication, pull-to-refresh, footer retry. Its state logic is unit-tested in `tests/pagination.test.ts`.

## Per-screen compliance checklist

Run this for every screen against the reference images, using `/dev/design-system` for comparison. Record the result in `APP_PROGRESS.md`.

- [ ] **Tokens only.** No hex, `rgb()`, font names, numeric radii or Cloudinary URLs (`pnpm check:tokens` passes).
- [ ] **Header pattern.** Outlined square back button at the start, centered title, actions at the end; tab roots use the large title.
- [ ] **Grouped cards.** Related rows sit in a white `GroupedList` on the grey canvas; no hairline-only lists on the canvas.
- [ ] **Buttons.** Primary CTA is a 56pt pill pinned in the `Screen` footer; one primary per screen; destructive actions use `destructive` and confirm first.
- [ ] **Chips.** Selected chips are ink with an x; unselected are outlined.
- [ ] **Lime usage.** Lime only as a fill with ink content (FAB, switch, ring, tags, highlight); never lime text on white.
- [ ] **States.** Loading (skeleton after 150 ms), empty (with next action), error (with retry), offline banner, no permission, end of list.
- [ ] **RTL.** Arabic first: layout mirrors, chevrons and back arrows flip, numbers and phones stay LTR.
- [ ] **Dark mode.** Readable in dark, lime primary with ink text, no hard-coded light colors.
- [ ] **Touch targets.** Every control is at least 44x44 (use `hitSlop` for small icons).
- [ ] **Type.** Arabic renders in IBM Plex Sans Arabic, Latin in Space Grotesk; the text scales to 1.6x without clipping.
- [ ] **Accessibility.** Roles, labels and states on every control; live regions on toasts and form errors.
