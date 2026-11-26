# Gabfix Ecosystem Progress

| | |
|---|---|
| **Last updated** | 2026-11-26 |
| **Session** | App payments now reach the desk ledger (new `POST /bookings/:id/payments`) and were clicked through in the Expo web build, the ledger keeps the exact payment method (Visa/MTN/Airtel) instead of the retry key, registration now refuses a number that already has an active account, plus quote expiry + push delivery, accepted quotes visible to the assigned cleaner and the customer, client deposit/balance payment with a typed amount, assignment refresh on booking detail, and the ERP release-build crash fixed from `portal_fix.md` |

**Living document.** Ecosystem-level view across the three apps, the backend and the architecture
decisions. Updated at the end of every session that changes more than one area, and whenever a
milestone on the setup checklist closes.

| | |
|---|---|
| **Last updated** | 2026-11-26 (cash the cleaner records in the ERP now reaches the customer’s own dashboard and wallet as a confirmed cash payment, and service images can finally be uploaded from the admin catalogue; a job completed by the cleaner in the ERP now moves to Completed in the customer app; admin Bookings rows are clickable and open one dialog with the full booking and the cleaner assignment; the wallet's Pay balance drawer takes a typed amount up to the balance due, like the booking detail; in-app checkout/deposit/balance payments now write a `payments` row so the desk ledger sees them, verified by clicking the balance flow in the Expo web build, with the exact method kept in `provider` and sign-up refusing a number that already has an active account; quote expiry every 15 min and Expo push on quote send; accepted quotes show the assigned cleaner in the client and on the ERP dashboard; booking detail now re-pulls dispatch’s assignment; client part-payments accept a typed amount up to the balance due; ERP `env.ts` no longer reads `window.location` on native, which was crashing the release APK) |
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
| **Architecture decisions** | 25 numbered decisions (D1–D25) | **72%** (18/25) | 🟨 | Decided: D1–D10, D13, D14, D15, D16, D17, D20, D24, D25. Open: D11 (late fees/tips/promos/referrals), D12 (payment + SMS provider), D18 (laundry), D19 (legacy data), D21 (live tracking), D23 (staff GPS trail). D22 (Vite + React console) is implemented but has no written decision text. Reconciled with the client alignment doc on 2026-11-25; the earlier “14/25” counted D13–D17 as open. Source: `Full_App_Architecture_2.md` |
| **Client app** (`client-app/`) | Customer Expo app, 40 page builds | **69%** (68.9% weighted) | 🟨 | All 40 page builds exist and pass tsc/lint; Phase 1 closed with a mock API, a style gate and the 360/390/430 dp gallery sign-off; 0 of 40 device-verified; 15 Jest suites / 112 tests pass; the Expo web build now accepts a quote into a confirmed booking and pays a 30 % deposit through `/payment/[id]` (verified in headless Chrome). Source: its own progress doc |
| **Admin web** (`admin-web/`) | React 19 + Vite 7 SPA for admin, manager, customer relations | **~71%** of its checklist (5/7) | 🟨 | Supabase Auth, role mapping (admin/manager/customer_relations→support), live bookings/items/assignments/addresses/profiles/technicians/payments/handovers/disputes, client typography; booking-form builder with version history published live against `service_form_definitions`; catalogue CRUD for categories and services (parent nesting, order, pricing mode, skill, popular rank/tag, image upload, active toggles) writes straight to `categories`/`services`; quotes/inspections queue (`pages/Quotes.tsx` + `lib/quotes.ts`) sends priced quotes, requests/schedules inspections, reads a submitted inspection report read-only and records accept/decline; approvals queue (`pages/Approvals.tsx` + `lib/approvals.ts`) confirms desk bookings, cancels with a reason and approves/declines cancellation requests through security-definer RPCs; catalogue browser-verified with category drag reorder and a pricing-mode change warning; shared modal portalled to `document.body`; promos/rate card/settings/notifications still mock; audit log, report export, browser a11y pass and deploy open |
| **ERP / technician app** (`erp-app/`) | Expo SDK 58 staff app, all roles, per-role screens | **~79%** (15/19 checklist items) | 🟨 | Foundation done: client-app tokens/fonts, auth gate, role-filtered tabs, live queries for jobs/schedule/cash/alerts/profile. Shell matches app-1 (65px flush tab bar, bell/avatar order, home hero, 16px/26-34px page titles); Alerts is a hidden route, not a tab. Jobs run On the way → Start → Complete with photos, cash on a job (`record_cash_payment`), cash+handover screen, AsyncStorage action queue replaying status/cash on reconnect, and Query cache persistence with a Profile "Waiting to sync" list. Inspection capture is in (`inspections/` list + `[id]` checklist, findings, measurements, hours/crew, photos to the private `inspection-media` bucket, `submit_inspection`) and the home screen counts visits waiting for a report. The release-APK startup crash is fixed: `src/lib/env.ts` reads `window.location` only on web, so a native build no longer throws before the first render. An accepted quote becomes `confirmed`, and once dispatch assigns it the ERP home/jobs query returns it for the assigned cleaner (checked against the local DB; no new ERP screen was needed). Open: push (B11), native pass, dispute resolution, sales screens |
| **Backend** (`backend/`) | Supabase local stack + migrations, seed, functions | **~89%** of M2 scope | 🟨 | 23 migration files, 47 tables, RLS and audit triggers, capabilities/RPCs, private media buckets, catalogue seed mirrored to client and `npx supabase db reset` clean. Hono `api` is live locally for health/profile/auth/catalogue/services/search/availability/bookings/quotes/support/notifications. Auth batch added this session: `/auth/login`, `/auth/register`, `/auth/otp/request`, `/auth/otp/verify` (hashed `phone_otp_codes`, no SMS provider yet), `/auth/refresh`. Booking create enforces 3-hour lead + technician capacity, validates answers against the negotiated current form definition (409 `form_version_stale`), and writes the snapshot; `GET /services/:slug/form` resolves service-level then category definitions. `booking_media` + signed target/complete/refresh/delete with 10-item/25 MB/30 s/mime limits. Automated `backend/tests/api-contract.test.mjs` (12 tests) covers auth, media, booking, forms, cross-customer RLS, receipts RLS, quotes, support threads and notifications. `20261125160000_audit_log_actor_null.sql` drops the `audit_log.actor_id` FK so account deletion is not blocked by append-only audit rows. Catalogue reads, service detail/form and `POST /bookings` all drop services whose category is inactive. `20261125204000_quote_expiry_and_push.sql` adds `pg_cron` quote expiry, a `quotes` notification/push trigger, `queue_expo_push()` over `pg_net`, and `POST /device-tokens` registers a handset; `GET /bookings`/`GET /quotes` now include the assigned crew. Remaining: payments/wallet/receipts, security/sessions, referral/review routes, webhooks, SMS delivery, real-device push delivery. |
| **Setup checklist** | `Technician_App_Setup_Checklist.md` | **24/42 items** | 🟨 | A1–A10, B1–B9, B10, C1, C3 (photo gate live), C4, C5 and D1 closed; B11, C2/C6–C8, D2+ and E/F open |

**Reading the numbers:** the 69% client-app figure is a weighted score across five tracks, where
"screen builds" (45% weight) is already 100% but device acceptance (15%) is 25% and backend contracts
(15%) are 19%. The three other areas are not on that rubric and are measured only against the setup
checklist, so an ecosystem-wide weighted percentage would be misleading. Use the row that matters for
the question being asked.

**Plan-register reading (2026-11-25, latest):** the architecture plan's §11.3 register tracks 28 work
items — 3 🟦 ready for verification (A1, A2, F1), 18 🟨 and 7 ⬜ (C2 permanent deletion, G1 payments
adapter, H1 laundry workspace, J1 push delivery, K1 promos/referrals, M2 audit-log UI, Z1 release
pass). With partial credit that is **~69% of the plan** (21 of 28 items touched at all, none
release-verified). G3 (job costs/commission) and I1 (support inbox) moved this session, and E2 closed
the last visible gap in the quote-request path. The booking → quote → inspection → dispatch → job →
cash slice is the near-complete part; the money/provider/audit tail is what the rest is made of.
Decision counts are now reconciled at 18/25 (see §1) — the earlier plan figure of 20/25 and this
file's 14/25 were both wrong.

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
- **Console browser pass and a realtime defect (2026-11-25):** `admin-web` `tsc -b` + `vite build` pass. Headless Chrome as `admin@gabfix.ug` on the running dev server: the topbar pill read `Live`; **Job costs** showed its KPIs, queue and margin table, picked up a cost written from another session through realtime in ~3 s without pressing Reload, opened the approve modal and approved it (`job_costs.status = approved` in the DB); **Support** listed the probe thread with its unread count, opened it and sent a reply from the composer (`support_messages` gained the body, thread moved to `waiting_on_customer`); **Quotes & inspections** renders without the desk's accept/decline buttons. One real defect found and fixed: `lib/live.ts` reused the fixed channel topic `console-operations`, and `supabase.channel()` can hand back the channel that is still leaving (React 19 double-mounts effects in dev), so the console showed “Live” while no events ever arrived — each subscription now gets its own topic and both an in-page channel and the page's own subscription received `INSERT` events afterwards. Probe cost rows, the probe conversation and all temporary scripts were removed, and the headless profile was deleted.
- **Customer decides on a quote (2026-11-25):** `client-app` `tsc --noEmit` clean and `jest` 15/15 (112 tests); `admin-web` `tsc -b` + `vite build` pass. `POST /quotes/:id/respond` driven as `customer@gabfix.ug` against a `quoted` probe quote: `accept` → 200 with quote `accepted`, `responded_at` set, booking `confirmed`, `total_price` 95,000 and a `requested → confirmed` history row (“Customer accepted the quote.”); replay `accept` 200 idempotent; `decline` after accept 409 `quote_not_ready`; another/unknown quote 404; bad action 400. Probe booking, quote and history row deleted. The desk's Mark accepted/declined buttons and their write are gone from the console, and Bookings → Requests now lists server and legacy requests together, newest first, with accepted ones leaving the list. Not clicked through in the app or a browser.
- **Quote-request pipeline, job costs, support inbox and live console (2026-11-25):** `client-app` `tsc --noEmit` and `jest` (15 suites / 112 tests) pass; `admin-web` `npm run typecheck` and `npm run build` pass after regenerating `src/lib/database.types.ts` from the local stack. Migrations applied with `psql -f` (all `CREATE`, exit 0): quote-request trigger + backfill, job costs/commission, the 12-table `supabase_realtime` publication, and `job_cost_lines`. Verified against the same RLS/RPC surface the new pages call, signed in as `admin@gabfix.ug`: `GET /quotes` returned the enrichment (`bookingReference`, `serviceName`, `scheduledStart`, amount) for a booking the desk can see; `add_job_cost` → `job_cost_overview` (pending 1, commission held) → `decide_job_cost` approve → overview (costs 15,000, margin 12,000, pending 0) and `job_cost_lines` named the approver; the support queue listed a probe thread, its messages read, a desk reply inserted and the status moved to `waiting_on_customer`. Two defects surfaced this way and were fixed in place: `job_cost_overview` used `max(uuid)` (invalid) and `decide_job_cost` assigned text to a `cost_status` column. Probe cost rows and the probe conversation were deleted. The new pages themselves (Costs, Support) were **not** clicked through in a browser, and no device pass exists.
- **Admin quotes, inspections and catalogue browser pass (2026-11-25):** `admin-web` `npm run typecheck` and `npm run build` pass. Headless Chrome as `admin@gabfix.ug` against the running dev server and local stack: created category “CDP Check”, created “CDP Service” in it, toggled it hidden (toast + grey switch), filtered by “CDP” (1 quote/service shown), and dragged categories so `display_order` became 10–70 in the new sequence, after which the tree re-rendered (seed order restored afterwards). On `/#/quotes`, a seeded `requested` quote for `GBX-DUE1` was priced at 180,000 and sent (status `quoted`, `quoted_at`, amount and coverage rendered), an inspection was requested and then scheduled with Daniel Cleaner for 27 Nov 10:30, and the already-quoted `GBX-LEAD` booking rendered its 250,000 sent block with expiry. Every request returned < 400 and no console exceptions were logged. Two defects were found in this pass and fixed: the shared `Modal` is now portalled to `document.body` (the `.page` animation transform made the fixed backdrop page-sized and pushed tall editors below the fold) and the catalogue price column no longer wraps “UGX 45,000/hr”. All quote, inspection and temporary booking-item fixtures were deleted afterwards.
- **Inspection video, addenda and two desk fixes (2026-11-25):** `admin-web` `tsc -b` and `erp-app` `tsc --noEmit` pass. The ERP capture card is now "Photos & video" (`inspection-evidence.tsx`, `inspection-media.ts`) with a library video pill capped at 90 s; videos land in the same private bucket with `kind='video'` and the quote report plays them inline. Submitted reports stay locked, so the desk records corrections as `inspection_addenda` from the quote modal (admin/operations; the existing policy guards it) and the ERP report shows them in a "From the desk" card. The Bookings table shows the whole crew (`+ Moses Electric`) and the active inspection state (`Inspection report in · 04 Dec`). Defects found while testing: "Mark remitted" was refused by the `handovers insert` policy because the console inserted directly — it now calls a new `confirm_cash_handover` RPC (`confirm_cash` capability, stamps `confirmed_by`), verified from the console (row `Settled / Remitted`) and refused for a technician `42501`; and reassigning the same technician failed on `job_assignments_booking_id_technician_id_key` (also on the one-lead index) — `assign_technician` now updates the existing row, revives a removed one and hands the lead over, verified repeat/swap/revive through both the console and REST. Evidence screenshots taken for the ERP report, the addenda card, the Bookings crew column and the quote modal; fixtures, probe media and probe rows removed. No native pass, so neither picker was clicked.
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
- **App payments registered (2026-11-26):** every in-app checkout, deposit and balance payment was
  local-only — `store/bookings.ts` wrote AsyncStorage, the API had no payments route and the admin
  Payments page reads `payments`, so `GBX-6D117E` had 0 payment rows after a deposit. New
  `POST /bookings/:id/payments` (reference or UUID, ownership check, balance guard, idempotency key,
  service-role insert because customer RLS cannot insert payments) and `recordBookingPayment` on
  the client; `/payment/[id]` only reports success once the row exists. Verified against the local
  stack: 201 + one row, replay reuses it, over-balance 400; probe booking deleted. `client-app`
  `tsc --noEmit` + pricing/wallet 22 tests pass. Payments made before this change stay local-only.
- **Payment click-through + ledger method + duplicate accounts (2026-11-26):** the balance flow was
  driven end to end in the Expo web build (headless Chrome, real `customer@gabfix.ug` session,
  seeded `GBX-DUE1`): booking detail → "Pay balance" → Visa card → simulated approval, ending on
  “Balance paid. Receipt available.” with a real row (`20,000`, `app`, `visa_card`, key in
  `provider_reference`) and the booking settled at 90,000. That click-through exposed a defect:
  the route stored `key:<Idempotency-Key>` in `payments.provider`, so `admin-web` labelled every
  in-app payment “MTN MoMo” (it read the method regexes against the key). `provider` now holds the
  exact method and the retry key lives in `provider_reference`; verified by a probe booking with
  `visa_card` (new row, then replay by key returned the same payment id) and the probe was deleted.
  Also: `POST /auth/register` now rejects a number that already belongs to an active profile with
  409 `account_exists` before any Auth user is created (checked on both `0772…` and `+256…` forms).
  The DB already forced `07XXXXXXXX` plus `UNIQUE (phone)`, so that guard mainly replaces an
  orphan-Auth-user 400 with a clear message; same person with a *different* number stays
  undetectable without verified phone/email (D12). Backend 12/12 tests, client `tsc` clean. The
  deposit paid on `GBX-6D117E` before the fix is still only in the phone's storage.
- **Quote acceptance, assignment and deposit (2026-11-26):** probe quote for Alice accepted in the
  Expo web build: quote `accepted`, booking `confirmed`, total 250,000, history row “Customer
  accepted the quote.”, and the local booking carried `cleanerName: Daniel Cleaner`. The detail
  screen showed “Confirmed / Daniel Cleaner”, the deposit sheet offered UGX 75,000, and the
  simulated authorisation left `paid 75,000`, `balance 175,000`, `depositPayment` in the store.
  The ERP home query (`ACTIVE_STATUSES` + `job_assignments.technician_id`) returned the confirmed
  booking for Daniel. DB trigger + expiry: sending a price wrote the notification and `pg_net`
  reached `exp.host` (200; fake token rejected), `expire_stale_quotes()` closed 1 stale quote and
  notified the customer, and `cron.job` has the 15-minute schedule. `POST /device-tokens` returned
  201, 400 for a bad platform/missing token and 401 anonymously, and reassigned an existing token to
  another account. Probe booking, quote, assignment and tokens deleted afterwards. `client-app`
  `tsc --noEmit` + 112 tests, `erp-app` `tsc --noEmit`, `backend` 12 contract tests pass.
- **Admin deploy + merged duplicate accounts (2026-11-26):** the Vercel build of `admin-web` failed in
  `vite:esbuild` with `failed to resolve "extends":"expo/tsconfig.base" in client-app/tsconfig.json`.
  esbuild reads the nearest `tsconfig.json` for every file it transforms, and the shared
  `client-app/src/config/*` sources pull in the mobile tsconfig, which extends a package that only
  exists where the mobile app's dependencies are installed. `admin-web/vite.config.ts` now passes
  `esbuild.tsconfigRaw` explicitly so esbuild never reads that file; `npm run build` passes both
  normally and with `expo/tsconfig.base` hidden, which is what the deploy environment looks like.
  The three duplicate customer profiles were merged into one (`prhymemanuel@gmail.com`, phone now
  `0779740511`): bookings, addresses, quotes and idempotency keys moved over, the two older Auth
  users (`manuelbagoole@`, `manuel_bagoole@`) deleted. `POST /bookings/:id/payments` was re-checked
  against the local stack with a probe booking (201, one row, `provider` = method, balance returned)
  and the probe rows deleted; `GBX-988A7A` still reads 630,000 in the app only because its 270,000
  deposit predates the ledger route and has no `payments` row yet.
- **Ledger backfill + payment kind (2026-11-26):** the two confirmed bookings now match the app. A
  270,000 MTN deposit was inserted for `GBX-988A7A` (900,000 total → 630,000 balance) and a 750,000
  Airtel payment for `GBX-6D117E` (750,000 total → settled); both as `method = app` with the exact
  provider in `provider`, `recorded_by` the customer, `provider_reference` a `backfill-2026-11-26-*`
  key. The desk also labelled a partial balance payment as "Deposit", because it only compared the
  row amount with the booking total. Migration `20261126120000_payment_kind.sql` adds a nullable
  `payments.kind` (`deposit` | `balance`), `POST /bookings/:id/payments` stores the kind it already
  received, and `admin-web` reads the column, falling back to the old amount comparison for rows
  written before it. Probe booking `GBX-KINDT` (100,000) took a 30,000 deposit then a 30,000 balance
  payment: rows stored `deposit` and `balance` respectively, probe rows deleted. `admin-web`
  `npm run build` passes; both generated `database.types.ts` gained the column. Migration
  `20261126130000_backfill_ledger_payments.sql` ports the two rows to any environment, keyed on the
  booking reference and skipped when the backfill row already exists (`INSERT 0 0` on a local re-run).
- **Instalments in the booking payment field (2026-11-26):** `admin-web` now carries
  `Booking.installments`, built in `loadConsoleData` from each booking's `paid` payment rows (oldest
  first) with kind, method, amount and date. The Bookings payment cell lists every instalment with its
  amount and a closing “Paid in total” line equal to `Booking.paid`, and the CSV export gained an
  Installments column. The Payments page deposit, outstanding-balance and refund cards now sum real
  rows instead of the hardcoded “UGX 8.42m / 68 transactions / UGX 420k”, and a retried failed payment
  keeps its instalment role rather than being relabelled “Deposit”. `npx tsc --noEmit` and
  `npm run build` pass. The Total field carries its labels in the header — “Total”, a rule, then
  “Balance” in red — and each row shows the total amount, the rule, then the balance in red a step
  smaller; “Paid in total” is green. Each booking has a Payments button opening a payment-history dialog with
  Total/Paid/Balance, every row including failed and refunded attempts, and a per-payment receipt CSV.
  The Overview revenue chart now scales to the collected money instead of a fixed 7m axis. Verified in
  the running dev build with headless Chrome (owner sign-in): 9 rows, `GBX-988A7A` showing Total
  900,000 / Balance 630,000 / Paid in total 270,000, the dialog and receipt action rendering, Payments
  KPIs at UGX 1.2m deposits / 1.1m outstanding, and a 0–3m chart axis peaking at 1.7m.
