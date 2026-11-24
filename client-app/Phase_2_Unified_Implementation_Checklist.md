# Phase 2 — Unified Implementation Checklist

**Merges:** `Implementation_Phase_2 - Stage 1.md` (S1), `Implementation Phase 2 - Stage 2.md` (S2) and `Implementation Phase 2 - Stage 3.md` (S3).

**Adapts to:** `Full_App_Architecture_2.md` (the architecture), which wins on every conflict.

**Created:** 2026-11-24. **Status:** code-level, from the working tree; no device, EAS, production-backend or store verification is claimed.

---

## 0. How this document works

Phase 2 is now **one track**, not three stages to be read in order.

| Rule | Meaning |
|---|---|
| S1 is the specification library | Layouts, copy, media limits, profile screens, acceptance lists. |
| S2 only contributes defaults | Q17–Q29 defaults are adopted in place; S2 has no separate build. |
| S3 wins every conflict | Schema-driven P8b (S3 §3), `dismissTo` (C2), one build order (C3), `slotId` (C5), keyboard library in Expo Go (C1), one suggestion function (C10). |
| The architecture wins over all three | D1–D25, especially D1 Hono, D4/D5/D6 server-owned catalogue and forms, D7 roles and staff bookings, D9 stages and inspections, D10 cash, D20 notifications, D24 job costs, D25 phone. |
| Every item names the app | `[client]`, `[backend]`, `[admin]`, `[erp]`, `[all]`. |
| Status is evidence-based | ✅ built · 🟨 partial · ⬜ not started · 🚫 blocked on a decision. |

**Scoring stays separate.** The client A–J figures in `Gabfix_UI_Progress.md` remain client-only. The cross-app rows here are reported separately; do not average them into the overall 69%.

---

## 1. What changes when adapting to the architecture

These are the places where following S1–S3 literally would now build the wrong thing.

| # | Stage 1–3 instruction | Architecture adaptation | Affected |
|---|---|---|---|
| A1 | “Backend starts after the front end” (S1 D15) | The catalogue, forms, pricing and booking writes are server-owned (D4/D5/D6), so each workflow builds **client + contract together**. Local mock stays as the offline fallback, not as the source of truth. | W0, W2–W6 |
| A2 | The client talks to Supabase directly (S4 §2) | The client keeps `src/lib/api/client.ts` and talks only to **one Hono `api` function** (D1). Admin and ERP read/write directly with RLS, except rule-bearing writes. | W0 |
| A3 | Services, categories and forms live in `src/config/` | They become database rows: `categories`, `services`, `service_form_definitions` (versioned), `booking_form_snapshots`. Config files remain seed/offline data only. New services need no app update. | W2, W3 |
| A4 | Hourly services ask “How many cleaners?” and “How many hours?” | **D6:** the customer never picks hours or crew. Hourly shows one rate, is treated like a quote, and bills the confirmed quote hours. Crew is set by the company. Only fixed-price services are payable at booking. | W2, W4, W5 |
| A5 | The customer can prefer a cleaner (S1 12.3) | **D6/D7:** dispatch picks the crew; the customer cannot choose or claim technicians. Show the assigned crew after assignment. | W2, W4 |
| A6 | Client statuses are up to 6 labels (`upcoming`, `completed`, `cancelled`, plus quote states) | **D9:** eight server stages. Client maps Awaiting confirmation → **Pending**, Confirmed + crew accepted → **Scheduled** shown as Confirmed with crew, and keeps Requests out of Upcoming. | W4 |
| A7 | Cleaner assignment after 6 minutes | **D7/D9:** manager/dispatcher assigns ranked suggestions; technician accepts; the crew filling makes it Scheduled. Remove mock timers from production. | W4 |
| A8 | Inspection is described as a client-only status line | **D9:** real `inspections`, checklist, measurements, media, report, addenda, gate on sending a quote, free to the customer. | W5 |
| A9 | Cash is a local screen | **D10:** payments + handover ledger + 24-hour flag + disputes, enforced in the database. | W6 |
| A10 | Store/inventory | **D24:** removed. Only `job_costs` (admin-only) and laundry machines remain. | W6, W9 |
| A11 | Tickets are the only support model (S1 J) | **D13 is still open.** The client ticket centre can stay as the customer entry, but the backend must choose between ticket tables and the architecture’s `support_conversations` / `support_messages` chat. Do not build both. | W8 |
| A12 | “Refer and earn” is a full feature | **D11 is still open** (late fees, tips, promos, referrals). Keep the UI; do not build rewards until D11 is decided. | W8 |
| A13 | Admin web could be Next.js or Vite | Current `admin-web/` is React + Vite and already has Supabase auth, so **retaining Vite** is the proposed answer to D22. Confirm with the owner and record it. | W0, W9 |
| A14 | Stage 4 table names (`service_categories`, `cleaners`, `devices`, `sessions`) | The migrations in `backend/supabase/` are authoritative: `categories`, `technician_profiles`, `skills`, `device_tokens`, Supabase Auth owns sessions. | W0 |

