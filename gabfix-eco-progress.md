# Gabfix Ecosystem Progress

| | |
|---|---|
| **Last updated** | 2026-11-25 |
| **Session** | Inspection reports now carry photos and measurements, the desk can dispatch from the approvals dialog, and the admin quote view shows the evidence; approvals queue, ERP inspection capture, the pricing-change warning, the booking-address 403 and the ERP sign-in freeze/show-password were fixed and browser-verified |

**Living document.** Ecosystem-level view across the three apps, the backend and the architecture
decisions. Updated at the end of every session that changes more than one area, and whenever a
milestone on the setup checklist closes.

| | |
|---|---|
| **Last updated** | 2026-11-25 (inspection photos + measurements; dispatch on confirm; approvals queue; ERP inspection capture; pricing-change warning; booking-address and ERP sign-in fixes) |
| **Repository** | `gabfix-eco` — `client-app/`, `erp-app/`, `admin-web/`, `backend/` (independent folders, no workspaces) |
| **Branch / commits** | `main`, 2 commits; a large working tree is uncommitted (see §7) |
| **Status legend** | ⬜ Not started · 🟨 In progress · ✅ Done and verified · 🚫 Blocked |

Detail behind each figure lives in the per-area sources: `client-app/Gabfix_UI_Progress.md`
(per-page ledger; restored from its parent commit on 2026-11-24 after the committed copy was found
zero-filled), `Technician_App_Setup_Checklist.md` (the 42-item setup backlog),
`erp-app/ERP_Release_Readiness_Checklist.md` (ERP release gates and the EAS quota block),
`Full_App_Architecture_2.md` (decisions and schema),
`client-app/Client_App_Ecosystem_Alignment.md` (cross-app documentation/code alignment), and
`client-app/Phase_2_Unified_Implementation_Checklist.md` (the merged Phase 2 Stages 1–3 execution
checklist across client, backend, admin and ERP). This file summarises and links; it does not
restate them.

---

## 1. Where the project stands

