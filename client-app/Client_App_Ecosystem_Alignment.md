# Client App — Ecosystem Alignment Checklist

**Purpose.** The client app's implementation documents were written before the ecosystem decisions in
`Full_App_Architecture_2.md` and before `erp-app/` and `admin-web/` existed. This file is the bridge:
it lists every place the client documents describe the backend, the staff apps or another app's work,
says what the architecture actually decided, and tracks the edit that removes the conflict.

It is a **documentation checklist**, not a new feature spec. Screens and code stay governed by
`Gabfix_App_Ui_1.md`, `Gabfix_App_Ui_2.md` and the Phase 2 stages; where those disagree with the
architecture, the architecture wins (architecture §13, documentation rule).

| | |
|---|---|
| **Created** | 2026-11-24 |
| **Owner** | Engineering (client app) |
| **Authority order** | `Full_App_Architecture_2.md` (decisions D1–D25) → this file → Phase 2 stages → older indexes |
| **Companion docs** | `Technician_App_Setup_Checklist.md` (build backlog), `gabfix-eco-progress.md` (ecosystem status) |
| **Legend** | ✅ aligned · 🟨 edit required · ⬜ not written · 🚫 blocked by an open decision |

**Progress note (2026-11-24):** Client catalogue/services/detail reads are API-backed behind `EXPO_PUBLIC_API_BASE_URL` with bundled fallback; `GET /availability` is live locally in Hono. `POST /bookings` now enforces 3-hour lead and technician capacity server-side (idempotency preserved), and validates `scope.answers` against seeded current category form definitions, writing server-selected `booking_form_snapshots`. Local smoke checks passed; temp probe rows cleaned. Plan/progress status is recorded in `../Gabfix_Architecture_Implementation_Plan_with_Edit_Classifications.md` §11.4/§13 and mirrored across plan documents.

**Progress note (2026-11-25):** Booking media contract is live locally: `booking_media` metadata + RLS, signed upload targets issued by `POST /bookings` and `/bookings/:id/media/targets`, complete/refresh/delete routes, and server-side 10-item/25 MB/30 s-video/mime limits. Receipts desk-issue policy now lets the desk issue a receipt to the booking's customer. Client `media-upload.ts` still uses the mock path; the full client-call gap map is in the plan §11.5. No device/staging verification.

**Progress note (2026-11-25, later session):** The client upload queue is cut over to the signed-target contract (target → PUT → complete → refresh on failure) and auth is API-backed locally through `/auth/login`, `/auth/register`, `/auth/otp/*`, `/auth/refresh` (hashed OTP store; SMS delivery still open, D12). Job-detail forms are negotiated: `GET /services/:slug/form` (service-level, else category), a 24 h per-service cache, and `formDefinitionId` sent with the booking so stale answers get 409 `form_version_stale`. Dev builds rewrite loopback API hosts to the Expo dev server and name the URL in connection errors. `backend/tests/api-contract.test.mjs` (9 tests) passes. No device/staging verification.

---

## 1. The four apps and the one backend

The client documents should describe the client app only, then **link** to the app that owns the other
side of the flow. They must not re-specify staff screens, and they must not imply shared code.

| App | Folder | Users | Data path | Document that owns it |
|---|---|---|---|---|
| Client app | `client-app/` | Customers | **Hono `api` function only** (D1). No Supabase client, no service key. | `Gabfix_Implementation_Plan.md`, Phase 2 S1–S5, UI guides |
| ERP app | `erp-app/` | All staff, screens by role (technician, laundry, sales, desk) | Supabase client directly, RLS in charge | `Technician_App_Setup_Checklist.md`; `Implementation Phase 2 - Technician Mobile App.md` is the design base |
| Admin web | `admin-web/` | Admin, manager, customer relations | Supabase client directly, RLS in charge; rule-bearing writes through functions | `Full_App_Architecture_2.md` §13 and the setup checklist §D; no client-app doc may claim it is part of `client-app/` |
| Backend | `backend/` | — | Postgres, Auth, Storage, Realtime, Edge Functions | `Full_App_Architecture_2.md` §3–§12, `supabase-guidelines.md` |