**Support-number discrepancy (needs the owner):** S1 D18 and S2 say call **0703195401**, WhatsApp **0752777774**. The code (`src/config/support-contact.ts`) and the client progress log say call **0793195401**, WhatsApp **0752777773**. Do not change either until confirmed; W1 lists this as the first open item.

---

## 2. Baseline: what already exists

| App | Built | Not built / partial |
|---|---|---|
| **Client** (`client-app/`) | Support config and help surfaces (A 90); schema-driven P8b, media pipeline, mock upload queue, scope/media surfaces (B 90); P28/P29/P29a/P29b/P29c/P30 and biometric gate (C 74); drafts, keyboard kit, mock assignment/completion, optional ratings, recurring next visit (F 90); Home dashboard G1–G7 (G 90); 7 categories, 18 active services, twin cards, form engine and seed schemas (H 70); Service Areas removed (I 100); ticket centre, referral lists, red cancel, FAQ chips (J 85); momo per network, balance paying, receipt PDF (E 85). | Real upload targets, full D6 hourly/quote behaviour, server catalogue reads, quote acceptance screen, crew display, staff-booked labels, real push/security backends, referral/review/ticket APIs, device matrix, E1 download-to-Files. |
| **Backend** (`backend/supabase/`) | 7 migrations, 24 tables, RLS, capability helpers, booking status RPCs, assignment, start/complete, cash payment/handover RPCs, storage bucket setup, seed, clean local reset. | Hono `api`; quotes/inspections/reviews/support/referrals/notification-preferences/login-events/job-costs/laundry/audit tables; push sender and cron; provider webhook; catalogue seed and generated types; no staging project. |
| **Admin** (`admin-web/`) | Vite + React, Supabase Auth with role gating, live reads for bookings, items, assignments, addresses, profiles, technicians, payments, handovers and disputes; dispatch dialog; cash, reports (CSV from live data), promos, services, settings pages. | Create-booking and confirmation queues, cancellation requests, quotes/inspections, categories/services/form builder, support inbox, staff invites/roles, sales/leads/commission, customer 360, abandoned drafts, audit log viewer, server-side promos/settings, deploy, a11y pass. |
| **ERP** (`erp-app/`) | Expo app, auth gate, role tabs, jobs list/detail, On the way → Start → Complete, job photos, cash on a job, cash/handover screen, offline action queue with replay, generated DB types. | Push/token registration, assignment accept/decline, inspections, quote preparation, sales leads/proposals, laundry orders/machines, customer-relationship queues, native device pass. |

---

## 3. The merged workstreams

### W0 — Contract and platform foundation

**Goal:** one database and one client API contract that all four apps can build against. This replaces S1 Workstream D and absorbs S4's mock inventory.