| Area | What it is | Progress | Status | Evidence / blocker |
|---|---|---|---|---|
| **Architecture decisions** | 25 numbered decisions (D1–D25) | **56%** (14/25) | 🟨 | Decided: D1–D10, D13, D20, D24, D25. Open: D11–D12, D14–D19, D21–D23. Source: `Full_App_Architecture_2.md` |
| **Client app** (`client-app/`) | Customer Expo app, 40 page builds | **69%** (68.9% weighted) | 🟨 | All 40 page builds exist and pass tsc/lint; Phase 1 closed with a mock API, a style gate and the 360/390/430 dp gallery sign-off; 0 of 40 device-verified; 15 Jest suites / 112 tests pass. Source: its own progress doc |
| **Admin web** (`admin-web/`) | React 19 + Vite 7 SPA for admin, manager, customer relations | **~71%** of its checklist (5/7) | 🟨 | Supabase Auth, role mapping (admin/manager/customer_relations→support), live bookings/items/assignments/addresses/profiles/technicians/payments/handovers/disputes, client typography; booking-form builder with version history published live against `service_form_definitions`; catalogue CRUD for categories and services (parent nesting, order, pricing mode, skill, popular rank/tag, image upload, active toggles) writes straight to `categories`/`services`; quotes/inspections queue (`pages/Quotes.tsx` + `lib/quotes.ts`) sends priced quotes, requests/schedules inspections, reads a submitted inspection report read-only and records accept/decline; approvals queue (`pages/Approvals.tsx` + `lib/approvals.ts`) confirms desk bookings, cancels with a reason and approves/declines cancellation requests through security-definer RPCs; catalogue browser-verified with category drag reorder and a pricing-mode change warning; shared modal portalled to `document.body`; promos/rate card/settings/notifications still mock; audit log, report export, browser a11y pass and deploy open |
| **ERP / technician app** (`erp-app/`) | Expo SDK 58 staff app, all roles, per-role screens | **~79%** (15/19 checklist items) | 🟨 | Foundation done: client-app tokens/fonts, auth gate, role-filtered tabs, live queries for jobs/schedule/cash/alerts/profile. Shell matches app-1 (65px flush tab bar, bell/avatar order, home hero, 16px/26-34px page titles); Alerts is a hidden route, not a tab. Jobs run On the way → Start → Complete with photos, cash on a job (`record_cash_payment`), cash+handover screen, AsyncStorage action queue replaying status/cash on reconnect, and Query cache persistence with a Profile "Waiting to sync" list. Inspection capture is in (`inspections/` list + `[id]` checklist, findings, measurements, hours/crew, photos to the private `inspection-media` bucket, `submit_inspection`) and the home screen counts visits waiting for a report. Open: push (B11), native pass, inspection video evidence, sales screens |
| **Backend** (`backend/`) | Supabase local stack + migrations, seed, functions | **~88%** of M2 scope | 🟨 | 14 migrations, 47 tables, RLS and audit triggers, capabilities/RPCs, private media buckets, catalogue seed mirrored to client and `npx supabase db reset` clean. Hono `api` is live locally for health/profile/auth/catalogue/services/search/availability/bookings/quotes/support/notifications. Auth batch added this session: `/auth/login`, `/auth/register`, `/auth/otp/request`, `/auth/otp/verify` (hashed `phone_otp_codes`, no SMS provider yet), `/auth/refresh`. Booking create enforces 3-hour lead + technician capacity, validates answers against the negotiated current form definition (409 `form_version_stale`), and writes the snapshot; `GET /services/:slug/form` resolves service-level then category definitions. `booking_media` + signed target/complete/refresh/delete with 10-item/25 MB/30 s/mime limits. Automated `backend/tests/api-contract.test.mjs` (12 tests) covers auth, media, booking, forms, cross-customer RLS, receipts RLS, quotes, support threads and notifications. `20261125160000_audit_log_actor_null.sql` drops the `audit_log.actor_id` FK so account deletion is not blocked by append-only audit rows. Catalogue reads, service detail/form and `POST /bookings` all drop services whose category is inactive. Remaining: payments/wallet/receipts, security/sessions, referral/review/push routes, webhooks, SMS delivery. |
| **Setup checklist** | `Technician_App_Setup_Checklist.md` | **24/42 items** | 🟨 | A1–A10, B1–B9, B10, C1, C3 (photo gate live), C4, C5 and D1 closed; B11, C2/C6–C8, D2+ and E/F open |

**Reading the numbers:** the 69% client-app figure is a weighted score across five tracks, where
"screen builds" (45% weight) is already 100% but device acceptance (15%) is 25% and backend contracts
(15%) are 19%. The three other areas are not on that rubric and are measured only against the setup
checklist, so an ecosystem-wide weighted percentage would be misleading. Use the row that matters for
the question being asked.

---

## 2. What has actually been verified

Only work with a passing check is listed here.

- **Client app:** `npx tsc --noEmit`, `npx expo lint`, `npx jest --runInBand` (13 suites / 105
  tests) all pass. Scripted headless-Chrome passes cover 13 page flows at 390 × 844, most recently
  the booking sheets and the address action menu (E7), with no console errors. No real-device pass
  exists, so no page is marked ✅.
- **Client app, Phase 1 close (2026-11-24):** `npx tsc --noEmit`, `npx expo lint`, `npx jest
  --runInBand` (15 suites / 112 tests) and `npm run check:style` pass. `mock/server.mjs` answered
  health, search, booking, idempotent replay, tracking and the OTP error case over HTTP. The `/dev`
  gallery was captured at 360 × 800, 390 × 844 and 430 × 932 with `scrollWidth === innerWidth` at
  every width. D25 phone tests cover `07` storage, display and masking; fixed-price and inspection
  stage tests were added. `erp-app` and `admin-web` typecheck with their copied D25 helpers.