- **Cash collected by the cleaner reaches the customer's dashboard (2026-11-26):** `GET /bookings` now
  totals the caller's settled `payments` with the service role (customers cannot read `payments` under
  RLS) and returns `paidTotal`, `cashPaid` and `cashPaidAt` per booking. The customer store mirrors
  them during `syncBookingsFromServer`: paid only ever rises, the balance is re-derived from the local
  total, and a `cashPayment` record stores the cash amount and the cleaner's timestamp. The wallet
  builds a `Cash · <service>` row from that record labelled “Cash · confirmed by cleaner”, the Home
  tab now syncs on focus (so the balance-due card and wallet are current on the dashboard), and the
  old `cashConfirmed: kind === 'cash'` shortcut no longer claims confirmation for pre-ledger cash.
  Verified in the Expo web build with a signed-in customer: seeding `GBX-DONE` at 0 paid/45,000 due
  and `GBX-DUE1` at 20,000 paid/70,000 due, opening Home, then the Payments page produced paid
  45,000 / 0 due with a 45,000 confirmed cash row, and paid 90,000 / 0 due with a 70,000 confirmed cash
  row plus the 20,000 digital residual; the 45,000 and 70,000 match the cash rows in the local
  `payments` table. Jest: 10 wallet tests and 6 sync tests pass, `tsc --noEmit` clean, backend contract
  suite 12/12 after the API change.