**Rules the client documents must repeat, not contradict:**

1. No shared packages or code between apps (architecture §2). The form engine, phone helpers and DB
   types are **copied** per app, not imported across folders.
2. The client app never talks to Supabase directly (D1). Anything that says "the app reads the
   `bookings` table" is wrong; it calls a Hono route.
3. Technicians see only assigned jobs, and dispatch assigns; technicians never claim work (D7/D9).
4. Cash becomes paid only when the technician confirms it (D10), and the technician's confirmation
   happens in `erp-app/`, not in a "partner app" that does not exist.
5. Staff-created bookings await a manager confirmation call (D7); the client shows them as Pending
   until confirmed (D9).
6. Phone entry is exactly 10 digits starting `07` (D25); the old 9-digit rule in the UI guides is
   replaced.

---

## 2. Document inventory — what needs an edit

| Document | Current cross-app claim | Conflict with architecture | Action |
|---|---|---|---|
| `Gabfix_Implementation_Plan.md` | "Out of scope: backend services, the cleaner (partner) app"; Phase 7 is "P27g in `admin/`"; Phase 2 phone rule `^7\d{8}$` | No ERP app named; `admin/` is now `admin-web/`; D25 replaces the phone rule | Add §2.1 ecosystem context and document map; rename the web app and link its checklist; replace the phone rule with the D25 rule |
| `Gabfix_UI_Progress.md` | Ledger says `backend/supabase` holds only `config.toml`; `erp-app/` is empty; Phase 7 is demo auth only | Backend has 6 migrations / 24 tables / RLS / RPCs; `erp-app` has auth, role tabs and core screens; `admin-web` uses Supabase Auth and live reads | Correct the three rows, add this document to the ledger, update "Next moves" |
| `Implementation Phase 2 - Index.md` | Full index without the architecture, addenda or technician docs | Superseded by `Index (2).md` | Mark it superseded at the top; keep it for history |
| `Implementation Phase 2 - Index (2).md` | Gaps say "No technician app in the customer repo" and "`admin/src/lib/auth.ts` still holds hard-coded accounts" | `erp-app/` exists; `admin-web` uses Supabase Auth | Add the architecture and this file to the reading order; rewrite gaps 6 and 8 |
| `Implementation Phase 2 - Stage 3.md` | "No React Native imports (the admin web app imports this file)" | Architecture §2 and D4: no shared code; the web app keeps a copy | Reword the form-engine note |
| `Implementation Phase 2 - Stage 4.md` | Client cutover described as direct Supabase tables; `cleaners`, `service_categories`, `sessions`; 2FA at launch | D1 Hono entry point; D3 password sign-in (phone code later); D9/D10 new tables; schema names differ | Add an authority banner and a vocabulary/supersession table; keep the mock inventory as the client-side cutover list |
| `Implementation Phase 2 - Live Tracking Addendum.md` | Says a web page on the technician's phone is unsuitable; no staff-side owner named | D21 is still open; the location sender is `erp-app` (D23 open), not `admin-web` | Add a status/dependency note pointing at `erp-app` and D21/D23 |
| `Implementation Phase 2 - Technician Workspace (ERP).md` | "Built inside the existing ERP (`admin/`)" with roles admin/operations/technician | Architecture §1/D7: one Expo ERP app for all staff; `admin-web` is the desk surface | Add a delivery note mapping the web-workspace spec onto `erp-app` (field) and `admin-web` (desk) |
| `Implementation Phase 2 - Technician Mobile App.md` | Standalone Expo technician app | Adopted as the base for `erp-app` (architecture conflict 3) | Add a pointer to `erp-app/` and the setup checklist; no rewrite |
| `Implementation Phase 2 - Dashboard Addendum.md` | Backend stage references only | None material | Leave; link this file in the index only |