- [x] `[backend]` Core schema: profiles, skills, technician profiles/skills/availability, categories, services, form definitions, addresses, bookings, items, snapshots, assignments, job photos, status history, payments, cash handovers/disputes, capabilities, invites, device tokens, notifications, RLS and helper functions.
- [ ] 🟨 `[backend]` Add the Phase 2 tables that do not exist yet: `quotes`, `inspections`, `inspection_media`, `inspection_addenda`, `reviews`, `notification_preferences`, `login_events`, `receipts`, `saved_wallet_numbers`, `booking_drafts`, `cancellation_requests`, `reactivation_requests`, `job_costs`, `equipment`, `laundry_orders`, `machine_logs`, `audit_log`, plus the support tables chosen under D13.
- [ ] ⬜ `[backend]` Hono `api` function, base path `/api`, Supabase Hono adapter, `_shared` for form validation, pricing, status rules, notification policy and balances.
- [ ] ⬜ `[backend]` Route map from the client's existing calls (`src/lib/api/*`): auth, services/categories, availability, bookings, media, quotes, payments, wallet, notifications, security, sessions, support, referrals, reviews, profile.
- [ ] ⬜ `[backend]` Buckets and policies: booking media (private), `inspection-media` (private), service images (public), technician photos (private, assignment-scoped), ticket files (private), avatars.
- [ ] ⬜ `[backend]` Service-role-only writes for status, prices, cash and audit; triggers write `audit_log`; no client can write those columns.
- [ ] 🟨 `[admin]` `[erp]` Database types: `database.types.ts` exists in both; regenerate after every migration and fail the build on drift.
- [ ] ⬜ `[all]` Cut over one mock at a time using S4 §1; remove the matching env flag from the production profile when the row passes.
- [ ] ⬜ `[backend]` Seed the seven categories, 18 active services (plus `office-clean` and `move-out-clean` inactive), seed forms, skills and demo technicians; never push `seed.sql` to production.
- [ ] ⬜ `[all]` Keep the error shape `{ error: { code, message } }` and the `Idempotency-Key` header end to end.

**Done when:** `supabase db reset` replays cleanly; a contract test exercises every client path through Hono; no app holds a service-role key.

---

### W1 — Support contact details (S1 A)

- [x] `[client]` Single source in `src/config/support-contact.ts` and `support.ts`; call/WhatsApp/email rows, validation, copy/long-press, booking context, and hand-offs on help, booking, receipt, tracking, payment and policy screens.
- [x] `[admin]` Support values aligned with the shared config.
- [ ] 🟨 `[client]` Final device/copy QA.
- [ ] ⬜ `[owner]` **Resolve the number discrepancy** (0703 195401/0752 777774 in the docs vs 0793 195401/0752 777773 in code) before release.

**Done when:** one confirmed set of numbers appears in every app and the device pass is recorded.

---

### W2 — Home, catalogue and pricing (S1 G + H, adapted by D4/D5/D6)

- [x] `[client]` Home blocks, stat tiles, balance-due card, Most popular row, hero clean-up.
- [x] `[client]` Seven categories and 18 services plus two inactive; twin cards; `fixed`/`hourly`/`quote` labels; schema engine, `DynamicForm`, seed schemas and tests.
- [ ] 🟨 `[client]` **Finish D6:** remove the hours and cleaners pickers for hourly services, show only the rate, route hourly through the quote flow, allow payment at booking only for fixed price, and remove customer crew/cleaner preference.
- [ ] 🟨 `[client]` Read categories, services, pricing and images from the API; keep config only as the offline seed; cache for weak signal.
- [ ] 🟨 `[client]` Service detail clean-up and quote wording follow the server pricing type (not a local field).
- [ ] ⬜ `[client]` Q17 dashboard stats reference image; match the tile array when it arrives.
- [ ] ⬜ `[backend]` Catalogue API, versioned form definitions, server-side schema validation on booking, active filtering, service image uploads, deactivation without deletion.
- [ ] ⬜ `[admin]` Categories manager (add/rename/reorder/nest/deactivate), services CRUD, pricing switch with a “past bookings keep their type/price” warning, form builder (nine field types, conditional rules, preview, version history, active toggle).
- [ ] ⬜ `[erp]` Read-only form answers on the job detail and category/trade labels; no catalogue editor.
- [ ] ⬜ `[all]` Tests: fixed/hourly/quote pricing, form-schema validation and snapshot, catalogue filtering.

