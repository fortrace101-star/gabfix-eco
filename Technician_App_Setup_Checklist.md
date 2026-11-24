# Technician App Setup Checklist

Scope: what has to be true before `erp-app/` (the staff ERP / technician mobile app) can run real
technician work against the local Supabase stack, plus the remaining `admin-web/` work and the
client-app follow-ups already agreed.

References: `Full_App_Architecture_2.md` (§2 repository, §3 local dev, §5 backend, §10 roles,
§11 tables, §13 D1/D7/D9), `supabase-guidelines.md`, `client-app/Gabfix_UI_Progress.md`.

Legend: `[x]` done and verified · `[ ]` open · `[~]` partially done in the existing scaffold.

---

## 0. Current state (checked 2026-11-23)

- [x] **admin-web import error fixed.** The reported failure
      `Failed to resolve import "@mobile/config/services" from "src/pages/Services.tsx"` was a path
      bug, not a missing module. `admin-web/vite.config.ts` aliased `@mobile` to
      `../../client-app/src` and `tsconfig.json` used the same prefix — one level too high, so Vite
      looked in `Projects/Mobile/client-app/src/...` instead of `gabfix-eco/client-app/src/...`.
      Alias, `server.fs.allow` and the tsconfig `paths`/`include` entries now use `../client-app/src`.
      Verified: `npx vite build` → 54 modules, build OK; `npm run typecheck` → clean.
- [x] **Supabase local stack is up and the portal schema replays from zero.** Containers healthy
      (`supabase_db_backend` and the rest); migrations `20261123120000`–`20261123120400` create the
      schema, helper functions, RLS, capabilities/RPCs and storage buckets; `seed.sql` adds 8 auth
      users + 1 offline customer, 7 categories, 7 services, 2 technicians and 4 demo bookings.
      Verified: `npx supabase db reset` applied all five migrations and the seed; sign-in with the
      anon key, RLS-scoped reads and the job RPCs were exercised over the REST API (see A1–A9).
- [~] **`erp-app/` now has a real foundation**: client-app theme tokens, fonts, auth gate,
      role-filtered tabs and live Supabase reads for jobs/schedule/cash/alerts/profile. Screens are
      functional but not yet designed to the client-app page standard (track C), and no device or
      simulator sign-in has been done.
- [~] **`admin-web/` is a working demo on mock data**: `src/data.ts` + `src/lib/auth.ts` with two
      hard-coded accounts, no `supabase` import anywhere.

---

## A. Backend first (nothing else can be tested without it)

- [x] **A1. Start the local stack.** All containers healthy; `npx supabase status -o env` gives
      API URL `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, anon/service keys and DB
      port 54322. (The earlier "container exited" report was stale.)
- [x] **A2. Record the connection values once**, in each app's own env file — no shared package
      (§2 of the architecture):
      - `erp-app/.env.local` + `.env.example`: `EXPO_PUBLIC_SUPABASE_URL`,
        `EXPO_PUBLIC_SUPABASE_ANON_KEY`
      - `admin-web/.env.local` + `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
        (the typed `src/lib/env.ts` guard still needs to be written — D2)
      - Android emulator note: `10.0.2.2` instead of `localhost`; physical devices need the machine's
        LAN IP.
      `.env` / `.env.local` are gitignored in both apps.
- [x] **A3. First migration, in dependency order**, following §11. Four hand-written migrations:
      `20261123120000_portal_core.sql` (extensions, 11 enums, 24 tables, triggers),
      `20261123120100_portal_helpers.sql` (security-definer role/ownership helpers),
      `20261123120200_portal_rls.sql` (RLS on all tables), `20261123120300_portal_rpc.sql`
      (capabilities seed, hours-cap trigger, job/cash/assignment RPCs) and
      `20261123120400_portal_storage.sql` (buckets + `storage.objects` policies).
      `npx supabase db reset` replays them from zero. Deferred as planned: laundry, sales leads,
      support/chat, promos and job costs until their screens exist.
- [x] **A4. RLS policies per role** (§10), not per screen. Verified over REST with real tokens:
      technician → 3 assigned bookings and only their own profile; manager and desk → all 4 bookings;
      customer → own 3. Guards hold: one-lead partial unique index rejects a second lead (`23505`),
      overlapping assignment rejected by the `btree_gist` exclusion constraint, and the
      `enforce_daily_hours_cap` trigger rejects 2h booked + 5h new against a 6h cap (`23514`).