- **Backend contract suite (2026-11-25):** `cd backend && npm test` (`node --test`) runs 12 tests against the local stack and all pass — auth login by email/phone, register 201/duplicate 409, OTP throttle/wrong-code/verify/refresh/replay, media validation (11 items, 30 MB video, 60 s video, gif), signed upload→complete→refresh 409→delete, another customer sees no media and gets 404 on the booking, receipts desk 201 / customer 403 / wrong `issued_to` 403, support one conversation per customer (D13) with an isolated thread, quotes visible to the booking customer and desk only, notifications read/mark-read owned by the customer. Fixtures are removed in `after`; a post-run query showed 0 fixture profiles, conversations, messages, notifications, quotes, media and OTP rows. `client-app` `tsc --noEmit` passes after the media/auth/form client changes.
- **Admin form builder (2026-11-25):** `admin-web` `npm run typecheck` and `npm run build` pass. The publish path was driven through the local REST/API as `admin@gabfix.ug`: v1 retired, v2 inserted 201, `GET /services/home-clean/form` returned v2, then v1 restored — the DB/RLS/API half is proven, the page itself was not clicked through in a browser.
- **Admin catalogue CRUD (2026-11-25):** `admin-web` `npm run typecheck` and `npm run build` pass; `backend` `npm test` 12/12. Against the same REST/RLS surface the page uses, signed in as `admin@gabfix.ug`: temporary category insert 201 → update 200, service insert 201 (quote) → update 200 (fixed, UGX 120,000), public `/catalogue` then served both; `service-icons` upload 200, public read 200, delete 200; temp rows/objects removed. Hiding the `outdoor` category removed its two services from `/catalogue` and returned 404 on `/services/pavers-laying`; restoring it brought both back (200). The new page itself was not clicked through in a browser.
- **Admin quotes, inspections and catalogue browser pass (2026-11-25):** `admin-web` `npm run typecheck` and `npm run build` pass. Headless Chrome as `admin@gabfix.ug` against the running dev server and local stack: created category “CDP Check”, created “CDP Service” in it, toggled it hidden (toast + grey switch), filtered by “CDP” (1 quote/service shown), and dragged categories so `display_order` became 10–70 in the new sequence, after which the tree re-rendered (seed order restored afterwards). On `/#/quotes`, a seeded `requested` quote for `GBX-DUE1` was priced at 180,000 and sent (status `quoted`, `quoted_at`, amount and coverage rendered), an inspection was requested and then scheduled with Daniel Cleaner for 27 Nov 10:30, and the already-quoted `GBX-LEAD` booking rendered its 250,000 sent block with expiry. Every request returned < 400 and no console exceptions were logged. Two defects were found in this pass and fixed: the shared `Modal` is now portalled to `document.body` (the `.page` animation transform made the fixed backdrop page-sized and pushed tall editors below the fold) and the catalogue price column no longer wraps “UGX 45,000/hr”. All quote, inspection and temporary booking-item fixtures were deleted afterwards.
- **Inspection evidence and dispatch from approvals (2026-11-25):** `admin-web` `tsc -b` + `vite build` and `erp-app` `tsc --noEmit` pass. The ERP capture screen now has a Photos card (camera or library → private `inspection-media` bucket at `<inspection_id>/<file>` + an `inspection_media` row, deleted again if the row insert fails) and measurement fields that submit `{"Floor area (m²)":"68","Rooms":"4","Ceiling height (m)":"2.8"}`; a submitted report renders them read-only. The admin quote modal signs those photos and shows them as thumbnails next to the checklist, notes and measures. The approvals confirm dialog gained an optional technician picker: confirming `GBX-APV1` with Daniel Cleaner chosen left the booking `confirmed`, one `job_assignments` row (`lead`, `assigned`) and the history row, and a failed assignment reports separately without hiding the confirmation. Browser evidence: ERP detail filled and submitted through the UI, desk modal screenshot with the photo and measures, approvals dialog screenshot. The photo upload/insert path was exercised with the component's own calls as `tech1@` (upload 200, row inserted with `uploaded_by`, signed read 200) because a file picker cannot be driven headlessly; fixtures, probe row and probe object were removed. No native pass.
- **Approvals, inspection capture and the two reported defects (2026-11-25):** `admin-web` `npm run typecheck` and `npm run build` pass; `erp-app` and `client-app` `tsc --noEmit` pass. Headless Chrome as `admin@gabfix.ug` on `/#/approvals`: confirmed `GBX-CNF1` with a note, cancelled `GBX-CXL3` with a reason, approved `GBX-CXL1`, declined `GBX-CXL2`; the DB ended with the two statuses, both `cancel_reason`s, the requests `approved`/`declined` with `decision_note`, and three `booking_status_history` rows. On `/#/catalogue`, switching a service from fixed price to hourly refused the first save with `.form-warning` and a `Save anyway` footer (Cancel left `fixed`/85,000), and `Save anyway` persisted `hourly`/50,000 (reverted afterwards). On `/#/quotes`, a submitted inspection rendered read-only with checklist chips, findings, 4.5 h × 2 and the state report. The ERP web export was driven as `tech1@gabfix.ug`: `/inspections` listed one open visit and one sent report, the capture screen flagged a checklist item, saved findings with 4 h/2 cleaners and submitted, after which the inspection was `submitted` and its quote `inspected`; `Complete job` on `GBX-DUE1` left the DB at `completed`. Two defects reported by the user were fixed: every device-local address id (`home`, `work`, `ntinda`, `addr-…`) was rejected by `POST /bookings` with 403 and the client replaced the server message, so quote requests failed — the API now resolves or saves a real `addresses` row and the client surfaces `error.message` (verified over REST: `ntinda` + a new street each created one row, re-submitting reused it, a real owned address still worked); and the ERP sign-in disabled its inputs while a request was in flight and never timed out, so a slow request froze both fields — the fields now stay editable, the request times out after 20 s with a message, the password field has a show/hide toggle, and completing a job confirms and returns to the job list. All fixtures and probe rows were deleted; `GBX-DUE1` and `GBX-LEAD` are back to `in_progress`. No native device pass, so the reported device behaviour could not be reproduced there.
- **ERP app:** `npx tsc --noEmit` and `npx eslint src` clean (the pre-existing template error went
  with the deleted `app-tabs`). The web export served locally was driven through the Chrome DevTools
  protocol against the local stack: `/` redirects to `/sign-in`; `tech1@` signs in and lands on
  `/jobs` with its 3 assignments; `desk@` gets only Jobs/Alerts/Profile and the desk-wide list;
  `manager@` gets the full tab set; a card tap opens `/jobs/<id>` with customer, phone and address;
  cash, alerts and profile render; Sign out returns to `/sign-in`. No console errors. The job
  status flow was then driven the same way on `GBX-DUE1` (Standard home clean, hourly): On the way →
  In Progress → billed `2` hours → Completed, with `bookings.billed_hours = 2.00`, new
  `booking_status_history` rows, and the action bar swapping per status; demo state restored after.
  Sign-in from a LAN address was also fixed and verified: `src/lib/env.ts` rewrites the loopback
  Supabase URL to the page/Metro host, so `http://192.168.1.196:8082` signs in against
  `192.168.1.196:54321` (all 200s, lands on `/jobs`). Not verified: the native runtime (fonts,
  splash, tab bar) — no device or simulator run yet.