**Done when:** an admin adds a category/service/form and it renders in the client with no app update; an old booking still shows its original labels; full D6 acceptance passes.

---

### W3 — Job scope, media and storage (S1 B, S3 §3)

- [x] `[client]` P8b schema-driven route, five-stage stepper, suggestions with Apply, draft persistence, media sheet/preview/tile, file normalisation, upload queue and status, scope/media on review, confirmation, booking detail and admin sample rows.
- [ ] 🟨 `[client]` Upload files to Supabase Storage through signed URLs (not the mock queue), with retry/refresh/delete, and keep upload failure from blocking a booking.
- [ ] 🟨 `[client]` Finish the a11y and edge cases in S1 3.13/3.16; verify camera, video, HEIC and 25 MB/30 s limits on a development build.
- [ ] 🟨 `[client]` Migrate the remaining base64 stores (avatar, quote photos, chat photos, review photos) to files and extend account deletion to media/SecureStore (S1 7.3, F13).
- [ ] ⬜ `[backend]` Validate answers against the stored form version, reject unknown fields, write `booking_form_snapshots`, store media paths inside answers, enforce item/video/size limits server-side, signed upload/complete/refresh/delete.
- [ ] 🟨 `[admin]` Show real snapshot rows and media (the sample display exists).
- [ ] ⬜ `[erp]` Show the same snapshot and media read-only for assigned jobs.

**Done when:** a booking's questions and media survive a schema edit, an upload failure leaves the booking intact, and the server rejects an 11th item or an oversized video.

---

### W4 — Booking lifecycle, drafts, dispatch, completion and rating (S1 F, D7/D9)

- [x] `[client]` Draft save/discard/guard on every step with `dismissTo`; keyboard kit; mock assignment/completion; optional ratings; recurring next visit; No-tip path.
- [ ] 🟨 `[client]` Create the booking through the API with a phone-generated id and idempotency key; read the status, crew and payment facts from the server.
- [ ] 🟨 `[client]` Map the eight stages to the client's six labels, add Pending for Awaiting confirmation, show the staff-booked label, and keep Requests out of Upcoming.
- [ ] ⬜ `[client]` Show the full assigned crew (photo, name, trade; lead ring optional) from the server; remove customer-side technician choice.
- [ ] 🟨 `[client]` Drive completion and rating from server events; disable the demo completion path in production.
- [ ] 🟨 `[backend]` The status machine, history, one-lead rule, daily-hours guard, assignment and start/complete RPCs exist; wire them to notifications and the API.
- [ ] ⬜ `[backend]` `create-booking`: validate the form snapshot, recompute price, allocate the code, set source/creator, and reject client-supplied prices.
- [ ] ⬜ `[backend]` Assignment accept/decline, automatic Scheduled when the crew is full, fallback to Confirmed when someone is removed, reassignment notice.
- [ ] 🟨 `[admin]` Live bookings and assignment dialog exist; add source/creator, ranked suggestions with reasons, dispatch queue, reschedule and cancel with reasons.
- [x] `[erp]` Jobs list/detail, On the way, start/complete, photos, offline queue.
- [ ] 🟨 `[erp]` Accept/decline assignment; enforce contact-details cutoff after completion; record real timestamps offline; show crew role.
- [ ] ⬜ `[all]` Tests: idempotent create, legal/illegal stage moves, one lead, daily-hours cap, offline replay.

**Done when:** a fixed booking is Confirmed immediately, a staff booking waits for the manager, the crew filling makes it Scheduled, and the ERP works through an offline job without duplicates.

---

### W5 — Quotes and inspections (D6, D9)