- [x] **A5. RPC / function for status changes.** `move_booking_status` is the single writer of
      `booking_status_history`; `set_booking_on_the_way`, `start_job`, `complete_job`,
      `assign_technician`, `record_cash_payment` and `record_cash_handover` are granted to
      `authenticated` only. Verified: scheduled → on_the_way → in_progress → completed produced three
      history rows and set `billed_hours`; a technician calling `assign_technician` got `42501`.
- [x] **A6. Local seed only** (`backend/supabase/seed.sql`, wired in `config.toml`, never pushed):
      8 auth users at password `gabfix2026` (admin, manager, customer relations, sales, laundry, two
      technicians, customer), one offline walk-in customer, 7 categories, 7 services, skills and
      availability, and 4 bookings (scheduled, confirmed, completed + cash payment,
      awaiting_confirmation) with 3 assignments for `tech1@gabfix.ug`.
- [x] **A7. Storage buckets declared in a migration** `20261123120400_portal_storage.sql` (the
      Supabase rule is SQL, so they also survive `db push`; `config.toml` only names buckets that
      are pre-created by the CLI): private `job-photos` (10 MB), private `technician-photos` (5 MB),
      public `service-icons` (2 MB), each with MIME limits and policies keyed to assignment, owner or
      `manage_catalogue`. Not yet exercised by an upload — first real check is C4.
- [x] **A8. Generate DB types into each app** (§2: no shared packages).
      `erp-app/src/lib/database.types.ts` and `admin-web/src/lib/database.types.ts` generated from
      the local schema (818 lines each, identical). Re-run after every migration.
- [x] **A9. Confirm auth config** — email/password enabled with autoconfirm off locally and
      `minimum_password_length = 6`. Seeded users sign in through GoTrue with the anon key
      (`POST /auth/v1/token?grant_type=password`) and the returned JWT is accepted by PostgREST; the
      `/rest/v1/rpc/...` calls above all ran on those tokens.
- [x] **A10. Define the API boundary for the ERP app**: direct Supabase client reads/writes under
      RLS (§5) — no Hono for staff. The Hono `api` function is only the client-app entry point and
      stays later work. (Decision recorded; the ERP client itself is B7.)

**Done when:** `npx supabase db reset` replays cleanly, `npx supabase status` shows all services up,
the seeded technician can be signed in with the anon key, and a `select` on a booking returns only
the rows RLS allows.

---

## B. `erp-app` foundation (theme, providers, routing, auth)