- **ERP shell, latest pass:** `/` → `/home` as `tech1@`; home hero shows "Hello, Daniel Cleaner",
  stats 0/1/1, the next job and quick actions; tab bar renders Home · Jobs · Schedule · Cash ·
  Profile (65px, flush to the bottom, same metrics as app-1) and the bell opens `/notifications`
  without giving Alerts a tab slot. Jobs list segments read Today · 0 / Upcoming · 1. The photo
  card compiles and queries `job_photos`; camera/library capture itself still needs a device.
- **ERP parity + cash, latest pass:** measured against app-1 in the same 500×805 headless viewport —
  avatar 36×36 at (400,18) with the bell after it, hero text at exactly app-1's offsets ("Hello,"
  14/20 at 16,12 · name 20/28 at 16,32), page titles at 16,16 in Poppins 26/34 with the subtitle at
  16,54, and both tab bars at left 0 → bottom 805, 65px tall, radius 0, 1px top border. Login lands on
  `/home`; bell → `/notifications`. Recorded UGX 5,000 cash on `GBX-DUE1` as `tech1@`: a `payments`
  row with `method = cash` and the detail chip flipped to “paid” (test row deleted); `/cash` renders
  today's total, the payments list and the handover form.
- **Admin web:** `npm run typecheck` passes; in the browser the active sidebar item computes to
  `rgb(247, 235, 21)` and Overview renders the gradient hero with greeting and four stats.