- [x] `[client]` Request stages `inspection_needed`, `inspection_scheduled`, `inspected`, plus labels, ordering, `inspectionAtISO` and card tones.
- [ ] ⬜ `[client]` Quote-received screen with accept/decline; inspection appointment card (date, inspector); Requests vs Upcoming; payment enabled only after acceptance; push deep links.
- [ ] ⬜ `[backend]` `quotes`, `inspections`, `inspection_media`, `inspection_addenda`; the gate that refuses to send a quote before a required report; transitions and audit; free inspections.
- [ ] ⬜ `[admin]` Quotes queue: review, mark inspection required with reason, schedule and assign inspector, view report and media, add addenda, send quote, withdraw requirement, liaison notes.
- [ ] ⬜ `[erp]` Inspection list/detail in Today/Jobs for the assigned inspector; checklist from the legacy template, notes, measurements, photos/videos, recommended hours and crew, submit; offline queue; own inspections only.
- [ ] ⬜ `[erp]` Quote preparation for the manager (hours, crew); technician hour proposal is *(proposed)* and needs confirmation.

**Done when:** an inspection-required request cannot be quoted until the report is submitted, the customer sees the appointment but never the internal report, and hourly quote hours become the billed total.

---

### W6 — Payments, receipts, cash and job costs (S1 E, D10, D24)

- [x] `[client]` MTN/Airtel numbers per network, validation and copy; Pay balance through the processing page; receipt PDF.
- [ ] 🟨 `[client]` E1 download-to-Files/Storage Access Framework; real provider authorisation when D12 is decided; deposits and partial payments from server balances.
- [ ] 🟨 `[backend]` Payments, cash payments, handovers and disputes RPCs exist; add the provider webhook, receipts, saved wallet numbers, balance views, corrections, commission and job costs.
- [ ] 🟨 `[admin]` Live payment/cash/handover/dispute reads and the cash screen exist; add corrections, retry/reconciliation, job-cost entry and margin, commission approval/payment, receipts.
- [x] `[erp]` Cash recording on a job and the cash/handover screen.
- [ ] 🟨 `[erp]` Dispute note/resolution visibility and offline cash replay.
- [ ] ⬜ `[client]` Payment status comes from the server, never the phone; a cash booking is marked paid only by staff.

**Done when:** total/paid/balance are calculated from payment rows, cash is traceable to a technician and handover, and only an admin can change a job cost.

---

### W7 — Notifications, account and security (S1 C, D2, D3)

- [x] `[client]` P28 preferences, quiet-hours policy, P29 security, P29a password, P29b mock 2FA, P29c login activity, P30 devices/sessions, biometric gate, push permission and token retrieval, 30-day pre-prompt snooze.
- [ ] 🟨 `[client]` POST/DELETE the Expo token with the device id; sync preferences; make the server authoritative for quiet hours; real 2FA when an SMS provider exists; session revoke; password change returns 400/403 for a wrong current password; account deactivation and reactivation request.
- [ ] 🟨 `[client]` P28 copy polish and the device pass (permission round trip, channels, deep links).
- [ ] ⬜ `[backend]` `notification_preferences`, push tokens, `notifications` routing, `notify()` with critical bypass and queued quiet hours, receipt cleanup, `login_events`, reactivation requests, invite redemption, deactivated-user sign-out.
- [ ] ⬜ `[admin]` Notification bell with unread count; staff invites, roles/capabilities, deactivate/reactivate; audit of access changes.
- [ ] ⬜ `[erp]` Token registration, critical assignment channel, invite-code sign-up, deactivated sign-out.
- [ ] ⬜ `[all]` Firebase FCM key uploaded to EAS and APNs key when an Apple account exists; push tested on development builds only.

**Done when:** a routine push at 23:00 Kampala arrives at 07:00, a critical one arrives immediately, and the same devices appear in Security and Devices.

---

### W8 — Support centre, referrals and reviews (S1 J, D13, D11)