- [x] **B1. App identity**: `app.json` → name "Gabfix Portal" (or the owner's wording), keep slug,
      set splash/adaptive-icon background to brand green `#118E45` (not the template blue), set
      `userInterfaceStyle` to `light` (the client app is a light theme; dark mode is a separate
      decision), add `ios.bundleIdentifier` / `android.package`, and a `web.favicon` matching the
      portal mark. Install icons/sp;ash assets from the client app's `assets/`.
- [x] **B2. Port the design tokens** — copy `client-app/src/theme/tokens.ts` and the style helpers
      into `erp-app/src/theme/` (independent package, no cross-import): `colors` (green 50/100/300/
      500/700/900, yellow 50/200/500/600/800, `bg #F6F8F6`, `surface`, `border`, text/muted,
      success/warning/error/info pairs), `space`, `radius` (input 12, button 14, card 20, sheet 28,
      hero 40, pill), `size` (button 52, header 56, tabBar 64, touch 48), `text` scale, `shadow`.
      Rule from the client app: screens never hard-code a colour, radius or spacing value.
- [x] **B3. Fonts**: load Poppins (400/500/600/700) and Inter (400/500/600) with `expo-font` +
      `expo-splash-screen` gating, same families as the client app, and set the heading/body split
      (`font.heading`, `font.body`, …).
- [x] **B4. Root providers** in `src/app/_layout.tsx`: `GestureHandlerRootView`,
      `SafeAreaProvider`, `QueryClientProvider`, theme provider, splash hide when fonts + session are
      ready. Remove `AnimatedSplashOverlay`/`AppTabs` demo wiring only after the real tab layout
      exists.
- [x] **B5. Delete template leftovers**: `src/app/explore.tsx`, the demo `app-tabs`, `themed-text`,
      `themed-view`, web badge/hint-row components and `src/constants/theme.ts` placeholders that
      the token port replaces. Keep `global.css` only if web export stays on.
- [x] **B6. Route skeleton** (Expo Router under `src/app/`, per `erp-app/AGENTS.md`):
      - `(auth)/sign-in.tsx`
      - `(app)/_layout.tsx` with role-aware tabs: Home, Jobs, Schedule, Cash, Profile for
        technicians; Orders/Machines for laundry operator; Leads/Proposals for sales; Everything for
        manager/admin. Hide tabs a role cannot use — the database still enforces it. Alerts is a
        route but not a tab (the bell on Home opens it).
      - `(app)/home.tsx`, `jobs/index.tsx`, `jobs/[id].tsx`, `schedule.tsx`, `cash.tsx`,
        `profile.tsx`
      - `notifications.tsx` at the root of `src/app/` (outside `(app)`) so it is not a tab but is
        still guarded by the signed-in stack; `href: null` on a tab route broke navigation.
      Add `Stack.Screen` titles/headers from the token header height, and keep typed routes.
- [x] **B7. Supabase client + session**: `src/lib/supabase.ts` (React Native storage adapter on
      AsyncStorage, `detectSessionInUrl: false`, `autoRefreshToken: true`), auth store, session
      restore before first paint, signed-out redirect, and an "account deactivated" screen for
      `profiles.status = 'deactivated'`.
- [x] **B8. Capability gate**: mirror §10 as data — a `useCapabilities()` hook reading
      `role_capabilities` (fallback to a static map while the tables are empty), plus a
      `<RequireCapability>` guard for screens/buttons (assign job, confirm booking, enter job cost).
      Do not duplicate role logic per screen.
- [~] **B9. Offline and caching foundation** (§9, stack table): TanStack Query with AsyncStorage
      persistence, NetInfo-driven online banner and refetch, Zustand-persist queue for technician
      actions (status change, photo upload, cash record) replayed on reconnect, with an explicit
      conflict rule (server timestamp wins; failed items surface in a "pending" list). **Done:**
      AsyncStorage action queue (`src/lib/action-queue.ts`) for status changes and cash, replayed by
      `SyncManager` on startup and reconnect alongside the existing photo queue. **Open:** TanStack
      Query AsyncStorage persistence, a visible "pending" list and the conflict rule.
- [x] **B10. Component kit** — first pass: Screen, Button, TextField, RequireCapability; Card/Chip/
      Sheet/EmptyState/Skeleton/Toast arrive with the screens that need them. Icons via
      `lucide-react-native` (tabs use Briefcase/CalendarDays/Banknote/Bell/UserRound).
- [ ] **B11. Push notifications**: `expo-notifications` setup, permission prompt after sign-in,
      token registration into `device_tokens` (platform, `last_seen_at`), foreground handler and
      deep link `job/[id]`. Requires a development build — Expo Go cannot receive push.

**Evidence (B1–B8, B10):** `app.json` is Gabfix-branded (`Gabfix Portal`, light UI, splash/adaptive
`#118E45`, bundle/package `ug.gabfix.portal`, `web.output: "single"`) and uses the client app's
`icon.png` / `splash-icon.png` / `favicon.png` / adaptive foreground; template icons and the old
`.icon` bundle are deleted. `src/theme/` is the ported token set; fonts load Poppins 400–700 and
Inter 400–600 with splash gating. Root layout wraps GestureHandler → SafeArea → QueryClient →
AuthProvider and guards `(app)`/`(auth)` with `Stack.Protected`. Routes: `sign-in`, `jobs`,
`jobs/[id]`, `schedule`, `cash`, `notifications`, `profile`; tabs are role-filtered via a
`VISIBLE_FOR` map (`href: null`) and the deactivated state short-circuits the tab layout.
Supabase client uses AsyncStorage + autoRefresh; `useAuth()` restores the session before first paint;
`useCapabilities()` reads `role_capabilities` with a static fallback and `RequireCapability` gates
UI. `npx tsc --noEmit` and `npx eslint src` pass; `npx expo export --platform web` builds a chunk
per route; typed routes regenerate with the real paths.

**Sign-in gate, exercised end to end** on that exported build served locally and driven through the
Chrome DevTools protocol against the local stack: signed out at `/` → redirected to `/sign-in`;
`tech1@gabfix.ug` signed in → landed on `/jobs` with the 3 assigned bookings; `desk@gabfix.ug` →
same redirect but only Jobs/Alerts/Profile tabs and the desk-wide booking list; `manager@gabfix.ug`
→ full tab set with the wider list; job card tap → `/jobs/<id>` with customer, phone, address, work
and crew; `/cash`, `/alerts`, `/profile` all render with real queries; Sign out → `/sign-in`. No
console errors. This is Chrome on web, not a native device — the mobile runtime, fonts and splash
still need one device pass before B is fully signed off.

**Two defects this pass found and fixed:**
1. `/jobs/<id>` silently fell back to `/jobs` because the detail file was a sibling of the tab routes.
   Added `(app)/jobs/_layout.tsx` (nested `Stack` with `index` and `[id]`), after which both deep
   links and card taps reach the detail screen.
2. Technicians saw "Address to confirm" on their jobs: `addresses` RLS allowed only the owning
   customer and desk, so assigned technicians could not read the job address. Added
   `20261123140000_portal_address_access.sql` — read for the address of bookings the technician is
   assigned to, nothing else.

**Third defect, found from a real dev session:** signing in against the dev server reported
"Failed to fetch". `EXPO_PUBLIC_SUPABASE_URL` is `http://127.0.0.1:54321`, which means "this device" —
so a phone or a browser opened from the LAN address never reaches the machine, and Chrome blocks a
LAN page fetching loopback. `src/lib/env.ts` now rewrites a loopback URL to the host the app was
loaded from (the page host on web, `Constants.expoConfig.hostUri` on native) and leaves hosted
URLs alone. Verified on the dev server at `http://192.168.1.196:8082`: sign-in, profile, capability
and booking queries all hit `192.168.1.196:54321` with 200s and land on `/jobs`.

**Still open in this group:** B9 (offline queue) and B11 (push).

---

## C. Technician screens (first usable slice)

- [x] **C1. Jobs list** — today/upcoming segments, lead vs helper chip, time window, service and
      area, status pill, pull-to-refresh, empty and error states, offline banner, page title at the
      app-1 offset (`insets.top + space[4]`, 16px gutter, `text.h1` 26/34, muted subtitle at 54px).
- [ ] **C2. Job detail** — customer display name, address with map link, phone (tap to call, no
      numbers shown to customers), service + form answers snapshot (`booking_form_snapshots`),
      crew list with lead marked, notes, and the action bar.
- [x] **C3. Job flow** — `on the way` → `in progress` → `complete` via the §11 RPCs, each writing
      `job_assignments.started_at/completed_at` and `booking_status_history`; completion asks for
      before/after photos (soft gate: asks once, proceeds without) and billed hours for hourly
      services. Offline status taps queue and replay on reconnect.
- [x] **C4. Photos** — camera + library, JPEG at quality 0.6, upload to the private `job-photos`
      bucket as `booking_id/kind/uuid.jpg`, upload state, retry from the offline queue.
- [x] **C5. Cash** — record cash collected on a job (`payments` with `method: cash`,
      `recorded_by`), show today's total, and the handover screen that creates `cash_handovers`
      (append-only). Job detail has a cash card (`record_cash_payment`, queued offline); `/cash`
      lists today's cash payments with a technician “Hand over cash” form (`record_cash_handover`).
- [ ] **C6. Schedule** — weekly pattern + date overrides read-only for the technician; show the
      next assigned block and the daily hours cap for their trade.
- [ ] **C7. Notifications + profile** — in-app list from `notifications`, read state, sign out,
      app version, and a support/contact row using the shared contact details.
- [ ] **C8. States and copy** — every screen has loading, empty, error and offline variants, using
      the token palette; 48dp touch targets; no colour invented outside `colors`.

**Evidence (C1, C4, web build):** Home is the first tab and uses the client-app shape — green
LinearGradient hero with greeting, bell (unread badge) and avatar, an overlapping stats card, a
next-job card, today's work and quick actions. The tab bar is an exact port of app-1's `BrandTabBar`
in `src/components/navigation/brand-tab-bar.tsx` (white surface, hairline top border, no side
margins, 48×30 yellow active pill, 22px icons, `max(inset, 8)` bottom padding) — measured against
app-1 in the same 500×805 web viewport, both bars sit at `left 0 → 805 bottom`, 65px tall, radius 0,
1px top border. Tabs are Home·Jobs·Schedule·Cash·Profile; Alerts is not a tab and opens from the
bell. The bell/avatar order and sizes match app-1 (avatar 36×36 before the bell), and page headers
use the app-1 profile/services metrics — title at `insets.top + space[4]`, 16px gutter, `text.h1`
26/34 Poppins 700, muted `text.body` subtitle 4px below. Jobs list has Today/Upcoming
segments with counts, lead/helper chips and the shared `OfflineBanner` (`@react-native-community/netinfo`).
Job detail's photo card takes before/after pictures with `expo-image-picker`, uploads to the private
`job-photos` storage and inserts the `job_photos` row, and keeps failures in an
AsyncStorage queue (`src/lib/photos.ts`) with a pending counter and one-tap retry; completing a job
with no after photo asks once before proceeding. Driven on the dev server as `tech1@` in a fresh browser profile: sign-in →
`/home` with the hero and 5 tabs, bell → `/notifications`; home hero text reproduces app-1 exactly
("Hello," 14/20 at 16,12 · name 20/28 at 16,32), and `/jobs` shows the title at 16,16 in 26/34 with
the subtitle at 16,54. `npx tsc --noEmit` and `npx eslint src` pass. Camera and native photo picking
still need a device pass.

**Evidence (C3, web build):** `jobs/[id]` shows a sticky action bar driven by the booking status
plus the technician's own assignment: `scheduled` → **On the way** (`set_booking_on_the_way`),
`on_the_way`/`scheduled` → **Start job** (`start_job`), `in_progress` → **Complete job**
(`complete_job`). Hourly services open a billed-hours field before the completion call; fixed-price
services complete in one tap. Each RPC invalidates the booking, history and assignment queries.
Driven end to end on the exported web build against the local stack as `tech1@`: `GBX-DUE1`
Scheduled → On The Way → In Progress → (billed `2` hours) Completed, with
`bookings.billed_hours = 2.00`, matching `booking_status_history` rows and
`job_assignments.started_at/completed_at`; demo state restored afterwards. `npx tsc --noEmit` and
`npx eslint src` pass. The before/after photo gate is a soft prompt (asks once, completes without).
Still open in C3: RPC failure copy (only an inline error today).

**Evidence (C5, web build):** job detail has a cash card that calls `record_cash_payment` and queues
the amount offline; `/cash` shows today's total, the payments list and a “Hand over cash” form that
calls `record_cash_handover`. Verified on the dev server as `tech1@`: recorded UGX 5,000 on
`GBX-DUE1` → a `payments` row with `method = cash` and the chip flipped to “paid”; test row deleted
afterwards.

**Done when:** a technician can go from sign-in to a completed job with photos and cash recorded
entirely against the local stack, and the same flow survives airplane mode + reconnect.

---

## D. `admin-web` (web equivalent of the portal for admin, manager, customer relations)

- [x] **D1. Fix the Vite import error** (see §0) — alias/`fs.allow`/tsconfig corrected, build and
      typecheck pass.
- [ ] **D2. Supabase client + real auth**: add `@supabase/supabase-js`, `src/lib/supabase.ts`, and
      replace `src/lib/auth.ts` demo accounts with `signInWithPassword` against `profiles` (role
      lookup), keeping the demo accounts behind a `VITE_DEMO_AUTH` flag only until A6 is seeded.
- [ ] **D3. Replace mock reads**: move the arrays in `src/data.ts` to queries
      (`bookings`, `payments`, `technician_profiles`, `customers`, `services`, `promos`), keep the
      mock module behind the same interface so pages can be migrated one at a time.
- [~] **D4. Design-system alignment**: keep the existing CSS variables (they already match the
      client token values — `--green-500 #118E45`, `--yellow-500 #F7EB15`, `--r-card 20px`,
      `--r-btn 14px`), and align the shared components (buttons, chips, KPI cards, tables, drawers,
      empty states, dialogs) with the client kit: same radii, shadow, 1px `--border`, Inter body
      text, Poppins headings. Add a `src/ui/` layer only for components used by two or more pages.
      **Done:** typography matches the client — `index.html` loads Inter 400/500/600 and Poppins
      400–700; `h1` 26/34 Poppins 700, `h2` 20/28 Poppins 600, `h3` 17/24 Poppins 600, `.eyebrow`
      12/16, `.btn` Inter 13/600. **Open:** chips/cards/tables/drawers still use the old spacing.
      **First pass done:** the sidebar's active item is now the client-app yellow pill (dark green
      text, the badge inverts on it) instead of a translucent white block, and Overview opens with a
      `.page-hero` band — green gradient, white Poppins heading, yellow primary CTA and a four-up
      stats strip — mirroring app-1's home. Verified in the browser at `localhost:5173` as
      `admin@gabfix.ug`: active nav computes to `rgb(247, 235, 21)`, hero renders
      "Good morning, Manuel" with the stats, `npm run typecheck` passes.