- **Service image upload on the admin catalogue (2026-11-26):** the service editor rendered its
  “Upload image” button but no file input — the only `<input type="file">` belonged to the category
  editor, so clicking the button did nothing. The service editor now has its own hidden input with
  the same accept list and re-upload/reset behaviour. Verified in headless Chrome against the dev
  build: the editor shows one file input, choosing a PNG uploaded to `service-icons`
  (`service/ac-blowing-<timestamp>.png`) and the preview rendered from the public bucket URL with the
  Remove action; the probe objects were deleted again. `npm run build` passes.

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

Added later on 2026-11-25 and still uncommitted: `admin-web/src/pages/Costs.tsx`,
`admin-web/src/pages/Support.tsx`, `admin-web/src/lib/costs.ts`, `admin-web/src/lib/support.ts`,
`admin-web/src/lib/live.ts`, the regenerated `admin-web/src/lib/database.types.ts`,
`client-app/src/lib/api/quotes.ts`, `client-app/src/components/booking/server-quote-card.tsx`, the
`client-app/src/store/quotes.ts` and Bookings/quote/confirmed rewiring, the focus-refetch in
`client-app/src/hooks/use-services.ts` and `use-service-categories.ts`, the four migrations
`20261125200000_quote_request_pipeline.sql`, `20261125201000_job_costs_commission.sql`,
`20261125202000_realtime_publication.sql` and `20261125203000_job_cost_lines.sql`, and the
`GET /quotes` enrichment plus quote-aware lead/capacity gate in `functions/api/index.ts`.