- [x] `[client]` Ticket centre, request form, tickets list/detail, local replies, screenshot attachments, referral stage rows and masked friend lists, local reviews and chat.
- [ ] 🟨 `[client]` Replace local tickets/replies, referrals and reviews with API calls; keep the local store as a cache; add ticket/reply notifications.
- [ ] 🚫  `[owner]` **D13:** choose ticket threads or the architecture's one support conversation per customer. The current ticket UI can remain the entry point either way.
- [ ] ⬜ `[backend]` Support tables/messages and attachments, tagged to a booking or order when relevant; reviews with one rating per target; referral records.
- [ ] ⬜ `[admin]` Support inbox ordered by latest message with unread state, reply, booking/order reference, abandoned-draft follow-up list and reasons, review visibility (staff only).
- [ ] ⬜ `[erp]` Support inbox for customer relations and the manager (same conversation, role-scoped).
- [ ] 🚫  `[all]` Referral rewards and promo/late-fee/tip rules wait on D11.

**Done when:** a customer message reaches a staff inbox and a reply reaches the app, and ticket/referral data survives a reinstall.

---

### W9 — Admin and ERP operations for the complete workflow (D7, D20, D22, D24)

**Admin web**

- [ ] 🟨 Auth, role gating, live operational reads, dispatch dialog, payments/cash, reports CSV, promos/services/settings pages exist.
- [ ] ⬜ Create-booking flow: find/create customer (name + 07 phone), service, address, time, form answers; record one of the five “why the app failed” reasons for app customers; mark source/creator.
- [ ] ⬜ Manager “Waiting for confirmation call” queue with Confirm (who/when) and Cancel (reason); customer relations see the status with no confirm button; admin cancel is labelled override.
- [ ] ⬜ Cancellation-request queue: raise (CR/sales, staff bookings only), approve/decline with note, notify the requester.
- [ ] ⬜ Manager note queue (can't book / can't cancel / change time + free text) with handled state.
- [ ] ⬜ Sales section: leads, proposals, follow-ups, customers per operator; commission list approval and payment (flat fee, completed-and-paid only).
- [ ] ⬜ Customer 360 by name/07 phone: bookings, orders, quotes, payments/balance, conversation, addresses, drafts; deactivated marker.
- [ ] ⬜ Staff invites and role assignment; capability editing; deactivate/reactivate accounts.
- [ ] ⬜ Audit log viewer (append-only, admin only); server-side report export; production deploy and browser/a11y pass.
- [ ] ⬜ Notification bell for desk roles.
- [ ] ⬜ Laundry back office if kept in the first release: orders, walk-ins, machines, status stages (architecture scope, outside the client Phase 2 UI).

**ERP**

- [x] Jobs, cash, offline queue, role tabs.
- [ ] ⬜ Assignment accept/decline and crew role; push-driven job alerts.
- [ ] ⬜ Inspections (W5), quote preparation (W5), sales leads/proposals/follow-ups, laundry orders and machine logs for the laundry operator.
- [ ] ⬜ Role-specific home/tabs for technician, laundry operator, sales operator, customer relations and manager; hidden tabs by role.
- [ ] ⬜ Native Android pass: camera, offline replay, background upload, push, contact cutoff.

**Done when:** an offline customer can be booked by CR, confirmed by the manager, dispatched, worked, paid in cash, handed over, costed by the admin and audited — with no app bypassing RLS.

---

### W10 — Quality, device and release gates

- [ ] 🟨 `[client]` `tsc`, lint, Jest and the style gate pass; `[admin]` typecheck; `[erp]` tsc.
- [ ] ⬜ `[all]` Contract tests for every Hono route, RLS tests per role, `supabase db reset` replay, seed checks.
- [ ] ⬜ `[client]` Device matrix: sheets to the bottom edge, keyboard gap, camera/mic/25 MB/30 s, PDF save, local and remote push, draft save/discard, biometrics, 100%/130% text.
- [ ] ⬜ `[erp]` Android matrix: offline job lifecycle, photos, push, cash, inspection.
- [ ] ⬜ `[admin]` Browser matrix and accessibility pass at 100%/130%.
- [ ] ⬜ `[all]` Development builds and EAS credentials; APK/EAS Android quota returns 2026-12-01; remove the failed attempt's version-code bump from release planning.
- [ ] ⬜ `[backend]` Staging project, backup/restore test, secrets list.
- [ ] 🟨 `[docs]` Progress files updated per merge; this checklist is the execution index.