- [ ] **D5. Page-by-page pass** — Overview, Bookings, Customers, Cleaners → Technicians, Services,
      Payments, Cash, Promos, Reports, Settings: spacing on the 4/8/12/16/24 scale, one primary
      action per header, consistent status chips, and real loading/empty/error states.
- [ ] **D6. Role gating in the UI** — Settings/invites/costs admin-only, confirm/cancel/assign
      manager-only, cancellation requests visible to manager, customer-relations read-and-create
      only. The RLS from A4 remains the real gate.
- [ ] **D7. Verify** — `npm run build`, `npm run typecheck`, and a browser pass of the changed pages
      against seeded data; fix console errors before calling it done.

---

## E. Client-app follow-ups already agreed

- [ ] **E1. Receipt download to Files** — replace the share-sheet-only path in
      `client-app/src/lib/receipt*.ts` with a real file write (expo-file-system → app document
      directory, then "Open in Files"/share as fallback), so "Download" produces a retrievable PDF on
      iOS and Android. Browser check is not sufficient — requires a device build.
- [ ] **E2. Remaining modal accessibility audit** — the four intentional non-`BottomSheet` surfaces
      (Home account menu, notifications popover, media viewer, `SessionExpiredModal`): labels,
      focus order, screen-reader announcement, dismiss gesture, and escape/back behaviour.