- **Admin web:** `npx vite build` → 54 modules, built in 11.65s; `npm run typecheck` clean, both
  after the alias repair.
- **Backend:** all containers healthy; `npx supabase db reset` applied migrations
  `20261123120000`–`20261124130000_catalogue_keys` plus `seed.sql` cleanly. Earlier REST/RLS/RPC smoke
  remains valid for prior baseline; this session added local smoke: availability subtraction with a
  temporary assigned booking (10:00–12:00 Kampala blocked 09:00/10:00/11:00, surrounding slots free),
  booking create 201 for a free slot, idempotent replay same booking/id, 409 for <3h lead, 409 for
  occupied slot, 400 for unknown form field, 400 for missing required form field, 201 valid form
  booking with `booking_form_snapshots` row, and cleanup of all temp probe rows/keys.
- **Backend, 2026-11-25 media + receipts pass:** `db reset` clean through
  `20261125120000_booking_media`. Media smoke: `POST /bookings` with one image returned an
  `uploads` target; PUT to the signed URL 200; `/complete` 200 (`status = uploaded`); `/refresh`
  409 `already_uploaded`; `DELETE` 200. Limits: 11 items 400, 30 MB video 400, 60 s video 400,
  `image/gif` 400. Receipts: desk insert for the booking's customer 201; customer insert 403;
  desk insert with another customer's `issued_to` 403; desk read 200. Smoke bookings, media row,
  receipt and idempotency keys deleted; seed bookings unchanged. `admin-web`/`erp-app` DB types
  regenerated; admin `queries.ts` now skips laundry payments without `booking_id`; both
  `tsc --noEmit` pass.

---

## 3. Repo map and who uses what

| Folder | App | Users | Data access |
|---|---|---|---|
| `client-app/` | Customer mobile app (Expo) | Customers | One Hono `api` edge function (D1); local fallback stores today |
| `erp-app/` | Staff mobile app (Expo) | Technician, laundry operator, sales operator, plus desk roles | Supabase client directly, RLS in charge (§5) |
| `admin-web/` | Staff web app (Vite SPA) | Admin, manager, customer relations | Supabase client directly, RLS in charge |
| `backend/` | Supabase project | — | Postgres, auth, storage, realtime, edge functions |

Rules the apps must keep: no shared packages or code between apps (generate DB types per app),
technicians see only assigned jobs, dispatch decides assignment (technicians never claim jobs), and
the client app never talks to Supabase directly.

---

## 4. Blockers, in the order they block work

1. **`erp-app/` screens exist but are unproven in the field** — the foundation is done and queries
   return RLS-scoped rows over REST, but nothing has been signed in on a device, and the job flow,
   photos, offline queue and push are unwritten (C3/C4, B9, B11).
2. **`admin-web/` is mock-only.** Auth and reads are no longer blocked on schema work — only on
   D2–D3 (Supabase client + query migration).
3. **Storage policies are still untested from a real client.** The status RPCs now run from the
   ERP app itself (C3 flow verified in the browser build), but photo upload (C4) has never touched
   the `job-photos` bucket. Edge functions (`api`) remain unwritten.
   Two RLS/route defects surfaced in the first web sign-in pass and are fixed (assigned-technician
   address read; nested Jobs stack) — expect a few more of these as screens get used.
4. **No device build has ever been run** for either Expo app, so client-app work cannot reach ✅ and
   push notifications cannot be tested (Expo Go cannot receive them).
5. **Open architecture decisions that shape screens:** D11 (fees, tips, promos, referrals), D12
   (payment/SMS provider), D13 (chat and tickets), D21 (live tracking), D22 (admin web framework —
   Vite is already in use and should be recorded), D23 (staff GPS trail).