**Done when:** every acceptance list, the device matrix and the progress-document patch are recorded against a real build.

---

## 4. Merged build order

| Step | Work | Depends on |
|---|---|---|
| 1 | W0 schema extension + Hono skeleton + generated types | — |
| 2 | W2 catalogue/form API + admin categories/services/form builder + client server reads | 1 |
| 3 | W3 media storage and upload cutover | 1, 2 |
| 4 | W4 create-booking + dispatch + ERP accept/start/complete | 1, 2 |
| 5 | W1 support-number confirmation and QA (parallel from day one) | owner |
| 6 | W5 quotes + inspections (admin queue, ERP capture) | 2, 4 |
| 7 | W6 payments webhook, cash, job costs | 4 |
| 8 | W7 push, preferences, sessions, security | 1, 4 |
| 9 | W8 support model (after D13), referrals/reviews | 1, 7 |
| 10 | W9 admin/ERP operations, invites, sales, commission, audit, deploy | 4–9 |
| 11 | W10 gates, device matrix, staging | all |

Two lanes: lane 1 = 2, 3, 6; lane 2 = 4, 7, 8. W0 and W1 are shared starts.

---

## 5. Open decisions and blockers

| Item | Blocks | Default / action |
|---|---|---|
| Support call/WhatsApp digits | W1, release copy | Owner confirms 0703…/0752…774 vs code 0793…/0752…773 |
| Q17 dashboard stats image | W2 polish | Keep the three default tiles until the image arrives |
| D11 late fees, tips, promos, referrals | W6 late fees, W8 rewards | Keep UI; do not build reward/fee rules |
| D12 payment gateway and SMS provider | W6, W7 | Payments stay simulated; 2FA stays mocked |
| D13 chat vs tickets | W8 backend and admin inbox | Choose one model before tables are written |
| D21 live tracking | W4/W5 (notifications/deep links) | Out of this phase |
| D22 admin framework | W9 deploy | Proposal: retain Vite + React |
| Travel time and daily-cap overflow | W4 dispatch ranking | Plan on assigned hours only |
| Commission fee amount | W9 | Admin sets it before the sales section ships |
| Edge-function list | W0 | Revise once the Hono routes exist |
| APK/EAS quota | W10 | Retry after 2026-12-01; no device claim before |

---

## 6. Definition of done (whole track)

1. Every S1 acceptance list passes (A 2.11; B as replaced by S3 3.7; C 4.7; E 11.7; F 12.6; G 13.7; H 14.9; I 15.5; J 16.7), plus the W0–W9 “done when” lines above.
2. `tsc`, lint, Jest, `expo-doctor`, admin typecheck, ERP tsc, the style gate and backend migration replay are clean.
3. No hard-coded colour, radius or spacing outside tokens/artwork/print.
4. The database, not the phone, owns prices, statuses, balances, assignment and audit.
5. The device/browser matrix is run on real hardware and recorded.
6. The progress documents, this checklist and the architecture impact blocks are updated in the same merge.
7. Nothing is marked ✅ on documentation alone.

---

## 7. Traceability

| Source | Lands in |
|---|---|
| S1 A (support) | W1 |
| S1 B (scope/media) | W3 |
| S1 C (profile/security) | W7 |
| S1 D (housekeeping) | W0 (routes/types done; base64 migration in W3) |
| S1 E (payments) | W6 |
| S1 F (drafts/dispatch/rating) | W4 |
| S1 G (dashboard) | W2 |
| S1 H (catalogue/forms) | W2, W3 |
| S1 I (service areas) | ✅ closed; regression check in W10 |
| S1 J (help/refer) | W8 |
| S2 Q17–Q29 | W2, W4, W6, W8, W10 defaults |
| S3 C1–C11 | §0 rules; `dismissTo` in W4; `slotId` in W3 |
| S4 mock inventory | W0 cutover, W3 uploads, W6 payments, W7 push |
| Architecture D1–D25 | §1 and the workstreams |
