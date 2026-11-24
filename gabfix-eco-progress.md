# Gabfix Ecosystem Progress

| | |
|---|---|
| **Last updated** | 2026-11-24 |
| **Session** | Client-app doc alignment to `Full_App_Architecture_2.md`; admin-web live Supabase auth/reads confirmed; ERP offline Query persistence + pending-sync list added; setup checklist 24/42 |

**Living document.** Ecosystem-level view across the three apps, the backend and the architecture
decisions. Updated at the end of every session that changes more than one area, and whenever a
milestone on the setup checklist closes.

| | |
|---|---|
| **Last updated** | 2026-11-24 (ERP nav/title parity with app-1, cash on job + handover, offline action queue, admin-web typography) |
| **Repository** | `gabfix-eco` — `client-app/`, `erp-app/`, `admin-web/`, `backend/` (independent folders, no workspaces) |
| **Branch / commits** | `main`, 2 commits; a large working tree is uncommitted (see §7) |
| **Status legend** | ⬜ Not started · 🟨 In progress · ✅ Done and verified · 🚫 Blocked |

Detail behind each figure lives in the per-area sources: `client-app/Gabfix_UI_Progress.md` (734
lines, per-page ledger), `Technician_App_Setup_Checklist.md` (the 42-item setup backlog),
`Full_App_Architecture_2.md` (decisions and schema). This file summarises and links; it does not
restate them.

---

## 1. Where the project stands

| Area | What it is | Progress | Status | Evidence / blocker |
|---|---|---|---|---|
| **Architecture decisions** | 25 numbered decisions (D1–D25) | **52%** (13/25) | 🟨 | Decided: D1–D10, D20, D24, D25. Open: D11–D19, D21–D23. Source: `Full_App_Architecture_2.md` |
| **Client app** (`client-app/`) | Customer Expo app, 40 page builds | **66%** (65.9% weighted) | 🟨 | All 40 page builds exist and pass tsc/lint; 0 of 40 device-verified; 13 Jest suites / 105 tests pass. Source: its own progress doc |
| **Admin web** (`admin-web/`) | React 19 + Vite 7 SPA for admin, manager, customer relations | **~43%** of its checklist (3/7) | 🟨 | Supabase Auth, role mapping (admin/manager/customer_relations→support), live bookings/items/assignments/addresses/profiles/technicians/payments/handovers/disputes, client typography; promos/rate card/settings/notifications still mock; audit log, report export, browser a11y pass and deploy open |
| **ERP / technician app** (`erp-app/`) | Expo SDK 58 staff app, all roles, per-role screens | **~68%** (13/19 checklist items) | 🟨 | Foundation done: client-app tokens/fonts, auth gate, role-filtered tabs, live queries for jobs/schedule/cash/alerts/profile. Shell matches app-1 (65px flush tab bar, bell/avatar order, home hero, 16px/26-34px page titles); Alerts is a hidden route, not a tab. Jobs run On the way → Start → Complete with photos, cash on a job (`record_cash_payment`), cash+handover screen, AsyncStorage action queue replaying status/cash on reconnect, and Query cache persistence with a Profile "Waiting to sync" list. Open: push (B11), native pass, inspection capture, sales screens |
| **Backend** (`backend/`) | Supabase local stack + migrations, seed, functions | **~70%** of M2 scope | 🟨 | 6 migrations, 24 tables, RLS everywhere, capabilities/RPCs, storage buckets, seed and `npx supabase db reset` clean; Hono `api` function and laundry/leads/support tables still open |
| **Setup checklist** | `Technician_App_Setup_Checklist.md` | **24/42 items** | 🟨 | A1–A10, B1–B9, B10, C1, C3 (photo gate live), C4, C5 and D1 closed; B11, C2/C6–C8, D2+ and E/F open |

**Reading the numbers:** the 66% client-app figure is a weighted score across five tracks, where
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
  `20261123120000`–`20261123120400` plus `seed.sql` with no errors (8 auth users, 9 profiles,
  4 bookings, 3 assignments, 7 services, 24 public tables). Over REST with anon-key password
  sign-in: technician JWT saw only its 3 assigned bookings and its own profile; manager/desk saw all
  4; customer saw its own 3. `set_booking_on_the_way` → `start_job` → `complete_job` wrote 3 history
  rows and set `billed_hours`; technician `assign_technician` rejected `42501`; second lead rejected
  `23505`; 6h daily cap rejected a 5h add-on `23514`. Demo state restored afterwards. DB types
  generated for both frontends.

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

---

## 8. Update rule

When a session ends, update three things here: the last-updated row, the area table in §1 (only rows
that moved, with the evidence in §2), and the milestone table if a milestone closed. Report the
client-app figure and the setup-checklist count in the reply, and point to the per-area document
where the detail changed rather than duplicating it.