---

## 3. Decision-by-decision checklist (D1–D25)

Status is about the **client documentation**, not the whole build. "Cross-app owner" names where the
other half of the decision is implemented and documented.

### Confirmed decisions

| # | Decision | What the client docs must say | Cross-app owner | Status |
|---|---|---|---|---|
| D1 | One Hono entry point for the client | Every client data call goes through the `api` function; no Supabase library in `client-app/`; error shape `{ error: { code, message } }`; 401 only for a missing/expired token | `backend/supabase/functions/api` (not built yet) | 🟨 Stage 4 banner + §2 rule |
| D2 | Expo push service | Client keeps `expo-notifications` and registers its token through the API; notification preferences and quiet hours are client screens; remote push needs a development build | `erp-app` has its own Expo token rows; backend send function | ✅ already stated in S4/S5; add the ERP second client only as a link |
| D3 | Password sign-in at launch | Phone **or** email plus password; Google stays a placeholder; phone-code verification and 2FA are **later**, so launch copy must not promise them | `erp-app` and `admin-web` use the same accounts | 🟨 Plan Phase 2 still presents OTP as launch work |
| D4 | Existing services and forms are kept | The form engine stays client-side; answers are validated on booking creation; the web app keeps **its own copy** | `admin-web` forms builder; `erp-app` read-only answers | 🟨 fix the Stage 3 shared-file sentence |
| D5 | A real categories table | Categories come from the API; deactivated categories hide their services; the trade (not the category) drives dispatch | Backend `categories`; `erp-app` shows category as a label | ✅ client behaviour already matches; cite the table name |
| D6 | Pricing: fixed, hourly, quote | `pricingMode` gains **fixed**; hourly shows a rate per hour and no crew/hours pickers; quote requests never appear in Upcoming; only fixed price is payable at booking | `admin-web` per-service pricing and Quotes queue; `erp-app` quote preparation | 🟨 client code still types `'hourly' \| 'quote'`; Plan Phase 4 still describes cleaners/hours pickers |
| D6a | Optional inspection step | Requests gain **Inspection needed / scheduled / Inspected**; the customer sees the appointment and quote, never the internal report | `admin-web` require/schedule/report; `erp-app` inspection capture | 🟨 client `QuoteStatus` has only pending/quoted/accepted/declined |
| D7 | Roles, staff bookings and sales | A staff booking shows "Booked by Gabfix support"; it appears in Upcoming once confirmed; staff cancellation reasons surface on the booking; app-made bookings never show staff cancel actions | `admin-web` + `erp-app` booking/confirmation queues; backend `source`, `created_by` | 🟨 client docs never mention staff-created bookings |
| D8 | Roles (gap-analysis numbering; this file's D7) | No client screens; only the customer role is relevant | `erp-app` role-tab sets; `admin-web` page gating | ✅ |
| D9 | Booking stages | Six client labels: Pending, Confirmed, On the way, In progress, Completed, Cancelled; Awaiting confirmation maps to Pending; unknown values fall back safely; tracking derives On the way/In progress from the server stage | `admin-web` stage filters; `erp-app` stage actions; backend `move_booking_status` | 🟨 add the mapping table to the client docs |
| D10 | Cash held by technicians | Cash is never collected at booking; the booking shows "Pay UGX X in cash" and becomes Paid after technician confirmation; an open dispute shows "Payment being checked" | `erp-app` confirm-cash + Cash tab; `admin-web` handover/dispute | 🟨 replace "partner app" wording in `Gabfix_App_Ui_2.md` references and Stage 4 |
| D20 | Who is told when a booking is made | Client shows confirmation, cancellation reason, quote/inspection updates; cancellation and confirmation are critical pushes that skip quiet hours; preferences screen already exists | `admin-web` bell; `erp-app` push by role; backend notification rules | 🟨 add the event/role matrix reference |
| D24 | Store and inventory removed | No client change; the hourly materials line stays because it is a price, not stock | `admin-web` job costs; no ERP stock screens | ✅ |
| D25 | Phone numbers, 07 only | Every field is 10 digits starting `07`, displayed `0772 123 456`, masked `0772 ••• 773`; no `+256` chip; stored old numbers convert once; the international form is built only for SMS/WhatsApp/tel | Same helper copied into `erp-app` and `admin-web` | 🟨 **code still has the 9-digit rule** (`client-app/src/utils/validation.ts`); Plan Phase 2 still states `^7\d{8}$` |

### Open decisions that constrain the client docs

| # | Decision | Client docs may assume (provisional) | What must not be written yet | Status |
|---|---|---|---|---|
| D11 | Late fees, tips, promos, referrals | Existing 24-hour rule and local promo/tip screens; values stay in config | Final fee/tip/referral policy, server-side promo rules | 🚫 |
| D12 | Payment gateway and SMS provider | Simulated authorisation and local `GBX-` ids today | Named provider, webhook contract, SMS OTP launch flow | 🚫 |
| D13 | Chat and tickets | Local message/ticket stores and optimistic send | Delivery receipts, support routing, technician chat | 🚫 |
| D14 | Deleting accounts | Local delete-account sheet and media cleanup exist | Server deletion/anonymisation contract | 🚫 |
| D15 | Guest links, receipts, legal pages | In-app receipt PDF and share sheet | Permanent/revocable guest links, legal hosting | 🚫 |
| D16 | Recurring plans | Local plan overrides and next-visit seeding | Account-level plans, server recurrence | 🚫 |
| D17 | Which legacy features ship first | Current screen set only | Legacy module scope | 🚫 |
| D18 | Laundry for app customers | Nothing; client shows no laundry | Laundry booking/status copy | 🚫 |
| D19 | Legacy data | Nothing | Migration/import promises | 🚫 |
| D21 | Live tracking | Existing polling contract and schematic map; 10 s fallback | Native map guarantee, feed transport, ETA accuracy | 🚫 |
| D22 | Admin web framework | Vite + React is in use and should be recorded as decided | A second framework choice | 🚫 (implemented, decision text missing) |
| D23 | Staff GPS trail | Nothing; the customer view consumes the payload | Background-location guarantees from a web page | 🚫 |

---

## 4. Ordered checklist (do these in order)

Each item is done when the named file states the architecture's position and no longer contradicts
another document or the code.

- [ ] **C1. Plan context.** `Gabfix_Implementation_Plan.md`: add §2.1 "Ecosystem context" with the
      four-app table, the no-shared-code rule and links to `Full_App_Architecture_2.md`,
      `Technician_App_Setup_Checklist.md` and this file. Replace the "out of scope" sentence so it
      says backend/staff apps are delivered in their own folders, not that they do not exist.
- [ ] **C2. Plan Phase 2 phone rule.** Replace `^7\d{8}$` with the D25 rule and point at
      `src/utils/validation.ts`. Note that OTP and 2FA are post-launch (D3).
- [ ] **C3. Plan Phase 7 naming.** Rename the web admin row to `admin-web/` (React + Vite), link its
      checklist section, and say the client app does not contain the operations console.
- [ ] **C4. Index authority.** In `Index (2).md`, put `Full_App_Architecture_2.md` first in the
      reading order and this file second; mark `Index.md` superseded.
- [ ] **C5. Index stale gaps.** Rewrite gap 6 (ERP app now exists and is tracked separately) and gap 8
      (`admin-web` now uses Supabase Auth; demo accounts are gone).
- [ ] **C6. Stage 3 form engine.** Replace "the admin web app imports this file" with "the web app
      keeps its own copy" (architecture §2, D4).
- [ ] **C7. Stage 4 authority banner.** Add the supersession table: Hono instead of direct client
      Supabase; D3 launch auth; D9/D10 tables; vocabulary (`cleaners`→`technician_profiles`,
      `service_categories`→`categories`, `sessions`/2FA deferred).
- [ ] **C8. Stage 4 table names.** In the schema sections, cite the migration-owned names where they
      differ, without rewriting the whole contract. Mark `sessions`, `two_factor` and Edge Functions
      as future work, not launch scope.
- [ ] **C9. Live tracking ownership.** Add a note: D21 open; the technician position is sent by
      `erp-app`, not a browser page; the client keeps polling as v1.
- [ ] **C10. Technician Workspace delivery.** Add a banner mapping the web-workspace spec to
      `erp-app` (field) and `admin-web` (desk), per architecture §1/D7.
- [ ] **C11. Progress ledger corrections.** `Gabfix_UI_Progress.md`: correct the Stage 4, Technician
      Mobile App, Technician Workspace and Phase 7 rows; add this file to the document ledger and a
      session-log row; update "Next moves".
- [x] **C12. Code-gap notes.** Done 2026-11-24. D25 is applied in `client-app/src/utils/validation.ts`
      (10 digits, `07` only) with copies in `erp-app/src/lib/phone.ts` and `admin-web/src/lib/phone.ts`
      and tests. D6 `fixed` now exists end to end for the catalogue, pricing snapshot and available
      screens; the larger D6 change (remove the hourly cleaners/hours pickers and make hourly
      quote-only) remains a product decision. D9's `inspection_needed`, `inspection_scheduled` and
      `inspected` request stages are in the client request card. Evidence is in
      `Gabfix_UI_Progress.md` §9 and §2.
- [ ] **C13. Architecture back-fill.** Add the already-implemented `/api`-less `admin-web` (D22) and
      the `erp-app` delivery surface to `Full_App_Architecture_2.md` when the owner next edits it;
      this file must not silently decide D22.
- [ ] **C14. Verification.** After the edits, `grep` the client docs for `partner app`, `cleaners`,
      `admin/`, `config.toml` and `^7\d{8}` and confirm each remaining hit is historical or
      explicitly cross-referenced. No build check is needed for documentation, but the code gaps in
      C12 need `npx tsc --noEmit`, `npx expo lint` and `npx jest` when fixed.

---

## 5. Vocabulary map (use the right column)

| Older client docs / legacy | Architecture term | Notes |
|---|---|---|
| cleaner, partner app | technician, `erp-app` | "Technician" covers cleaners and technicians; the customer-facing word "cleaner" may stay in copy |
| `cleaners` table | `technician_profiles` | Plus `profiles`, `skills`, `technician_skills`, `technician_availability` |
| `service_categories` | `categories` | One `category_id`, one `required_skill_id` per service |
| `admin/`, web portal, P27g | `admin-web/` | Separate React + Vite app, not a folder inside `client-app/` |
| partner/technician app | `erp-app/` | One Expo app, role-filtered screens |
| `sessions`, `two_factor` | Supabase Auth sessions; 2FA post-launch | D3: password sign-in at launch, phone code later |
| `service_forms`, `form_schema` | `service_form_definitions`, `booking_form_snapshots` | Versions, not a mutable form blob on the service |
| cash confirmation by cleaner in the partner app | `record_cash_payment` in `erp-app` | Cash paid only after technician confirmation (D10) |

---

## 6. What this checklist deliberately does not do

- It does not rewrite the 27 page specs or the Phase 2 stage instructions.
- It does not choose any open decision (D11–D19, D21–D23). Those remain with the owner.
- It does not mark any page ✅. Device verification is still the gate in `Gabfix_Implementation_Plan.md`
  §8 and `Gabfix_UI_Progress.md`.
- It does not add code. C12 is a record of code gaps found while aligning the documents.
