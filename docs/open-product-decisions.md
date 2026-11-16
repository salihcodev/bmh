---
tags: [be-my-hand, docs, decisions]
---

# Product decisions

## Decided in v1 (changeable behind config)

| Topic | Decision | Where to change |
|---|---|---|
| Meaning of Check | Processed status only. Delivery is a separate confirmed assistance record. UI label "تم" / "Done". | `src/domain/session-config.ts`, `localization/*.json` |
| Session resume | Sessions persist in Firestore + cache; the operator resumes after interruption. | — |
| Multiple users per session | No. Single operator; `sessions_reassign` can reassign. | rules + `features/sessions` |
| Ignored beneficiaries | Stay ignored; operator can reopen while the session is active. | `src/domain/session-logic.ts` |
| Multiple assistance types per session | Allowed by the model (no uniqueness). | — |
| Beneficiary in multiple areas | No (one area). Schema could add `areaIds` later. | — |
| Map pins | General locations with optional label. | — |
| History visibility | `history_view`, default on for all roles. | `matrix.ts` |
| Edit conflicts | Per-field last-write-wins via targeted `update`, with before/after history. Arrays (phones, pins) are last-write-wins as a unit. | `features/beneficiaries/repository.ts` |
| Session cap | 100 beneficiaries per session. | `src/domain/session-config.ts` + rules |
| Invite expiry | 7 days default, max 31 days. | `features/members/invites.ts` + rules |
| Suspension | App gate (`/suspended`) plus light rules: suspended users cannot edit their profile or write platform content; workspace rules do not check suspension (it would cost a read per request). An owner disables the membership for a hard stop. | `firestore.rules` `isSuperAdmin()` / users, `src/domain/route-guard.ts` |
| Super admin and tenant data | No access to beneficiaries, sessions, history, assistance or invites of other workspaces; only workspace metadata, memberships and users. | `firestore.rules`, `tests/rules/admin.test.ts` |
| Granting super admin | Firebase console only; super admins cannot suspend each other. | [[security#Platform roles (super admin)]] |
| Media removal | Cloudinary `delete_by_token` within 9 minutes of upload (Undo); afterwards the record is archived and the file stays in Cloudinary (deleting it needs the API secret, which never ships in the app). | `services/media/upload-rules.ts` |
| Support / donations | Shown only when `appConfig/support.isEnabled` and a real InstaPay link or address exist; placeholders count as missing. | `src/domain/marketing.ts` |

## Deviations from the spec (documented)

- **Invite listing.** The spec says invites are never listed. Rules allow `list` only for `members_manage` holders so admins can see and revoke pending invites. Non-managers still can only `get` by code.
- **Session `draft` status.** Sessions are created directly as `active` because starting requires a fresh snapshot. `draft` stays in the type for a future "save setup".
- **Small collections stay live listeners.** Members, invites, cities and areas use one listener each instead of `usePaginatedQuery` (tens of docs; pagination would add reads and complexity).
- **Workspace delete.** Rules allow the Owner to delete the workspace doc, but the app does not expose it in v1, because subcollections would remain (no Cloud Functions to cascade).

## Open questions

- [ ] Should Members ever be allowed to create beneficiaries by default? (Currently no.)
- [ ] Should a session be startable for a city without selecting areas (all areas)? Currently "select all" covers it.
- [ ] Assistance confirmation flow UI: who confirms, and is a photo/signature needed? (Storage is out of scope on Spark.)
- [ ] Should ended sessions be exportable by users without `beneficiaries_export`? Currently export needs it.
- [ ] Retention: is there a need to anonymize archived beneficiaries after some time?
- [ ] Production bundle id confirmation (`com.salihcodev.bemyhand`).
- [ ] Should archived Cloudinary assets be purged periodically by a local script (with the API secret in `.env.scripts`)?
- [ ] News, marketing cards, feedback, support config and app config are placeholders in Manage (`ComingSoon`); is editing them in the Firebase console enough for v1?