Added on 2026-11-26 and still uncommitted: `backend/supabase/migrations/20261125204000_quote_expiry_and_push.sql`,
`client-app/src/lib/api/push.ts`, `client-app/src/lib/push.ts` (`syncPushToken`), the root-layout
registration, `client-app/src/app/booking/[id].tsx` (assigned cleaner + deposit/balance sheet),
`client-app/src/app/payment/[id].tsx` (deposit kind), `client-app/src/store/bookings.ts`
(`syncBookingAssignments`, `payBookingDeposit`, `depositPayment`), `client-app/src/lib/wallet.ts`
(deposit row), `client-app/src/lib/api/bookings.ts`, `client-app/src/lib/api/quotes.ts`,
`client-app/src/store/quotes.ts`, `client-app/src/components/booking/server-quote-card.tsx`,
`client-app/src/app/(tabs)/bookings.tsx`, `backend/supabase/functions/api/index.ts`
(`POST /device-tokens`, crew enrichment on `GET /bookings` and `GET /quotes`) and
`erp-app/src/lib/env.ts` (release startup crash). `portal_fix.md` remains untracked.

Added later on 2026-11-26 and still uncommitted: `backend/supabase/functions/api/index.ts`
(`GET /bookings` paid/cash totals), `client-app/src/lib/api/bookings.ts`,
`client-app/src/store/bookings.ts` (`cashPayment` mirroring), `client-app/src/lib/wallet.ts`
(confirmed cash row), `client-app/src/app/(tabs)/home.tsx` (focus sync), the renamed sync in
`client-app/src/app/(tabs)/bookings.tsx` and `client-app/src/app/booking/[id].tsx`,
`client-app/src/store/__tests__/sync-from-server.test.ts`, `client-app/src/lib/__tests__/wallet.test.ts`,
and `admin-web/src/pages/Catalogue.tsx` (service image file input).

---

## 8. Update rule

When a session ends, update three things here: the last-updated row, the area table in §1 (only rows
that moved, with the evidence in §2), and the milestone table if a milestone closed. Report the
client-app figure and the setup-checklist count in the reply, and point to the per-area document
where the detail changed rather than duplicating it.