- [ ] **E3. Device pass** — re-run the checks that were only done in headless Chrome on a real
      handset (safe areas, keyboard insets, tracking map, photo picker), then update
      `client-app/Gabfix_UI_Progress.md` from 🟨 to ✅ where they pass.

---

## F. Cross-app consistency and docs

- [ ] **F1. Record the decisions this work settles** in `Full_App_Architecture_2.md`: admin web is
      React + Vite (resolves the open D22 choice), the ERP app is one Expo app with per-role tab
      sets (D7 already decided), and the ERP app reads Supabase directly while only the client app
      uses the Hono `api` function (D1).
- [ ] **F2. Document env var names and the local start sequence** (`supabase start` → copy values →
      start each app) in the root README, so a new clone does not repeat the alias/paths confusion.
- [ ] **F3. Verification gates per app** before any hand-off: `client-app` — tsc, lint, jest;
      `erp-app` — `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`; `admin-web` — build +
      typecheck; `backend` — `npx supabase db reset`.

---

## Suggested order

1. **A1–A2** (get the stack up and keys in place) — unblocks everything.
2. **A3–A6, A8** (schema, RLS, RPCs, seed, types) — the smallest schema that covers B/C jobs, cash
   and photos; defer laundry, sales leads and support tables until their screens exist.
3. **B1–B8** (identity, tokens, fonts, routes, auth, capability gate).
4. **C1–C4** (jobs list → detail → flow → photos) — the first demoable technician slice.
5. **D2–D4** (admin-web real auth + queries + design alignment), then D5–D7.
6. **B9–B11, C5–C8** (offline queue, push, cash, schedule) and **E1–E3**.

Assumptions to confirm with the owner: the ERP app title and role-tab wording; whether the
technician signs in with email/password at launch (D3 says password sign-in, invite codes are
staff-only); whether dark mode is out of scope for the portal; and whether `admin-web` keeps its
current page structure while the design pass happens (this checklist assumes yes).