---

## 5. Next milestones

| # | Milestone | Unlocks | Tracked as |
|---|---|---|---|
| M1 | ✅ Local stack up; API URL + anon key copied into each app's env | Every app's real-data work | Checklist A1–A2 |
| M2 | ✅ Migrations with RLS + RPCs + local seed + generated types (`db reset` clean, REST checks passed) | Jobs, cash, photos, admin reads | Checklist A3–A9 |
| M3 | ✅ `erp-app` foundation: identity, tokens, fonts, providers, route skeleton, auth, capability gate (device sign-in still unproven) | Any technician screen | Checklist B1–B8 |
| M4 | Technician slice: jobs list → detail → status flow → photos | First demoable staff mobile app | Checklist C1–C4 |
| M5 | Admin web on real data with the client-app visual language | A usable operations desk | Checklist D2–D5 |
| M6 | Offline queue, push, cash, schedule; client-app device pass | Field reliability, release readiness | Checklist B9–B11, C5–C8, E1–E3 |

---

## 6. Design and theme status

- **Canonical tokens** live in `client-app/src/theme/tokens.ts`: greens `#118E45` / `#1A5E2F` /
  `#1C411E`, yellows `#F7EB15` / `#E7BE1F`, `bg #F6F8F6`, `text #16221A`, radii 12/14/20/28/40,
  spacing on a 4-point scale, Poppins headings + Inter body.
- **Admin web** already mirrors those values as CSS variables in `src/styles.css`, so the remaining
  work there is component and page-level alignment, not a recolour.
- **ERP app** now imports the same token set (`erp-app/src/theme/`) and loads Poppins + Inter, so
  screens style from tokens only. Screen-level design is still a first pass; the client-app page
  standard (states, sheets, card density) is the remaining work in track C.
- Client-app progress doc treats licensed photography as a content input (Open item 18), not a code
  gap — the same applies to the portal.

---

## 7. Working-tree notes

Uncommitted at the time of writing: client-app E7 sheet migration and the earlier session work
(booking steps, payments, wallet, draft exit), `client-app/Gabfix_UI_Progress.md`,
`Technician_App_Setup_Checklist.md`, this file, `admin-web/vite.config.ts` and
`admin-web/tsconfig.json` (the alias fix), `erp-app/` (foundation, screens, assets), the six
`backend/supabase/migrations/*.sql` files plus
`backend/supabase/seed.sql`, the newly generated `database.types.ts` in both frontends, and the
untracked `erp-app/` and `Full_App_Architecture_2.md` (which includes the deletion of the old
`Full_App_Architecture.md`). Nothing has
been pushed. The client app's own backlog lists "commit the working tree" as its first device-verification
step, since every existing APK predates the current screens.

Added on 2026-11-24 and still uncommitted: `client-app/mock/`, `client-app/scripts/check-style.mjs`,
the D25 phone helpers/tests, the D6/D9 client changes, `erp-app/src/lib/phone.ts`, and
`admin-web/src/lib/phone.ts` plus its query formatting. `client-app/Gabfix_UI_Progress.md` was also
restored from `cec9681^` because the committed copy was 227,984 NUL bytes; the session rows were
re-applied on top.

Added on 2026-11-25 and still uncommitted: `admin-web/src/pages/Catalogue.tsx`,
`admin-web/src/lib/catalogue.ts`, `admin-web/src/pages/Quotes.tsx`, `admin-web/src/lib/quotes.ts`,
their `App.tsx`/`Sidebar.tsx`/`Topbar.tsx`/`types.ts`/`styles.css` wiring, the `ui.tsx` modal
portal fix and the category-active filters in `backend/supabase/functions/api/index.ts`.

---

## 8. Update rule

When a session ends, update three things here: the last-updated row, the area table in §1 (only rows
that moved, with the evidence in §2), and the milestone table if a milestone closed. Report the
client-app figure and the setup-checklist count in the reply, and point to the per-area document
where the detail changed rather than duplicating it.
