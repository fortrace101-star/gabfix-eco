# Gabfix Ecosystem — Architecture Implementation Plan

> **Edit required: Enhance.** Keep this plan as the governing delivery document and add an explicit edit classification to every section so implementation teams know whether to retain and extend, change, introduce or remove content.


**Prepared:** 24 November 2026  
**Repository reviewed:** `gabfix-eco-main` (uploaded ZIP; 530 archive entries)  
**Architecture baseline:** `Full_App_Architecture_2.md` (separately uploaded current version)  
**Implementation status baseline:** repository progress and readiness documents dated 24 November 2026  
**Purpose:** turn the agreed architecture into an executable, screen-level and service-level delivery plan, while recording what is already present in the repository so existing work is retained rather than rebuilt.

---


> **Edit classification key — apply this note to every section:** **Delete** = remove the existing section/feature completely; **Enhance** = add to or extend what is already there; **Optimize** = change, refactor or modify an existing implementation; **Create** = introduce a new feature, workflow, component or section. Each section below has one primary classification and a short instruction describing the edit needed to enforce the plan. A classification applies to the work described in that section, not automatically to the whole application or repository.

## 1. Executive summary

> **Edit required: Enhance.** Retain the architecture summary and strengthen it with the implementation direction and the edit classifications used throughout this plan.


Gabfix is a multi-application cleaning and home-services platform backed by one Supabase project:

1. **Client app** — Expo / React Native customer application.
2. **ERP app (Gabfix Portal)** — Expo / React Native staff application with role-specific workspaces.
3. **Admin web** — browser application for admin, manager and customer-relations desk work.
4. **Backend** — Supabase Postgres, Auth, Storage, Realtime and Edge Functions, with one Hono `api` entry point for the client app.

The architecture document is the source of truth for behaviour and decisions. Existing client layouts and flows should be retained and connected to server data; existing legacy ERP behaviour should be adapted into the new Admin Web and ERP apps. The implementation should not introduce a shared application package or bypass the specified data-access boundaries.

### Current implementation snapshot

> **Edit required: Enhance.** Keep the verified baseline and update it as repository changes are completed; do not replace existing progress with estimates.


| Area | Current state found in the uploaded repository | Planning implication |
|---|---|---|
| Client app | All 40 page builds exist; Phase 1 is closed at code level; mock API, style gate and responsive gallery exist. Client progress reports 68.9% weighted overall, 15 Jest suites / 112 tests, and no real-device page verification. | Preserve the existing screens and finish device acceptance and backend cutover rather than rebuilding UI. |
| ERP app | Foundation and technician workflow exist: auth, role/capability gates, home, jobs, job detail, schedule, cash, notifications and profile. Setup checklist reports 13/19 ERP items complete; native/device verification remains open. | Extend the current shell into the remaining role workspaces and verify on real devices. |
| Admin web | React 19 + Vite SPA exists, with Supabase auth and live operational reads already wired for core entities. Current ecosystem progress estimates about 3/7 checklist areas complete (~43%). | Keep Vite (already in use); finish the real-data pages, forms and desk workflows. |
| Backend | Local Supabase migrations, seed data, RLS, RPCs and Hono API are present. Ecosystem progress estimates about 84% of M2 scope; the booking media contract is complete locally, while auth, payment, wallet, security, referral, review and push routes remain. | Stabilise the local schema/API contract, complete missing routes and test all security boundaries. |
| Architecture decisions | Current architecture document says 20/25 decisions are confirmed (80%). D18, D19, D21, D22 and D23 remain open. | Resolve these decisions before implementing dependent flows. |

**Important status distinction:** percentages above are area-specific measures from the project’s own progress files. They are not a single ecosystem completion percentage and must not be added together. “Implemented in code”, “verified in a browser”, “verified against local Supabase” and “verified on a physical device” are separate states.

---

## 2. Architecture rules that govern implementation

> **Edit required: Optimize.** Tighten implementation to the agreed boundaries and security rules; remove any code that violates them, without removing this governing section.


These are delivery constraints, not optional design preferences.

### 2.1 Application boundaries

> **Edit required: Optimize.** Modify app integrations and data access where they breach the defined boundaries; preserve the four independent applications.


- `client-app/`, `erp-app/`, `admin-web/` and `backend/` remain independent folders with independent package files.
- Do not introduce a monorepo workspace, shared package or Metro configuration workaround.
- The apps share the backend, not source code. Generate database types independently into each app when the schema changes.
- The client app talks to the backend only through the Hono `api` Edge Function. Do not add the Supabase client to the customer app.
- Admin Web and ERP may use the Supabase JS client for ordinary reads, live updates and permitted CRUD under RLS.
- Sensitive or rule-bearing writes must go through the designated RPC/Edge Function/Hono route. Examples include booking-stage transitions, quote decisions, assignment, cash corrections and payment confirmation.
- Every table must have RLS enabled in the same migration that creates it. Do not rely on front-end filtering for security.
- Migrations are the only route for schema changes. Do not make production-only dashboard edits.
- Use additive migrations and preserve financial/audit history. Do not hard-delete services, bookings, payments or other business records where the architecture calls for deactivation or append-only correction.

### 2.2 Technology baseline

> **Edit required: Optimize.** Align existing dependencies and services with the agreed stack; replace only conflicting technology, not working approved foundations.


| Layer | Agreed technology / direction |
|---|---|
| Customer and staff mobile | Expo + React Native + TypeScript + Expo Router |
| Admin Web | React + Vite is already present; retain it. |
| Data | Supabase Postgres; SQL migrations; RLS |
| Client API | One Hono function named `api`, on Deno |
| Other backend functions | Separate Edge Functions for distinct triggers such as webhooks, scheduled work and database-triggered notifications |
| Authentication | Supabase Auth; password sign-in at launch; staff invite codes |
| Storage | Supabase Storage; private job/inspection media and public catalogue images |
| Live updates | Supabase Realtime |
| Mobile push | Expo push service and `expo-notifications`; Firebase only supplies Android FCM credentials |
| Offline | Zustand/AsyncStorage action queue; TanStack Query persistence; NetInfo |
| Local environment | Docker Desktop, Node and Supabase CLI |
| Deployment | Manual Supabase CLI first; CI automation after a staging environment exists |
| Payment gateway | Owner to select later; fake adapter remains until a provider is selected |
| SMS provider | Owner to select later; Africa’s Talking is ruled out on cost; adapter boundary must remain provider-neutral |

### 2.3 Decisions and open questions

> **Edit required: Enhance.** Add decision owners, due dates and recorded outcomes; keep unresolved items visible until formally confirmed.


The current architecture document records **20 of 25 decisions confirmed**. The remaining decisions are:

- **D18 — Laundry for app customers:** determine whether and how customers can place laundry orders through the client app.
- **D19 — Legacy data:** decide the migration/import treatment for historical records and which records are brought forward.
- **D21 — Live tracking:** settle the customer-facing live tracking scope and behaviour.
- **D22 — Admin web:** settle the remaining Admin Web scope/implementation decision points. Vite is already used in the repository and should not be replaced without an explicit decision.
- **D23 — Staff GPS trail:** settle whether and how staff location history is collected, viewed, retained and permissioned.

Other areas remain partly open even though their parent decisions are confirmed. Examples include the SMS and payment providers, gateway fees and card availability, notification events that bypass quiet hours, exact phone-number detection in technician chat, and selected commission/travel-time rules. These must be maintained as explicit decision items; do not silently convert a proposal into an agreed requirement.

---

## 3. Design system — use the Client App theme

> **Edit required: Enhance.** Extend the existing Client App design system consistently into ERP and Admin Web, adapting layouts to each platform rather than redesigning the brand.


The client app’s `src/theme/tokens.ts` is the canonical visual reference. The Admin Web and ERP app should use the same visual language, adapting component geometry to their platform. The architecture notes that the ERP may be differentiated slightly from the client app, but no alternative ERP palette has been confirmed. Start with the client palette and introduce only a restrained variation after approval.

### 3.1 Brand palette

> **Edit required: Enhance.** Apply the existing semantic tokens across all applications and add missing state tokens only where required.


| Token | Value | Usage |
|---|---|---|
| `green50` | `#E8F6EE` | Soft selected/positive surfaces |
| `green100` | `#C5E8D3` | Light green borders and fills |
| `green300` | `#5BBF86` | Secondary green accent |
| `green500` | `#118E45` | Primary brand green, primary actions |
| `green700` | `#1A5E2F` | Deep brand green, emphasis |
| `green900` | `#1C411E` | Deepest brand green, dark text on yellow |
| `yellow50` | `#FFFCE0` | Soft highlight background |
| `yellow200` | `#F5EE5E` | Secondary highlight |
| `yellow500` | `#F7EB15` | Signature bright yellow; selected nav/accent |
| `yellow600` | `#E7BE1F` | Deeper yellow accent |
| `yellow800` | `#8A6D00` | Dark yellow text/accent |
| `bg` | `#F6F8F6` | App/page background |
| `surface` | `#FFFFFF` | Cards, sheets, fields |
| `border` | `#DDE5DF` | Dividers and field outlines |
| `text` | `#16221A` | Primary text |
| `textMuted` | `#5F6F65` | Secondary text |
| `placeholder` | `#9AA79F` | Placeholder/disabled text |
| `error` | `#D32F2F` | Destructive/error state |
| `warning` | `#E7A500` | Warning state |
| `info` | `#1976D2` | Informational state |

Use semantic tokens for success, warning, error and information states. MTN, Airtel and Visa brand colours are reserved for payment-method identity, not general interface decoration.

### 3.2 Typography

> **Edit required: Enhance.** Apply the existing Poppins and Inter hierarchy consistently; replace inconsistent local font choices where found.


- **Headings:** Poppins. Use Poppins Bold for display/H1 and Poppins SemiBold for H2/H3.
- **Body and controls:** Inter. Use Regular for body, Medium for labels/captions and SemiBold for buttons.
- **Display:** 32/40.
- **H1:** 26/34.
- **H2:** 20/28.
- **H3:** 17/24.
- **Body large:** 16/24.
- **Body:** 14/20.
- **Caption:** 12/16.
- **Button:** 16/20.
- **Price:** 20/24, tabular numerals.

Avoid introducing a new font family in one of the staff applications. The ERP already has the client token/font foundation; Admin Web has already mirrored the client typography and palette in CSS variables.

### 3.3 Geometry and spacing

> **Edit required: Optimize.** Normalize inconsistent spacing, radii, sizing and touch targets to the documented token scale.


- Spacing follows a **4-point scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64.
- Radii: input 12, button 14, tile 16, card 20, sheet 28, hero 40, pill 999.
- Mobile button height: 52; compact button 40; input 52; touch target minimum 48; tab bar 64.
- Mobile header baseline: 56.
- Use white cards over `#F6F8F6`, thin neutral borders, soft green-tinted shadows and consistent 16–24 px content spacing.
- Keep sticky headers, bottom sheets, toast and modal layers in a consistent z-order.
- Avoid hard-coded colour, radius and spacing values in screen files. Use tokens.

### 3.4 Shared component patterns

> **Edit required: Enhance.** Extend the established component patterns across apps, adding missing states and variants while preserving platform-appropriate implementations.


Implement or retain these patterns consistently:

1. **Screen shell:** safe-area-aware page, background token, scrollable content and standard horizontal padding.
2. **Page heading:** Poppins title, concise supporting text, optional action on the right.
3. **Card:** white surface, 20 px radius, 16 px padding, subtle green-tinted shadow.
4. **Primary button:** green fill, white Inter SemiBold label, 52 px mobile height, 14 px radius.
5. **Secondary button:** white fill, 1.5 px green border and green label.
6. **Destructive action:** red text/fill, always separated from routine actions and confirmed where irreversible.
7. **Form field:** white surface, 52 px height, 12 px radius, 1.5 px border; clear focus and error states.
8. **Selection tile/chip:** neutral border at rest, pale green fill and green border when selected.
9. **Bottom sheet:** shared shell, pinned header/close affordance, safe-area inset and scrollable body.
10. **Status chip:** semantic tint and concise label; never use colour alone to convey status.
11. **Empty state:** small illustration/icon, direct heading, one sentence and one useful action.
12. **Loading state:** skeletons matching the final content geometry; avoid full-screen spinners for ordinary list refresh.
13. **Offline banner:** visible but compact; state whether changes are queued or whether the user must retry.
14. **Confirmation dialog:** explain the consequence in plain language and distinguish cancel from confirm.

### 3.5 Platform-specific expression

> **Edit required: Optimize.** Adjust responsive layouts and interaction patterns for mobile versus desktop while keeping the same visual language.


**Client mobile**
- Preserve the client’s existing screen layouts and booking flow.
- Use photo-led service discovery, clear category hierarchy and strong price/quote distinctions.
- Keep the bottom navigation and booking summary patterns already defined by the client UI specifications.
- Use the existing shared sheets, form engine and input components rather than creating parallel implementations.

**ERP mobile**
- Use the same brand colours and typography, but optimise density for field work: readable job cards, large status actions, obvious offline state and high-contrast information.
- Retain the established 65 px flush bottom tab bar where the current ERP shell uses it; do not arbitrarily change the measured parity baseline.
- Technician actions must be reachable with one hand and remain usable in poor connectivity.
- Do not expose customer or technician phone numbers beyond the fields explicitly allowed by the architecture.

**Admin Web**
- Use the same palette and fonts, with desktop-appropriate density.
- Sidebar navigation, top bar, page title, filter/action row, data table/list and detail drawer/page should form a predictable page frame.
- Use compact tables for high-volume operational data, but preserve readable row height and clear status chips.
- Provide keyboard focus rings, accessible labels, responsive layouts and clear empty/error/loading states.

---

## 4. Existing implementation inventory — record of progress

> **Edit required: Enhance.** Keep this as the evidence-based progress record; add newly verified work and update gaps without discarding existing implementation.


This section is the baseline ledger. Items below were found in the uploaded repository or stated in its dated progress/readiness documents. They are **existing work**, not new tasks. The delivery team should update their status only when new evidence is available.

### 4.1 Client app (`client-app/`)

> **Edit required: Enhance.** Retain the existing 40 page builds and current flows; connect remaining mock data and unfinished interactions to the agreed backend contracts, then complete device verification.


**Existing structure and foundations**
- Expo / React Native application with Expo Router and TypeScript.
- Theme tokens, shared styles and component styling in `src/theme/`.
- Authentication, onboarding, welcome, login, sign-up, OTP placeholder, password reset and session/device-related screens.
- Service/category configuration, service content, pricing, add-ons, media, promotions, reviews, support and payment configuration.
- Stores for booking drafts, bookings, addresses, payment methods, notifications, messages, tickets, plans, referrals, reviews, profile settings, sessions and media uploads.
- API client and REST contract already exist; the customer app is intended to remain API-only through Hono.
- Local mock API server exists under `client-app/mock/`.
- Style-check script exists at `client-app/scripts/check-style.mjs`.
- Existing service form engine and dynamic form renderers exist, with seed schemas and tests.
- Shared bottom-sheet and booking-flow components have been consolidated.

**Existing user-facing flows and capabilities**
- Home dashboard and service discovery/category pages.
- Search and service detail.
- Booking flow, address/location, dynamic service scope questions, review/confirmation.
- Quote request flow and quote-related client screens.
- Booking list/detail, rescheduling/cancellation-related flows and receipts.
- Payments, mobile-money number handling, balance payment, wallet/payment methods and review/tip flow.
- Reviews and rating prompts.
- Support/help centre, tickets and chat client-side stores/screens.
- Notifications, preferences and quiet-hours surfaces.
- Referral and recurring-plan client surfaces.
- Profile, security, device/session and account-management surfaces.
- Live-tracking client hooks and tracking-related UI contracts.
- Offline/local draft persistence and retry-oriented client mechanisms where already specified.

**Recorded verification**
- The client progress record reports all 40 page builds exist and screen-build work is closed.
- Phase 1 close (24 Nov) reports TypeScript, lint, Jest (15 suites / 112 tests) and style gate passing.
- Mock API smoke checks cover health, search, booking, idempotent replay, tracking and an OTP error case.
- Responsive `/dev` gallery was captured at 360×800, 390×844 and 430×932 with no horizontal overflow.
- No real-device verification is recorded for the 40 pages. Do not label these pages device-accepted until the device checklist is completed.

**Remaining client work**
- Complete physical-device acceptance for the client journeys, including Android and iOS where available.
- Complete Hono backend contract coverage and cut over the remaining mock-backed stores.
- Confirm server-driven catalogue/forms/pricing data matches existing client layouts.
- Finish live tracking once D21 is decided.
- Verify push on development builds with real credentials.
- Confirm account deletion, guest receipts/feedback and recurring-plan behaviour against the server.
- Verify upload, retry, duplicate prevention and offline recovery on real devices.

### 4.2 ERP app (`erp-app/`)

> **Edit required: Enhance.** Build on the existing app shell, role gates, technician flow, cash and offline queue; add missing role workspaces and complete native/device verification.


**Existing code found**
- Independent Expo / React Native app, named Gabfix Portal.
- Theme token files copied from the client visual system.
- App configuration, app identity, logo/icon and splash assets.
- Supabase client/environment handling and generated database types.
- Authentication store and sign-in screen.
- Capability/role gate (`RequireCapability`) and role/capability utilities.
- Main app shell and role-aware tab navigation.
- Screens/routes present for Home, Jobs list, Job detail, Schedule, Cash, Notifications and Profile.
- Job photo component and photo/storage helpers.
- Offline banner, ordered action queue, sync manager and query-cache persistence.
- Status rules, formatting, phone helpers and generated database types.

**Recorded implemented behaviour**
- Staff sign-in against local Supabase was browser-verified for technician, desk and manager demo users.
- Role-filtered navigation and RLS-scoped job data were verified in the browser export.
- Technician job status flow exists: On the way → Start/In Progress → Complete.
- Job detail displays customer, contact and address data permitted to the assigned technician.
- Cash payment recording and cash/handover surfaces exist.
- Offline action queue replays status/cash actions when connectivity returns; a “Waiting to sync” list is present in Profile.
- Home dashboard, schedule and job list have browser-level implementation.
- Visual shell has been measured against client app dimensions: Poppins page title, header/avatar/bell placement and a flush 65 px bottom bar.
- ERP release checklist records the baseline app identity, icon and splash setup.

**Recorded gaps**
- No physical-device/native acceptance pass is recorded.
- Camera and gallery capture have not been verified on a real device.
- Push notifications remain open.
- Inspection capture/report flow remains open.
- Sales operator screens remain open.
- Laundry operator workspace and machine workflow remain to be completed/verified.
- Manager and admin ERP role-specific views need the full agreed role home-screen content.
- Confirm offline queue conflict/reassignment behaviour under real network loss and restore.

### 4.3 Admin Web (`admin-web/`)

> **Edit required: Enhance.** Keep the React/Vite foundation, live operational reads and existing pages; complete real-data conversion and missing desk workflows.


**Existing code found**
- React 19 + Vite SPA, TypeScript.
- Existing App shell, Sidebar, Topbar, Login, UI primitives, icon and chart components.
- Pages present: Overview, Bookings, Cash, Cleaners, Customers, Payments, Promos, Reports, Services and Settings.
- Supabase client, auth helpers, database types, query helpers, phone helper and formatting utilities.
- CSS theme variables and client-app typography/palette alignment.
- Existing technician assignment dialog and operational components.

**Recorded implementation**
- Supabase Auth and role mapping exist.
- Live queries are recorded for bookings, booking items, assignments, addresses, profiles, technicians, payments, cash handovers and cash disputes.
- Overview page has a gradient hero, greeting and four stat tiles.
- Sidebar selected state uses the client brand yellow.
- Typecheck and Vite production build have passed.
- Admin web is no longer accurately described as wholly mock-only: core operational reads are already connected. Some pages/settings still use mock or placeholder data.

**Remaining Admin Web work**
- Complete page-by-page real-data conversion and remove remaining mock/demo assumptions.
- Build the support queue (support conversations, tickets and technician chats).
- Implement the full service/category/form builder and version history.
- Complete booking detail, quote/inspection decision controls and manager queues.
- Complete cost entry, commission approval/payout, referral and promo administration.
- Complete reports/invoices and export flows.
- Complete audit-log viewing, settings and notification preference/template administration as agreed.
- Run accessibility, keyboard, responsive and browser acceptance passes.
- Add production deployment configuration after staging is available.

### 4.4 Backend (`backend/`)

> **Edit required: Enhance.** Preserve migrations, RLS, RPCs and existing Hono routes; complete missing contracts, integrations, tests and deployment configuration.


**Existing code found**
- Supabase config and local project structure.
- SQL migrations and seed file.
- Hono `api` Edge Function.
- Generated database types in ERP and Admin Web.
- Supabase local-first guidelines.
- Migrations for portal core, helper functions, RLS, RPCs, storage, booking contact/address access, Phase 2 core/RLS/storage and catalogue keys.

**Recorded backend progress**
- Local containers and `supabase db reset` have been run successfully according to ecosystem progress.
- RLS and audit triggers, capabilities/RPCs, private media buckets and seed data exist.
- Seed data includes demo auth users/profiles, bookings, assignments and services.
- Local REST checks verified technician-scoped access versus manager/desk-wide access.
- Booking status RPC flow and key assignment constraints were tested.
- Hono `api` has local routes for health, profile, catalogue, services, search, availability, bookings, quotes, support and notifications; idempotent booking writes have been smoke-tested.
- The project progress reports roughly 84% of M2 scope.

**Remaining backend work**
- Complete missing Hono routes for auth, payment, wallet/receipts, security/sessions, referrals, reviews, push and any remaining client store contracts (booking media targets/complete/refresh/delete are done).
- Complete payment webhook and adapter behaviour; keep fake gateway until provider selection.
- Implement and verify notification event triggers, de-duplication, quiet hours and push receipt cleanup.
- Complete scheduled jobs for reminders, plan visits, guest link expiry and housekeeping.
- Complete RLS negative tests for every role and object ownership boundary.
- Complete upload policies and signed-URL lifecycle tests.
- Re-run migrations from an empty local database and prove deterministic reset.
- Prepare separate staging and production configuration/secrets.

### 4.5 Cross-project documentation already present

> **Edit required: Optimize.** Consolidate conflicting or superseded guidance by marking the current architecture as authoritative; retain useful historical documents as references.


The repository also contains:
- `Full_App_Architecture_2.md`
- `gabfix-eco-progress.md`
- `Technician_App_Setup_Checklist.md`
- `erp-app/ERP_Release_Readiness_Checklist.md`
- `client-app/Gabfix_UI_Progress.md`
- `client-app/Gabfix_Implementation_Plan.md`
- `client-app/Gabfix_App_Ui_1.md` and `Gabfix_App_Ui_2.md`
- `client-app/Phase_2_Unified_Implementation_Checklist.md`
- `client-app/Client_App_Ecosystem_Alignment.md`
- Phase 2 stage and addendum documents

These documents remain useful implementation references. Where older UI or Phase 2 documentation conflicts with the current architecture, the architecture takes precedence.

---

## 5. Target system structure and data flow

> **Edit required: Optimize.** Align the existing implementations and integration paths to this target structure; change only the components and flows that do not conform.


### 5.1 Logical architecture

> **Edit required: Optimize.** Modify integrations to match the defined app-to-backend boundaries and preserve the single Supabase project and designated API paths.


```text
Customer
  └── Client App (Expo)
        └── Hono `api` Edge Function
              ├── Auth/session validation
              ├── Request validation and idempotency
              ├── Domain rules (pricing, forms, booking stages)
              └── Supabase Postgres / Storage

Staff
  ├── ERP App (Expo; all staff roles)
  │     ├── Supabase JS: permitted reads / realtime / CRUD under RLS
  │     └── RPCs / Edge Functions: sensitive writes
  └── Admin Web (React + Vite)
        ├── Supabase JS: permitted reads / realtime / CRUD under RLS
        └── RPCs / Edge Functions: sensitive writes

Supabase project
  ├── Postgres + migrations + RLS + audit
  ├── Auth
  ├── Storage
  ├── Realtime
  ├── Hono `api`
  ├── Separate webhook / scheduled / database-triggered functions
  └── Expo Push service integration
```

### 5.2 Core request lifecycle

> **Edit required: Enhance.** Implement and verify each validation, persistence, audit, realtime, notification and offline-retry step that is not already present.


1. The app authenticates the user and obtains a Supabase session.
2. The app sends only the data required for the requested action.
3. Hono or the relevant RPC/function validates identity, role, schema, ownership, state transition and idempotency.
4. The database enforces constraints and RLS.
5. The write and audit event are committed.
6. Realtime updates refresh connected staff screens; notification triggers create in-app notifications and send push where configured.
7. The client receives the architecture-defined response/error shape and updates local cache.
8. If offline, supported staff actions are persisted locally with a unique idempotency key and original timestamp, then replayed in order.

### 5.3 Domain modules

> **Edit required: Enhance.** Complete domain modules incrementally, reusing existing code and introducing only missing services, screens, tables and contracts.


Build and test around these bounded modules:

- Identity, staff invites, sessions and device management
- Roles, capabilities and RLS
- Service catalogue, categories, pricing and dynamic forms
- Booking requests, booking lifecycle and cancellation requests
- Quotes, optional inspections and inspection media
- Dispatch, technician availability, crew and schedule
- Job execution, task checklist, timer, before/after photos and offline sync
- Payments, balances, cash held, handovers and disputes
- Job costs, margins and sales commission
- Laundry orders, machines and laundry cash
- Support conversations, tickets and booking chat
- Notifications, preferences and quiet hours
- Promos, referrals and recurring plans
- Guest links, receipts, feedback and legal pages
- Reports, invoices and audit log

---

## 6. Detailed implementation workstreams

> **Edit required: Enhance.** Use the workstreams as the execution backlog; mark existing work complete only when supported by repository evidence and acceptance results.


The sequence below is dependency-aware. It is not a mandate to rewrite existing screens. Each task begins with a repository audit, then extends or connects the existing implementation.

### Workstream A — Repository baseline, integration and quality gates

> **Edit required: Optimize.** Standardize the existing per-app setup and quality checks; correct failing or inconsistent scripts without creating a monorepo workspace.


**Goal:** make the repository reproducible and establish a reliable acceptance baseline.

**Tasks**
1. Record the exact current commit and working-tree state for all four folders.
2. Install dependencies independently in each app; do not create a root workspace.
3. Run each app’s typecheck, lint and test commands and save outputs.
4. Run `supabase start` and `supabase db reset`; verify all migrations replay from zero.
5. Confirm generated database types match the current schema in both staff apps.
6. Verify environment variable names and `.env.example` files; ensure secrets are absent from Git.
7. Keep seed/demo users local-only; never deploy seed credentials.
8. Add a root-level project index linking architecture, progress and each app’s checklist.

**Visual/UX outputs**
- No new customer-facing screen.
- Add a developer-only system status page or documented smoke-test panel only if useful; it must not ship to production.
- Capture consistent screenshots for the baseline gallery at mobile widths and desktop breakpoints.

**Acceptance**
- Fresh local setup succeeds from documented instructions.
- Database reset is repeatable.
- All app quality commands have a recorded pass/fail state.
- No secrets or production test accounts are committed.

### Workstream B — Backend foundation and contract completion

> **Edit required: Enhance.** Extend the existing Supabase/Hono foundation with missing routes, contracts, triggers, policies and integration tests.


**Goal:** complete the server boundary before connecting all remaining app features.

**Tasks**
1. Review each existing Hono route against the client API contract.
2. Establish route groups and validation schemas; reject unknown fields.
3. Keep one Hono entry point for customer app routes; do not create parallel client APIs.
4. Centralise shared server-side form, pricing, booking-stage and push helpers in `_shared`.
5. Use idempotency keys on every retryable write.
6. Ensure rule-bearing writes are implemented through RPC/function paths, not unrestricted direct updates.
7. Complete the remaining client routes: media, payments, wallet, reviews, referrals, plans, tickets, chat, receipts and push-token lifecycle.
8. Keep webhooks, cron and database-triggered notifications as separate functions.
9. Add structured error responses and stable error codes.
10. Add integration tests for success, invalid payload, unauthorised role, wrong owner, invalid stage, duplicate retry and offline replay.

**Visual/UX outputs**
- API error messages must map to plain-language app states: session expired, no permission, unavailable, validation error, already processed, conflict and retry later.
- Admin/ERP screens must show non-blocking retry states and a clear “last updated” indicator where stale data matters.

**Acceptance**
- Every client store switched from mock to API has a documented route and test.
- Repeating a request with the same idempotency key creates no duplicate booking/payment/action.
- Hono auth and RLS both enforce the intended identity boundary.

### Workstream C — Authentication, roles and account lifecycle

> **Edit required: Enhance.** Build on existing auth and capability gates; add missing account lifecycle, invitation, recovery and device-management behaviours.


**Goal:** one account model across client, ERP and Admin Web.

**Tasks**
1. Confirm Supabase Auth customer sign-up/sign-in with phone or email and password.
2. Implement profile creation trigger and default customer role.
3. Implement staff invite creation, expiry, revocation, one-time redemption and role assignment.
4. Implement role/capability checks server-side and in route guards.
5. Implement device/session list, login history and admin device reset.
6. Implement deactivation and reactivation request flows.
7. Implement permanent customer deletion with password confirmation, safeguards, personal-data blanking and preserved financial records as defined in D14.
8. Keep staff accounts deactivation-only.
9. Apply D25 phone standard consistently: entry is 10 digits beginning `07`; legacy stored forms are normalised as a data migration/display fix; international form is created only for external provider links.

**Screens and visual details**
- **Client sign-in:** branded green gradient or approved auth treatment; Gabfix mark; clear phone/email selector or input; password field with visibility control; forgot-password link; primary green button; accessible error copy.
- **Client sign-up:** name, 07 phone, email/password as specified; concise privacy/terms links; validation inline.
- **Staff sign-in:** same typography and palette, but staff/Portal identity; invite-code registration screen; deactivated-account state.
- **Profile → Devices:** list device label/platform, last seen and current-session badge; “Sign out” action; admin reset action in staff management.
- **Delete account:** explanation screen, password confirmation, explicit irreversible warning, blocked states for upcoming bookings, unpaid balances, disputes or active plan.

**Acceptance**
- Customer cannot self-assign staff roles.
- Staff cannot sign up without a valid invite.
- Deactivated staff sessions are rejected.
- Deletion preserves financial/audit history and blanks only specified personal fields.

### Workstream D — Service catalogue, categories, pricing and dynamic forms

> **Edit required: Enhance.** Retain existing catalogue foundations and add the full configurable category, pricing, question/form and versioning workflows.


**Goal:** the database becomes the source of truth while preserving client layouts.

**Tasks**
1. Seed the existing seven customer categories and current service catalogue.
2. Implement category parent/child hierarchy, order, active state and inherited form.
3. Implement service name, description, image, category, required skill, pricing type, price/rate, duration and active state.
4. Keep customer category and technician skill separate.
5. Implement fixed, hourly and quote pricing types.
6. Implement admin-editable discounts, add-ons, materials, VAT and other values retained from the client app.
7. Implement versioned form definitions and booking form snapshots.
8. Preserve the nine existing field types and conditional visibility rules.
9. Implement form version history; old bookings must render the saved snapshot.
10. Deactivation hides a category/service from new customer bookings but preserves historical records.
11. Keep the existing client form layouts; new server-defined services reuse the same form engine.

**Admin Web screens**
- **Catalogue overview:** category tree on the left, service list/table on the right; search, active filter and Add category/service actions.
- **Category editor:** name, description, image, parent category, order, active toggle and optional inherited form.
- **Service editor:** image upload/preview, name, description, category, skill, pricing type segmented control, amount/rate, duration, active state.
- **Form builder:** section list, field palette, drag/reorder controls, field configuration, required toggle, conditional rule editor, preview and version history.
- **Service preview:** mobile-like card/form preview showing what the customer will see.

**Client screens**
- Catalogue category page with image, name and service count.
- Service card with one image, name, short description and fixed price/hourly rate/“Request a quote”.
- Service detail and booking form generated from the server form definition.
- Clear quote/inspection messaging; no customer selection of crew size.

**Acceptance**
- New services can be added without a client app release if they use existing field types/layouts.
- Old bookings render their original questions and answers after form edits.
- Fixed price is payable at booking; hourly/quote payment follows customer quote confirmation.
- Only active services/categories appear in the customer catalogue.

### Workstream E — Booking lifecycle, quotes, inspections and cancellation

> **Edit required: Enhance.** Connect and complete the booking lifecycle around existing booking APIs and screens; add missing quote, inspection, approval and cancellation states.


**Goal:** enforce the booking state machine consistently across all apps.

**Tasks**
1. Implement the agreed booking stages and a single server-side stage-transition function.
2. Persist every transition in `booking_status_history`.
3. Distinguish customer-created bookings from staff-created bookings and sales proposals.
4. Implement staff-created booking confirmation by manager phone call and record who confirmed and when.
5. Implement quote request lifecycle for hourly and quote services.
6. Implement optional inspection decision: manager/admin can quote directly or require an inspection.
7. Implement inspection scheduling, inspector assignment, checklist, notes, measurements, recommendations and media.
8. Lock submitted inspection reports; allow addenda without changing the original.
9. Implement customer quote accept/decline and move accepted requests into normal booking flow.
10. Implement cancellation request rules and manager decision queue.
11. Apply the agreed late-fee rules and ensure no staff role can bypass a restriction through a direct update.

**Client screens**
- **Bookings tabs:** Requests, Upcoming and Past; stage/status chip; concise next action.
- **Request detail:** service, address, date/time, submitted form answers, media, quote/inspection progress and customer response actions.
- **Inspection progress:** inspection required, scheduled, inspected; show scheduled date/time and a short explanation.
- **Quote review:** clear itemised total, VAT/discount lines, hours/crew context where relevant, accept/decline actions.
- **Cancellation request:** reason capture and pending/approved/declined state with decision note.

**Admin Web screens**
- **Booking queue:** filters by stage, date, source, service and assigned crew; status chip and priority indicators.
- **Booking detail:** customer, address, service, form snapshot, quote, payments, photos, status history, crew, costs and audit context.
- **Manager decision queue:** staff-created bookings to phone-confirm, cancellation requests and quote/inspection decisions.
- **Inspection workspace:** schedule inspector, view checklist, media gallery, notes, measurements and addenda.

**Acceptance**
- No invalid state transition is possible through app, API or direct client call.
- Staff-created bookings remain unconfirmed until manager confirmation.
- Quote/hourly request does not appear as an upcoming confirmed booking until accepted.
- Submitted inspection report is immutable except for addenda.

### Workstream F — Dispatch, technician work and offline operations

> **Edit required: Enhance.** Extend the existing technician job flow and offline queue with dispatch, assignment, crew, checklist, media and conflict-recovery behaviour.


**Goal:** complete field execution without compromising assignment rules or offline reliability.

**Tasks**
1. Implement technician profiles, skills, weekly availability and date overrides.
2. Implement dispatcher candidate filtering: availability, overlapping jobs, time off, work hours and daily hours cap.
3. Rank eligible candidates by skill match and priority rating; dispatcher makes the final decision.
4. Implement multi-technician crew with exactly one lead.
5. Trigger assignment notification.
6. Implement technician day/schedule views and job detail.
7. Implement required task checklist; required tasks block completion.
8. Keep job timer for overrun alerts/travel-time data; hourly billing remains the confirmed quote hours.
9. Implement before/after photos in private storage.
10. Implement ordered offline action queue with unique IDs, original timestamps, background media upload and retry.
11. Server wins on conflict if a job is reassigned while a technician is offline; show a clear resolution message.
12. Implement inspection assignment/capture and technician chat when those dependent features are ready.

**ERP technician screens**
- **Home:** greeting, today’s job count, next job card, cash owed, tips and assigned inspection; no irrelevant admin data.
- **Jobs list:** Today/Upcoming segments, job status, scheduled time, service, area and lead/helper indicator.
- **Job detail:** customer/service summary, permitted address/contact fields, dynamic form answers, task checklist, photos, timer and stage action.
- **Status actions:** large, high-contrast “On the way”, “Start job” and “Complete job” actions, shown only when valid.
- **Photo capture:** before/after segmented area, thumbnail grid, upload progress, retry state and camera/library actions.
- **Offline state:** persistent but compact banner; queue count; per-action sync status in Profile.
- **Schedule:** week/day view, working hours and assigned job cards.
- **Inspection detail:** checklist, measurements, notes and media capture when D9 workflow is enabled.

**Acceptance**
- Technician sees only assigned work and only permitted customer fields.
- Technician cannot claim or self-assign a job.
- Exactly one lead is enforced by database constraint.
- Offline actions replay once, in order, with original timestamps.
- Required checklist items block completion.

### Workstream G — Payments, balances, cash and job costs

> **Edit required: Enhance.** Retain existing cash and handover foundations; introduce missing payment-provider adapters, balance handling, cost capture and reconciliation controls.


**Goal:** financial records are auditable and derived from payment/cost entries.

**Tasks**
1. Implement multiple payment rows per booking/order.
2. Calculate total paid and balance from confirmed payment rows; never type balance manually.
3. Support app payment and cash payment, including partial payment.
4. Implement gateway adapter and fake provider; keep provider choice open until owner selects it.
5. Verify provider webhooks by signature, amount and reference; webhook processing must be idempotent.
6. Implement technician cash collection, cash handover, cash disputes and manager/admin resolution.
7. Keep laundry cash separate from contract-job cash.
8. Implement admin job-cost entry; margin is calculated as booking total less job costs.
9. Implement `costs_complete` action by admin.
10. Implement 3% sales commission of net income (price before VAT less job costs), floor at zero, payable only after job completion, payment and costs completion.
11. Implement manager monthly commission approval and admin payout screen.
12. Implement payment receipts consistently in-app, guest page and PDF.

**Client screens**
- Payment method selection (MTN, Airtel, Visa only when supported/approved; cash after service).
- Payment confirmation/pending/failed states.
- Booking payment summary: total, paid, balance and payment history.
- Receipt view and PDF/share action.
- Payment retry that does not create duplicate transactions.

**ERP screens**
- Technician Cash: cash collected, amount owed, handover history, open dispute and handover form.
- Laundry Cash: shop takings and orders, isolated from job cash.
- Admin cost entry: list of job cost lines with description and amount; calculated total; “Costs complete” action.
- Manager commission approval: monthly list with net-income calculation and approval controls.
- Admin commission payout: approved staff amounts, payout status and audit trail.

**Admin Web**
- Payments table with booking/order, customer, amount, method, status, provider reference, date and recorded-by.
- Cash page with technician totals, handovers and disputes.
- Job costs panel on booking detail.
- Commission approval and payout views.
- Reports and invoices with explicit date filters and export actions.

**Acceptance**
- Paid and balance values derive from payment rows.
- A payment record is never edited/deleted by the person who created it; correction is a new audited entry.
- Laundry cash is excluded from contract job cash/commission.
- Commission cannot be released before completion, confirmed payment and costs completion.

### Workstream H — Laundry orders and machines

> **Edit required: Create.** Introduce the laundry-specific customer/staff workflows, machine tracking and supporting data structures after the open laundry scope decision is confirmed.


**Goal:** deliver the agreed laundry operator workspace while keeping the scope free of stock/inventory.

**Tasks**
1. Implement laundry order stages: received, washing, drying, ready, delivered.
2. Support walk-in customers with name and phone only.
3. Implement machine records and machine activity logs.
4. Implement pickup/delivery information where agreed.
5. Keep shop cash and laundry payments separate from job cash.
6. Do not add inventory, stock, purchasing or tool checkout; those legacy modules were removed by D24.
7. Implement app-customer laundry flow only after D18 is resolved.

**ERP laundry operator home**
- Orders by stage with visible counts.
- Pickup and delivery queue.
- Shop cash summary and recent payments.
- Machine status and service-due indicators.
- Quick action to create walk-in order.

**Laundry order detail**
- Customer/walk-in identity, order items/notes as specified, current stage, timestamps, payment history and pickup/delivery actions.
- Stage actions should be prominent and sequential.
- Do not show inventory balances or stock deductions.

**Acceptance**
- Walk-in order can be created without an auth account.
- Stage history is traceable.
- Laundry cash is kept out of job cash and commission calculations.
- No inventory/stock module is implemented.

### Workstream I — Customer relations, support chat, tickets and technician chat

> **Edit required: Enhance.** Extend existing support foundations into complete desk queues, ticket states, customer conversations and permission-controlled technician chat.


**Goal:** one coherent support queue across Admin Web and the relevant ERP roles.

**Tasks**
1. Implement one ongoing support conversation per customer.
2. Implement ticket categories, ticket number, messages, status and up to three attachments.
3. Implement merged customer-relations queue for chats and tickets.
4. Implement booking chat between customer and current lead technician only.
5. Open technician chat on lead assignment; close and make read-only on job completion.
6. On lead change, preserve history and grant the new lead access.
7. Block phone numbers in technician chat server-side; client-side check is only an additional UX safeguard.
8. Notify the other participant on new chat messages; notify customer relations on new ticket/reply.
9. Support ticket reopen within seven days of resolution.
10. Link tickets and support messages to a booking/order where relevant.

**Client screens**
- Inbox with support conversation and booking-specific technician threads.
- Booking chat header clearly identifies the job and lead technician; no phone number is exposed.
- Closed chat state with read-only history and explanation.
- Help ticket creation, category, subject, message, attachment preview and status.
- Resolved ticket with Reopen action during the allowed window.

**Admin Web / ERP customer-relations screens**
- Unified queue sorted by latest activity.
- Tabs/filters for unread support, open tickets, in-progress tickets and resolved items.
- Conversation view with customer context and linked booking/order.
- Ticket detail with messages, attachments, status, internal note/resolution note and reopen state.
- Booking technician chat is read-only for desk staff.

**Acceptance**
- One support conversation per customer is enforced.
- Customer cannot read another customer’s conversation/tickets.
- Only current lead and customer can write to an open booking chat.
- Phone numbers are rejected by the server in technician chat.
- Closed booking chat is read-only.

### Workstream J — Notifications and communication preferences

> **Edit required: Enhance.** Build on existing notification routes and screens; add event coverage, preference controls, quiet hours, push delivery and retry/cleanup behaviour.


**Goal:** dependable, role-aware notification delivery.

**Tasks**
1. Persist every notification event in the `notifications` table.
2. Register Expo push tokens separately for each installed app/device.
3. Trigger sending through database webhook → Edge Function → Expo push service.
4. Apply preferences and quiet hours; identify critical events only after the relevant rule is confirmed.
5. Batch messages within Expo payload limits.
6. Process push tickets/receipts and remove dead device tokens.
7. Add deduplication to prevent repeated alerts for retried database events.
8. Keep channel IDs stable after release.
9. Implement Admin Web notification bell/unread count if retained in the final web design.
10. Keep notification wording fixed until editable templates are explicitly brought into a later release.

**Visual requirements**
- Bell with unread badge in Admin Web and ERP header.
- Notification list with clear title, short body, timestamp and read/unread distinction.
- Group or filter by category only if it improves scanning.
- Quiet-hours screen in the client app uses clear start/end times and a simple enable toggle.
- Permission-denied state explains how to enable notifications in device settings.

**Acceptance**
- In-app notification row is created even if push delivery fails.
- Duplicate event does not create duplicate notification.
- Dead tokens are pruned.
- Critical-event/quiet-hours behaviour matches confirmed settings.

### Workstream K — Promos, referrals and recurring plans

> **Edit required: Enhance.** Keep existing promo foundations and add missing referral attribution, eligibility, recurring-plan scheduling and administration.


**Goal:** implement growth and repeat-service features with server-enforced eligibility.

**Tasks**
1. Implement admin-managed promo codes, expiry, limits, service restrictions and one-per-customer rules.
2. Implement referral code/link, referred friend eligibility, qualifying first booking and payout state.
3. Implement recurring plans: weekly, several times per week, monthly and custom interval in days/weeks.
4. Create the next week of visits and roll the window forward over time.
5. Each visit is an ordinary booking with its own receipt and payment rows.
6. Apply repeat discount to every visit; promo and friend referral discount apply only to first visit.
7. No automatic recurring charge; remind customer to pay each visit.
8. Keep optional preferred lead technician on the plan; manager assigns them per visit where possible.
9. Notify customer beforehand if a replacement technician is assigned.
10. Skip, pause, resume and end controls must be available.
11. Block account deletion while a plan is active; customer must end it first.

**Client screens**
- Refer & Earn: referral code/link, share action, status and reward progress.
- Promo entry: code, eligibility feedback and discount summary.
- Plans list: service, schedule, next visit, preferred technician, status and repeat discount.
- Plan detail: upcoming visits, skip, pause/resume, end and change preferred technician request.
- Visit detail remains a normal booking detail with plan marker.

**Admin Web**
- Promo management table/editor.
- Referral ledger and payout status.
- Customer page Plans panel.
- Plan settings for first visit lead time, creation window and discount, where approved.
- Manager plan assignment visibility and replacement workflow.

**Acceptance**
- Discount eligibility is enforced by server.
- Visit creation is idempotent and never creates duplicates.
- No automatic payment is attempted.
- Deletion is blocked while plan is active.

### Workstream L — Guest links, receipts, feedback and legal pages

> **Edit required: Enhance.** Connect existing guest-facing or client UI surfaces to secure server-side token, receipt, feedback and legal-content behaviour; add missing screens as needed.


**Goal:** make staff-created bookings usable by customers without requiring app installation.

**Tasks**
1. Generate a private, long-random-token guest link for staff-made bookings.
2. Guest page shows readable receipt, payment status, PDF download, app download link and one-time feedback form.
3. Do not expose technician phone number or full street address; show area only.
4. Expire/hide booking details after the configured number of days (30 by default); show contact-company instruction.
5. Server generates the canonical receipt used in client app, guest page and PDF.
6. Show VAT and discounts as separate receipt lines; one receipt number per booking with all payment rows.
7. Feedback is one star rating plus optional comment per booking, routed to customer relations and separate from technician rating.
8. Publish Terms, Privacy and Payment/Refund public web pages.
9. Ensure privacy policy describes deletion and referral terms match current decision.

**Visual requirements**
- Guest receipt page: clean, mobile-first, Gabfix logo, receipt reference/date, service/customer summary, payment breakdown, paid/part-paid/balance status, download PDF and app link.
- Feedback: five large star targets, optional comment and clear submitted state.
- Expired page: no booking details; short explanation and contact route.
- Legal pages: readable single-column content, visible last-updated date and links between policies.

**Acceptance**
- Random token cannot be guessed or enumerated.
- Guest page exposes only approved fields.
- Receipt amount and status match authenticated app and server data.
- Feedback cannot be submitted twice for one booking.

### Workstream M — Reports, invoices, audit and operational controls

> **Edit required: Enhance.** Extend existing reporting and audit foundations with complete financial/operational reports, invoices, exports and controlled administrative actions.


**Goal:** give management reliable operational and financial visibility.

**Tasks**
1. Complete reports and invoices in first release as confirmed by D17.
2. Include bookings, payments, cash, costs, margins, commission, referrals and separate laundry reporting.
3. Add date filters and appropriate role access.
4. Add export to PDF/CSV where defined by the report.
5. Implement audit-log view for privileged staff.
6. Add manager decision queue and admin configuration controls.
7. Keep double-entry books and delivery notes/geofences in later release as confirmed; asset depreciation is dropped.

**Visual requirements**
- Overview dashboard: concise stat cards, trend/summary charts only where useful, date range control and “updated at” indicator.
- Reports list: report title, description, period, last generated and export action.
- Report detail: summary metrics, table, totals and footnotes explaining calculation.
- Invoice: printable layout with business details, customer, booking, line items, VAT/discount, payments and balance.
- Audit log: actor, action, entity, time and expandable before/after details; avoid exposing secrets or unnecessary personal data.

**Acceptance**
- Report totals reconcile with underlying payment/cost rows.
- Laundry remains separate.
- Only authorised roles can view sensitive financial and audit information.
- Exports use the same filters and totals as the on-screen report.

---

## 7. Role-based home screens and navigation

> **Edit required: Enhance.** Extend the current role-aware navigation and home screens with the complete agreed content for each staff role; retain working shell and route structures.


The architecture specifies different home priorities. Do not give every staff role the same generic dashboard.

| Role | Home screen content | Primary navigation / workspace |
|---|---|---|
| Technician | Today’s jobs, assigned inspection, cash owed, tips | Home, Jobs, Schedule, Cash, Profile; booking Chat only while lead chat is open |
| Customer relations | Tickets/chats waiting, follow-ups due, customer search | Support queue, Customers, Bookings read context, Follow-ups, Profile |
| Sales operator | Follow-ups, New proposal, lead pipeline, commission this month | Dashboard, Leads, Proposals, Follow-ups, My commission, My customers |
| Manager | Decision queue and today’s jobs | Overview, Bookings/Dispatch, Quotes/Inspections, Staff, Commission approval, Reports |
| Admin | Job costs, commission to pay, cash held, staff invites; no job list on home | Overview, Costs, Commission payout, Cash, Staff/Invites, Services, Settings, Reports |
| Laundry operator | Orders by stage, pickups/deliveries, shop cash, machines | Laundry Home, Orders, Machines, Cash, Profile |
| Customer | Next booking, requests, balances, service discovery and support | Home, Services, Bookings, Inbox, Profile |

Navigation should be capability-driven, not merely role-name-driven. The current combined manager role can be split later by changing capabilities without rewriting screens.

---

## 8. Visual screen inventory and component checklist

> **Edit required: Enhance.** Use this as a visual implementation checklist; add missing states/components and mark existing screens as complete only after visual and functional verification.


Use this as the UI design and QA checklist. Every screen must include loading, empty, error, offline (where relevant), disabled and success states.

### Client app

> **Edit required: Enhance.** Preserve the established customer screens and add or refine only the missing visual states, data connections and interactions.

- [ ] Auth and onboarding
- [ ] Home dashboard
- [ ] Category/service catalogue
- [ ] Service detail
- [ ] Dynamic service scope form
- [ ] Search and results
- [ ] Address selection and location
- [ ] Booking review and confirmation
- [ ] Quote request and inspection progress
- [ ] Bookings: Requests / Upcoming / Past
- [ ] Booking detail and crew display
- [ ] Payment method and payment result
- [ ] Balance and payment history
- [ ] Receipt and PDF share
- [ ] Review, tip and skip-tip
- [ ] Inbox, support chat and booking chat
- [ ] Help tickets and reopen
- [ ] Notifications and preferences
- [ ] Referral and promo
- [ ] Recurring plans and visit controls
- [ ] Profile, saved addresses, saved payment methods
- [ ] Security, devices, delete account
- [ ] Guest receipt/feedback web view

### ERP app

> **Edit required: Enhance.** Extend existing ERP screens for each staff role and add missing operational views, empty/error/loading states and capture controls.

- [ ] Sign-in and invite-code onboarding
- [ ] Role-based home for all six staff roles
- [ ] Technician jobs list and job detail
- [ ] Technician schedule
- [ ] Technician task checklist
- [ ] Before/after photo capture and upload queue
- [ ] Inspection list/detail/capture
- [ ] Technician cash and handover
- [ ] Notifications
- [ ] Offline banner and sync queue
- [ ] Customer relations support/ticket queue
- [ ] Sales dashboard, leads, proposals, follow-ups, commission, customers
- [ ] Manager decision queue and dispatch
- [ ] Admin cost entry, staff invites and commission payout
- [ ] Laundry orders, pickups/deliveries, machines and shop cash
- [ ] Profile, device/session and sign-out

### Admin Web

> **Edit required: Enhance.** Retain the existing admin page shell and expand page layouts, tables, filters, drawers, forms and responsive states to cover all workflows.

- [ ] Real staff sign-in and invite acceptance
- [ ] Overview
- [ ] Bookings list and detail
- [ ] Manager decision queue
- [ ] Dispatch and crew assignment
- [x] Quotes and inspections
- [ ] Customers and customer detail
- [ ] Unified support queue
- [ ] Tickets and booking chat read-only view
- [x] Service/category catalogue
- [x] Dynamic form builder and version history
- [ ] Pricing and settings
- [ ] Payments
- [ ] Cash handovers and disputes
- [ ] Job costs and cost completion
- [ ] Commission approval and payout
- [ ] Promos and referrals
- [ ] Recurring plans
- [ ] Reports and invoices
- [ ] Audit log
- [ ] Notification bell/preferences/templates as in release scope
- [ ] Legal content management only if required; public legal pages must be available

---

## 9. Recommended delivery sequence and dependencies

> **Edit required: Optimize.** Reorder implementation around confirmed dependencies, existing completion and risk; do not restart completed phases.


| Phase | Priority | Work | Depends on | Exit gate |
|---|---|---|---|---|
| 0 | P0 | Baseline, repo reproducibility, local DB reset, test inventory | None | All apps and DB can be started from clean setup |
| 1 | P0 | Backend schema/RLS/API completion and contract tests | Phase 0 | Stable contracts and security tests |
| 2 | P0 | Auth, roles, invites, phone standard and account lifecycle | Phase 1 | Customer/staff access proven |
| 3 | P0 | Catalogue, pricing, dynamic forms and service admin | Phases 1–2 | Server-driven catalogue works end-to-end |
| 4 | P0 | Booking lifecycle, quotes, inspections, cancellation | Phases 1–3 | Booking state machine verified |
| 5 | P0 | Technician dispatch, job workflow, offline queue and media | Phases 1–4 | Technician slice accepted on device |
| 6 | P0 | Payments, cash, job costs and commission | Phases 1, 4–5 | Financial reconciliation and audit pass |
| 7 | P1 | Customer relations support, tickets and booking chat | Phases 1–2, 4–5 | All chat/ticket permissions pass |
| 8 | P1 | Notifications and push | Phases 1–2, 4–7 | Push tested on physical devices |
| 9 | P1 | Laundry operator workflows | Phases 1–2; D18 for app customers | Shop order/cash flows accepted |
| 10 | P1 | Promos, referrals and recurring plans | Phases 1, 3–6; D18/D12 dependencies as applicable | Discount and visit generation tests pass |
| 11 | P1 | Guest links, receipts, feedback and legal pages | Phases 1, 4, 6 | Guest privacy and receipt parity pass |
| 12 | P1 | Reports, invoices, audit and Admin Web completion | Phases 4–11 | Role-based reports reconcile |
| 13 | P0 release gate | Full device, browser, security, backup and deployment verification | All release-scope phases | Owner sign-off and release checklist complete |

**Parallel work:** Admin Web page construction can proceed alongside ERP work once the schema and access rules for a module are stable. Do not build against guessed columns or provisional permissions. Client app backend cutover can proceed route-by-route while the staff apps use direct Supabase reads under RLS.

---

## 10. Testing and acceptance strategy

> **Edit required: Enhance.** Add repeatable acceptance coverage around existing automated checks and require browser, local-backend, security and physical-device evidence.


### 10.1 Automated checks

> **Edit required: Enhance.** Extend existing test suites and quality gates to cover every changed contract, role, state transition and failure path.

- TypeScript typecheck for each app.
- Lint for each app.
- Unit tests for phone validation, pricing, forms, state transitions, idempotency, offline queue and notification policy.
- Backend migration replay from an empty local database.
- RLS tests for every role and ownership boundary.
- RPC/Edge Function tests for sensitive writes.
- API contract tests for every Hono route.
- UI tests for critical flows and validation states.

### 10.2 Browser acceptance

> **Edit required: Create.** Introduce a documented browser acceptance runbook and evidence log for client, ERP and Admin Web flows.

- Admin Web at desktop and tablet widths.
- Client web export/gallery at 360, 390 and 430 dp equivalents where supported.
- ERP web export for shell/navigation and role-based routing, but do not treat browser pass as native device acceptance.
- Check console errors, horizontal overflow, keyboard focus, modal/sheet scrolling and responsive tables.

### 10.3 Physical-device acceptance

> **Edit required: Create.** Introduce a real-device test matrix covering permissions, camera/gallery, push, offline behaviour, navigation and layout.

- Android development build for client and ERP.
- iOS development build when signing credentials/device availability permit.
- Camera and photo-library permission and upload.
- Expo push delivery and notification tap routing.
- Deep links and guest links.
- Offline job action queue, app termination/reopen, retry and conflict resolution.
- Safe-area, keyboard, font loading, status bar, bottom navigation and splash.
- Mobile money provider sandbox only after provider selection; fake gateway tests before that.

### 10.4 Security and data integrity

> **Edit required: Enhance.** Expand existing RLS/RPC checks into a complete role-and-ownership matrix, including negative tests and audit verification.

- Customer cannot read another customer's booking, address, payment, chat or media.
- Technician sees only assigned jobs and approved customer fields.
- Sales operator sees only own leads, proposals and customers.
- Customer relations cannot confirm bookings or perform restricted changes.
- Manager-only confirmation/decision rules are enforced server-side.
- Admin-only job costs and staff administration are enforced server-side.
- Payment and audit rows are append-only/corrected through new records.
- Guest link never exposes technician phone or full address.
- Deleted customer personal data is blanked while financial records remain.
- Phone-number rules are consistent across all apps and server interfaces.

### 10.5 Definition of done

> **Edit required: Optimize.** Make completion criteria measurable and consistent: code, automated tests, backend verification, browser acceptance and device acceptance must be tracked separately.


A feature is not “done” merely because its screen exists. Mark it complete only when:
1. UI is implemented using the shared theme.
2. Loading, empty, error, success and offline states are handled.
3. Data contract and validation are implemented.
4. Permissions are enforced in the database/server.
5. Automated tests pass.
6. Browser/native acceptance is completed as appropriate.
7. Documentation and progress ledger are updated.
8. No conflicting legacy behaviour remains.

---

## 11. Project progress register

> **Edit required: Enhance.** Maintain this as the live implementation record; update statuses, evidence, owners and dates as work proceeds.


This register deliberately separates **already existing progress** from **new implementation work**. Update the date, evidence and status when a task changes. Do not mark a feature “verified” based only on file existence.

### 11.1 Baseline progress as at 24 November 2026

> **Edit required: Enhance.** Preserve this dated baseline as a historical snapshot and append newer dated snapshots rather than silently overwriting it.


| Area | Baseline progress | Status | Evidence / notes |
|---|---:|---|---|
| Architecture decisions | 20/25 = 80% | 🟨 | Five decisions remain: D18, D19, D21, D22, D23. Some sub-decisions remain open inside confirmed areas. |
| Client app | 68.9% weighted; screen builds 100% | 🟨 | 40 page builds exist; Phase 1 closed; 15 suites / 112 tests reported passing; 0/40 pages device-verified. |
| ERP app | 13/19 checklist items (~68%) | 🟨 | Foundation and technician slice exist; native/device pass, push, inspection capture and sales screens remain open. |
| Admin Web | ~3/7 checklist areas (~43%) | 🟨 | React/Vite shell, auth and core operational live reads exist; support, forms, reports, audit and remaining real-data pages remain. |
| Backend | ~78% of M2 scope | 🟨 | Migrations, RLS, RPCs, seed and Hono routes exist; media/payment/wallet/referral/review/push routes and webhook/integration work remain. |
| Setup checklist | 24/42 | 🟨 | Use `Technician_App_Setup_Checklist.md` as the detailed task ledger. |
| ERP release readiness | Partial | 🟨 | Use `erp-app/ERP_Release_Readiness_Checklist.md`; browser proof is not native proof. |

**Snapshot — 2026-11-25, later session:** 28 tracked items — 0 ✅, 3 🟦 (A1, A2, F1), 18 🟨, 7 ⬜ (C2, G1, H1, J1, K1, M2, Z1). G3 moved ⬜→🟨 (cost approval, commission and the console Costs page), I1 gained the console Support inbox, E2 gained the server-backed quote-request pipeline, and the console now refreshes itself from Supabase realtime (`lib/live.ts` + a live pill in the topbar). Partial credit (✅ 1 · 🟦 0.75 · 🟨 0.5 · ⬜ 0) gives 10.25 + 9 = **19.25 → ~69% of the plan register**; still 0 release-verified. **Decision count reconciled (2026-11-25):** **18/25 decided (72%)** — D1–D10, D13, D14, D15, D16, D17, D20, D24, D25. Open: D11 (late fees, tips, promos, referrals), D12 (payment gateway and SMS provider), D18 (laundry for app customers), D19 (legacy data), D21 (live tracking), D23 (staff GPS trail). D22 (admin-web on Vite + React) is implemented and in production use but has no written decision text, so it is counted as neither. The earlier “20/25” line above counted D11/D12 as decided and the client alignment file's 🚫 rows as undecided; both were wrong — D13–D17 are decided in this plan and D11/D12 are not. 

**Snapshot — 2026-11-25, end of session (append-only reading of §11.3):** 28 tracked items — 0 ✅, 3 🟦 (A1, A2, F1), 17 🟨, 8 ⬜ (C2, G1, G3, H1, J1, K1, M2, Z1). Partial credit (✅ 1 · 🟦 0.75 · 🟨 0.5 · ⬜ 0) gives **28 items ≈ 10.75 → ~38–40% of the plan register**; 20 of 28 items have some implementation, none is release-verified. The customer→booking→quote→inspection→dispatch→job→cash slice is the part that is nearly built (browser/local only) and the untouched batch is the money/provider/audit tail (G1, G3, H1, J1, K1, M2). Decision counts are inconsistent across documents: this table records 20/25 decided while `client-app/Client_App_Ecosystem_Alignment.md` lists 15 confirmed plus D22 implemented (16/25); reconcile before quoting a decision percentage again. |

### 11.2 Existing changes credited to the project

> **Edit required: Enhance.** Continue crediting verified repository work so teams do not rebuild it; link each credited item to its acceptance evidence where available.


**Client app**
- [x] Expo/React Native customer app and 40 page builds.
- [x] Canonical design tokens, shared styles and client UI specifications.
- [x] Dynamic form engine and seed schemas.
- [x] Mock API server and client REST contract.
- [x] Style gate and responsive `/dev` gallery.
- [x] Booking, quote, payment, wallet, review, tip, support, ticket, plan and referral screen/store foundations.
- [x] Shared bottom-sheet shell and booking draft-exit guard.
- [x] 07-only phone standard and copied helper logic.
- [x] Phase 1 quality checks reported passing: typecheck, lint, 15 Jest suites / 112 tests and style check.
- [ ] Physical-device verification of the 40-page set.

**ERP app**
- [x] Expo Portal project, app identity, logo/icon and splash.
- [x] Client-derived theme tokens and fonts.
- [x] Supabase auth/session foundation and role/capability gates.
- [x] Role-filtered app shell and bottom navigation.
- [x] Home, Jobs, Job detail, Schedule, Cash, Notifications and Profile routes.
- [x] Job status lifecycle and server RPC integration.
- [x] Cash payment entry and handover/dispute foundations.
- [x] Offline action queue, sync manager and query persistence.
- [x] Job photo component and storage helpers (capture still needs device verification).
- [ ] Native device pass, push, inspection capture, sales workspace and full role home coverage.

**Admin Web**
- [x] React/Vite app and shared page shell.
- [x] Sidebar, topbar, login, UI primitives, charts and assignment dialog.
- [x] Overview, Bookings, Cash, Cleaners, Customers, Payments, Promos, Reports, Services and Settings page files.
- [x] Supabase client/auth and role mapping.
- [x] Live reads for core operational entities listed in §4.3.
- [x] Client-aligned palette and typography.
- [x] Typecheck and production build reported passing.
- [ ] Remaining mock-to-live conversion and full module workflows.

**Backend**
- [x] Supabase local project config and migrations.
- [x] Core tables, RLS, helper functions, RPCs, audit triggers and storage buckets.
- [x] Seed data and successful local reset reported.
- [x] Hono `api` function and local routes for health/profile/catalogue/services/search/availability/bookings/quotes/support/notifications.
- [x] Idempotent booking write smoke test.
- [x] Booking create enforces 3-hour same-day lead and technician availability/capacity server-side; idempotency replay preserved.
- [x] Category form definitions seeded from client schemas (7 categories); booking create validates answers against stored current definition and writes `booking_form_snapshots` with server-selected definition/version.
- [x] Booking media contract: `booking_media` table with RLS, signed upload target/complete/refresh/delete routes, upload targets returned by `POST /bookings`, and server-side 10-item/25 MB/30 s-video/mime checks. Local smoke: upload → complete → refresh 409 → delete 200; 11th item, oversized video, 30 s+ video and unsupported mime all 400.
- [x] Receipts desk-issue policy fixed: desk/admin/CR can issue a receipt for a booking (issued_to must be that booking's customer); customer insert still 403.
- [ ] Complete remaining client API routes and provider integrations (auth, payments/wallet/receipts, security/sessions, referrals, reviews, push).
- [ ] Complete full role-by-role RLS and storage negative test suite.

### 11.3 New implementation progress tracker

> **Edit required: Enhance.** Use the tracker to record owner, status, evidence, dependencies and completion date for each new or modified task.


Status legend: `⬜ Not started` · `🟨 In progress` · `🟦 Ready for verification` · `✅ Verified` · `🚫 Blocked`

| ID | Work item | Status | Owner | Evidence / next action |
|---|---|---|---|---|
| A1 | Clean local setup and migration replay | 🟦 | Backend | Re-run from clean checkout and attach logs |
| A2 | App-level typecheck/lint/test baseline | 🟦 | App leads | Record per-app command output |
| B1 | Complete Hono route inventory and contract map | 🟨 | Backend | Route-by-route client map recorded in §11.5. Media targets/complete/refresh/delete now live and smoke-tested. `GET /quotes` now enriches each RLS-filtered quote with its booking reference/status/scheduled start and service name (service-role read scoped to the already-visible booking ids), verified 200 as admin; `POST /bookings` opened to hourly/quote requests without the lead/capacity gate. Still missing: payments, wallet/receipts, security/sessions, referrals, reviews, tracking (D21), webhook/scheduled handlers. Push token lifecycle landed locally (`POST /device-tokens`, client registration on every signed-in launch) and `GET /bookings`/`GET /quotes` now carry the assigned crew. |
| B2 | Complete missing client API routes | 🟨 | Backend | Media upload contract done (W3). Next: auth routes, then payment/wallet/receipts (W6), security/sessions (W7), referrals/reviews (W8), push (W7/J). |
| B3 | Full RLS and negative permission tests | 🟨 | Backend | Receipts desk-issue policy fixed and checked positive/negative (desk 201, customer 403, wrong issued_to 403). `booking_media` RLS added. Quotes, support threads and notifications now have positive/negative contract tests (customers see only their own). Full role-by-role negative suite still open. |
| C1 | Customer/staff auth and invite lifecycle | 🟨 | Backend + apps | Complete invite, deactivation, device reset |
| C2 | Permanent deletion flow | ⬜ | Backend + client | D14 safeguards and preserved financial history |
| D1 | Server-driven catalogue and pricing cutover | 🟨 | Backend + client + admin | Client reads categories/services/detail via API with bundled fallback; 7 category form definitions seeded and booking create validates answers/writes server-selected snapshots; booking media metadata/signed uploads now server-owned. Service-level definitions can now be authored in the admin form builder; client form-version cache is in place. Admin catalogue CRUD now authors categories/services with images; the API drops services whose category is hidden from `/catalogue`, `/services/:slug`, `/services/:slug/form` and `POST /bookings`. Remaining: definition migration when answers reference removed fields. |
| D3 | Admin catalogue CRUD (categories + services) | 🟨 | Admin Web | New `admin-web/src/pages/Catalogue.tsx` + `lib/catalogue.ts`: category tree (parent/nest, display order, collapse), services table with search/visibility filters, category and service editors (name, slug, description, image, parent, pricing mode, price/rate, duration, skill, popular rank, tag, active toggle), image upload to the public `service-icons` bucket. Deactivation is the delete; no hard delete in the UI. CRUD path verified through the same REST/RLS surface the page uses as `admin@gabfix.ug` (category create/update + service create/update + public catalogue read + `service-icons` upload/read/delete). Page now browser-verified in headless Chrome as `admin@gabfix.ug`: category create, service create in that category, inline visibility toggle, search filter, and drag reorder persisted `display_order` and re-rendered the tree. The browser pass also found and fixed a shared-modal defect (`.page` has an entrance-animation transform, so the fixed backdrop sized to the page; `Modal` is now portalled to `document.body`) plus wrapping price cells. Changing a service's pricing mode now warns before it lands (`Save anyway` in the footer, `.form-warning` text) and states that past bookings keep their recorded price and mode; browser-verified that the warning blocks the first save and that cancelling leaves the row unchanged. Remaining: services have no order column so only categories reorder (services stay by name/`popular_rank`). |
| D2 | Admin form builder and version history | 🟨 | Admin Web | `admin-web/src/pages/Forms.tsx` + `components/FormBuilder.tsx`: category/service picker, section/field palette (9 field types), reorder, required toggle, option minutes/quote flags, conditional rules, disabled mobile preview, `validateSchema` gate, publish-as-new-version (retire-then-insert), version history with restore-as-new-version. Publish path verified through REST as admin (v1 retired → v2 served by `GET /services/:slug/form` → restored); no in-browser click-through yet. Remaining: service-specific definitions authored by the business, answer migration on field removal. |
| E1 | Booking state machine and history | 🟨 | Backend + apps | Add exhaustive transition tests |
| E2 | Quotes and optional inspections | 🟨 | Backend + admin + ERP | Quote requests now reach the desk from every path: migration `20261125200000_quote_request_pipeline.sql` adds an after-insert trigger on `bookings` that opens the `quotes` row (`status='requested'`, `requested_by`) whenever a booking lands as `requested`, with a backfill for existing ones (probe booking confirmed the trigger; `GBX-457691` gained its row). Client side: the custom request form now submits through `POST /bookings` (`lib/api/quotes.ts` `submitQuoteRequest`, details/property/size/frequency folded into the notes the desk reads), `lib/api/quotes.ts` `fetchMyQuotes` reads `GET /quotes` (which now also returns booking reference, scheduled slot and service name), `store/quotes.ts` gained a server list + `syncQuoteRequests()` refreshed on the Bookings tab and after a quote booking, and `components/booking/server-quote-card.tsx` renders it with the desk's status (Awaiting quote / Inspection needed / Quote ready / Accepted …). Quote bookings no longer enter Upcoming as a fake booking (D6). `POST /bookings` also stops applying lead time and capacity to hourly/quote requests — the desk confirms the slot while pricing. Console: `requested` already maps to the **Pending** chip in `lib/queries.ts` and the request is in the Quotes & inspections queue. **The customer, not the desk, decides on a priced quote** (2026-11-25, later): `POST /quotes/:id/respond` (customer-only, ownership-checked) accepts or declines a `quoted` quote; accepting writes `quotes.status='accepted'` + `responded_at`, sets `bookings.total_price` to the quoted amount, moves `requested`/`awaiting_confirmation` → `confirmed` with a `booking_status_history` row (“Customer accepted the quote.”) so the job joins the normal confirmed workflow, and replays idempotently. The desk's `Mark accepted` / `Mark declined` buttons and their `recordQuoteResponse` write are removed from `admin-web/src/pages/Quotes.tsx` — the console shows the outcome only. Client: `components/booking/server-quote-card.tsx` renders **Accept quote** / **Decline** (decline asks first) on a `quoted` request, adds the accepted order to Upcoming, and `store/quotes.ts` `syncQuoteRequests()` also graduates an accepted quote into a local upcoming booking when this device missed the tap; Bookings → Requests now renders server and legacy requests in one newest-first list (no separate header block), with accepted ones leaving the list. Verified through the API as `customer@gabfix.ug`: accept → quote `accepted`, booking `confirmed`, total 95,000 and the history row; replay 200, decline-after-accept 409 `quote_not_ready`, unknown quote 404, bad action 400; probe booking/quote deleted. Open: quote expiry job, a push when the desk sends the price. `admin-web/src/pages/Quotes.tsx` + `lib/quotes.ts` list open/quoted/closed quotes with booking, customer, service, amount, inspection state and age; detail modal sends a priced quote (`quoted` + expiry + `prepared_by`), opens an inspection (`required` + note), schedules it (`scheduled` + inspector + time) and records phone accept/decline. A submitted inspection now renders read-only in the quote (`Report submitted …`, notes, checklist chips with issues in red, measurements, recommended hours/crew) and the desk can no longer overwrite the technician's report — the old `updateInspectionNotes` editor and its write path are gone; submission itself is the `submit_inspection` RPC (F3). Browser-verified as admin against live tables (send 180,000 → inspection requested → scheduled with Daniel Cleaner) and, later, a technician-submitted report read back in the quote modal. Still open: customer-side accept/decline screens, quote expiry job. |
| E3 | Staff-created booking confirmation/cancellation | 🟨 | Backend + admin + ERP | `admin-web/src/pages/Approvals.tsx` + `lib/approvals.ts`: four KPIs (awaiting confirmation, cancellation requests, value to confirm, oldest waiting), search, a staff/sales bookings table with Confirm/Cancel and a cancellation-requests table with Approve/Decline, all through one decision modal (reason required for a cancel, optional note). Writes go through `confirm_booking`, `cancel_booking` and `decide_cancellation_request` (security definer, capability-checked) so `booking_status_history` keeps the trail; support stays read-only. Browser-verified as `admin@gabfix.ug`: confirmed a desk booking, cancelled another with a reason, approved one cancellation request and declined another — statuses, `cancel_reason`, request `status`/`decision_note` and three history rows all landed, and the queue emptied. The confirm dialog can dispatch in the same step: an optional technician picker calls `assign_technician` right after confirmation, with a partial-success message if only the assignment fails. Verified in the browser: GBX-APV1 confirmed with Daniel Cleaner chosen → booking `confirmed`, one `job_assignments` row (`lead`, `assigned`) and the history row. `assign_technician` is also idempotent now: it updates an existing `(booking, technician)` row (reviving a removed one) and hands the lead over cleanly instead of colliding with `job_assignments_booking_id_technician_id_key` / `job_assignments_one_lead`. |
| F1 | Technician job flow | 🟦 | ERP + backend | Browser verified; native acceptance pending |
| F2 | Offline sync and conflict handling | 🟨 | ERP + backend | Device network-loss/recovery tests |
| F3 | Inspection technician workflow | 🟨 | ERP + backend | New ERP `inspections` stack (`index` list split into To do / Reports sent, `[id]` capture screen) reading scoped RPCs `my_inspections()` and `inspection_detail(uuid)` — an inspector is not covered by `can_view_booking`, so the policy was not widened. The capture screen shows what the desk asked for, customer with tap-to-call, address, a five-item checklist (Fine/Issue toggles), findings, recommended hours/cleaners, and submits through `submit_inspection` which moves the quote to `inspected`; an already-submitted report renders read-only. Home shows an “Inspection visits · n waiting” card that opens the list. Web-build verified end-to-end as `tech1@gabfix.ug`: list (open + sent), detail, issue flag, notes/hours/crew, submit → inspection `submitted`, quote `inspected`, checklist JSON stored. Photos and video attach from the capture screen (`inspection-evidence.tsx` + `lib/inspection-media.ts`) into the private `inspection-media` bucket at `<inspection_id>/<file>` with an `inspection_media` row (`kind` photo or video; the video pill takes a library clip up to 90 s), and the quote report shows photos as signed-URL thumbnails and video as an inline player; measurements (floor area, rooms, ceiling height) are collected on the report and stored as label → value. Verified: the submitted report carried `{"Floor area (m²)":"68","Rooms":"4","Ceiling height (m)":"2.8"}` and the desk modal rendered the measures plus the photo; the upload/insert path was driven with the component's own calls as `tech1@` (storage 200, row inserted with `uploaded_by`, signed URL 200). Submitted reports stay locked: the desk records a correction as an `inspection_addenda` row (`Add an addendum` in the quote modal, capability-checked by the existing policy) instead of editing the inspector's words, and the ERP report shows them in a "From the desk" card. Verified: an addendum saved from the console (`author_id` = the admin profile) and rendered in both apps. Remaining: native device pass (neither picker can be driven headlessly). |
| G1 | Payments adapter and webhook | ⬜ | Backend | Fake gateway first; provider later |
| G2 | Cash handover/dispute full workflow | 🟨 | ERP + backend + admin | Technician `record_cash_handover` and the desk `confirm_cash_handover(p_technician, p_amount, p_note)` RPC (capability `confirm_cash`, stamps `confirmed_by`/`confirmed_at`) are in, and the console's "Mark remitted" goes through it: the earlier direct insert was refused by the `handovers insert` policy, which only covers the technician's own row. Verified: admin RPC inserts and technician call refused `42501`, console click moved the technician to `Settled / Remitted`. Open: dispute resolution and the full end-to-end role test |
| G3 | Job costs and commission | 🟨 | Admin + backend + ERP | `20261125201000_job_costs_commission.sql` adds `cost_status`, `job_costs.status/approved_by/approved_at/decision_note`, `technician_profiles.commission_rate` (default 40%), capability `approve_job_costs` for manager+admin, and three security-definer RPCs: `add_job_cost` (entry stays admin-only), `decide_job_cost` (approve/reject with note) and `job_cost_overview` (per job: revenue, approved costs, pending count, crew, lead rate, commission, margin, `commission_ready` = completed + no submitted costs + a lead exists). `20261125203000_job_cost_lines.sql` adds `job_cost_lines` for per-line history. New console page `admin-web/src/pages/Costs.tsx` + `lib/costs.ts`: four KPIs (costs to approve, jobs with open costs, commission payable, costs recorded), a decision queue with approve/reject modal, a job table with revenue/costs/commission/margin/status, an admin "Add cost" row and a full cost history. Browser-verified in headless Chrome (realtime row, approve through the modal). Verified through the RLS surface the page uses as `admin@gabfix.ug`: cost added (`submitted`) → overview showed pending 1 and commission held → approved with note → overview costs 15,000, margin 12,000, pending 0 on that line, `job_cost_lines` named the approver; probe rows deleted. Two SQL defects found this way and fixed: `max(uuid)` in the crew aggregate and a text→`cost_status` cast in `decide_job_cost`. Open: technician commission payout screen, ERP entry screen using the same RPC. |
| H1 | Laundry operator workspace | ⬜ | ERP + backend | Orders, machines, shop cash |
| I1 | Support queue, tickets and booking chat | 🟨 | Client + admin + ERP + backend | New console inbox `admin-web/src/pages/Support.tsx` + `lib/support.ts`: conversation list (customer, last message, status, category, reference, unread flag) newest first, thread panel with sender-aware bubbles, reply composer that writes `support_messages` and moves the thread to `waiting_on_customer`, plus Mark resolved / Reopen / Waiting on customer and a staff read timestamp. Uses the existing `is_desk()` RLS (no policy change). Verified with the page's own calls as `admin@gabfix.ug` against a probe thread: queue listed it, thread read, reply inserted, status moved to `waiting_on_customer`; probe conversation deleted (cascade). Open: notifications to the app on a desk reply, support-only assignment, ticket escalation. |
| J1 | Push notification delivery | 🟨 | Backend + mobile | `20261125204000_quote_expiry_and_push.sql` adds `queue_expo_push()` + a `quotes` trigger: sending a price (or expiring one) inserts the in-app notification and queues an Expo push to every registered `device_tokens` row through `pg_net`. `POST /device-tokens` registers a handset (reassigning the token when the device changes account) and the client calls it after sign-in when permission is granted. Verified locally: trigger wrote the notification, `pg_net` reached `exp.host` (200; fake token rejected) and the route answered 201/400/401. Real delivery to a phone still needs an EAS build/device token. |
| K1 | Promo/referral server workflows | ⬜ | Backend + admin + client | Eligibility, redemption and payout |
| K2 | Recurring plans and visit scheduler | 🟨 | Backend + client + admin | D16 confirmed; verify scheduler and visit idempotency |
| L1 | Guest links, receipt and feedback | 🟨 | Backend + client + admin | D15 confirmed; build public guest page and PDF parity |
| M1 | Reports and invoices | 🟨 | Admin + backend | D17 says first release; verify calculations |
| M2 | Audit log UI and export | ⬜ | Admin + backend | Append-only source exists; complete UI |
| Z1 | Full device/browser/security release pass | ⬜ | QA + all leads | Evidence-based sign-off |

*The tracker is a working baseline, not a substitute for the per-app checklists. If a per-app checklist has a more precise status or newer evidence, update both records together.*

### 11.5 Client API route map (recorded 2026-11-25)

> **Edit required: Enhance.** Keep this map current as routes are added; it is the B1 gap map used to pick the next backend batch.

| Client call (`client-app/src/lib/api/`) | Hono route | Tables / RPC | Access / RLS | Status |
|---|---|---|---|---|
| `auth.login` | `POST /auth/login` | Supabase Auth, profiles | anon; email or `07` phone identifier | ✅ Local contract test |
| `auth.register` | `POST /auth/register` | Auth + profiles trigger | anon; phone-first accounts get `<phone>@phone.gabfix.ug` | ✅ Local contract test (201, duplicate 409) |
| `auth.requestOtp` / `auth.verifyOtp` | `POST /auth/otp/request`, `/auth/otp/verify` | `phone_otp_codes`, Auth magic-link verify | anon; hashed code, 10 min, 5 tries, 60 s resend; **no SMS delivery yet (D12)** — the local stack echoes `debugCode` | ✅ Local contract test (log/echo → session, replay 400) |
| `auth.refreshSession` | `POST /auth/refresh` | Supabase Auth | anon | ✅ Local contract test |
| `discovery.getServiceCategories` | `GET /service-categories` | categories | public (service role) | ✅ Local smoke |
| `discovery.getServices` | `GET /services` | services + categories + form defs | public | ✅ Local smoke |
| `discovery.getService` | `GET /services/:slug` | services, categories, service_form_definitions | public | ✅ Local smoke |
| `forms.loadFormDefinition` (new) | `GET /services/:slug/form` | service_form_definitions (service-level, else category-level) | public | ✅ Local contract test; client caches per service for 24 h |
| `discovery.searchServices` | `GET /search?q=` | services (in-memory filter) | public | ✅ Local smoke |
| `availability.getAvailability` | `GET /availability?service=&date=` | services, technician_profiles/skills/availability/overrides, job_assignments+bookings | public | ✅ Local smoke (subtraction verified) |
| `bookings.createBooking` | `POST /bookings` | bookings, booking_items, booking_form_snapshots, booking_media, idempotency_keys, services | customer JWT; capacity/lead/form checks; negotiated `form.definitionId` must still be current (409 `form_version_stale`) | ✅ Local contract test |
| `bookings` list/detail (screens call directly) | `GET /bookings`, `GET /bookings/:id` | bookings, items, snapshots, addresses, assignments | caller JWT via RLS | ✅ Local smoke |
| `media-upload` complete | `POST /bookings/:id/media/:mediaId/complete` | booking_media, storage.objects | owner/desk | ✅ Local smoke (uploaded object verified) |
| `media-upload` target (new) | `POST /bookings/:id/media/targets` | booking_media, storage signed upload | owner/desk; ≤10 items, 25 MB, 30 s video | ✅ Local smoke |
| `media-upload` refresh (new) | `POST /bookings/:id/media/:mediaId/refresh` | booking_media, storage signed upload | owner/desk; 409 once uploaded | ✅ Local smoke |
| `media-upload` delete (new) | `DELETE /bookings/:id/media/:mediaId` | booking_media, storage.objects | owner/desk | ✅ Local smoke |
| `tracking.getLiveTracking` | `GET /bookings/:id/tracking` | — (D21 open) | — | 🚫 Blocked on D21 |
| Quotes read (`quotes` screens) | `GET /quotes` | quotes, inspections | caller JWT; booking customer + desk only | ✅ Local contract test |
| Support conversation/messages | `GET /support/conversation`, `POST /support/messages` | support_conversations, support_messages | caller JWT; one conversation per customer (D13), other customers see nothing | ✅ Local contract test |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` | notifications | caller JWT; own rows only | ✅ Local contract test |
| Payments / wallet / receipts | — | payments, saved_wallet_numbers, receipts | — | ⬜ No client route yet |
| Security / sessions / devices | — | login_events, device_tokens | — | ⬜ No client route yet |
| Referrals / reviews | — | referrals, reviews | — | ⬜ No client route yet |
| Push token lifecycle | — | device_tokens | — | ⬜ No client route yet |

**Readings:** every public catalogue/availability path, the auth batch and the customer booking write path are covered by the Hono function; tracking, payments, wallet/receipts, security, referrals, reviews and push remain the open batches (payments/receipts next, then the rest). Automated contract/RLS coverage lives in `backend/tests/api-contract.test.mjs` (`cd backend && npm test`).

### 11.4 Session log

> **Edit required: Enhance.** Append a dated record after each implementation session, including files changed, tests run, outcomes and blockers.


| Date | Session / change | Progress movement | Evidence / notes |
|---|---|---|---|
| 2026-11-24 | Architecture and repository baseline reviewed | Baseline established for this plan | Separate current architecture upload: 20/25 decisions; repository progress and checklists inspected |
| 2026-11-24 | Client catalogue cutover + availability route (local) | D1/B1 moved forward; availability route added | `backend/supabase/functions/api/index.ts` gained `GET /availability` (public, 07:00–16:00 grid, 3-hour same-day lead, technician windows/overrides/booked-time subtraction). Client added `useService`/`useServiceCategories` and API-backed reads in Services/Home/service landing/booking steps with bundled fallback. `client-app`: `tsc --noEmit`, `eslint`, `jest --runInBand` (15 suites/112 tests), `check:style` pass. Local smoke: `/availability` returns slots for future date, Sunday/past empty, bad date/missing service 400. Docs updated: `gabfix-eco-progress.md`, `client-app/Phase_2_Unified_Implementation_Checklist.md`. No device/staging verification; booking creation does not yet enforce availability; seeded booking subtraction still needs explicit verification. |
| 2026-11-24 | Next-session plan created (this session) | Planning only; no implementation evidence | Plan recorded in §13 and communicated in session response. Aligned to Workstreams B/D/E/F and §9 dependencies; authoritative precedence retained per §0/§14. |
| 2026-11-25 (form-builder session) | Admin booking-form builder + version history; audit-log FK fix; quotes/support/notifications contract tests | D2 ⬜→🟨, D1 evidence, B3 coverage | New admin `Booking forms` page (`admin-web/src/pages/Forms.tsx`, `components/FormBuilder.tsx`, `lib/forms.ts`): category/service list with live version chips, editor for heading/media rules/sections/fields, all nine field types, reorder, required toggle, option minutes + quote flag, conditional `showIf` rules, `validateSchema` gate and a disabled mobile preview. Publishing retires the current row and inserts `version + 1` (restore does the same from history). Verified through the local REST/API path as `admin@gabfix.ug`: v2 insert 201 while v1 retired, `GET /services/home-clean/form` served v2, then v1 restored — no in-browser click-through. Migration `20261125160000_audit_log_actor_null.sql` drops the `audit_log.actor_id` FK so profile/account deletion is no longer blocked by append-only audit rows (`on delete set null` cannot work because the cascade is an UPDATE). Contract suite grew to 12 tests: support (one conversation per customer D13, empty message 400, cross-customer thread isolation), quotes (customer + desk read, other customer does not), notifications (owner read/mark-read, another customer's mark-read changes nothing); fixtures cleaned, `db reset` clean through 14 migrations, admin-web `tsc -b` and `vite build` pass. No device/browser verification, no SMS delivery. |
| 2026-11-25 (later session) | Client media cutover, auth routes, automated contract/RLS tests, P1 form negotiation | B1/B2/B3/D1/P1/W3/W10 moved forward locally | Client `media-upload.ts` now consumes `POST /bookings` upload targets (cache per booking), PUTs to the signed URL, calls `/complete`, and refreshes an expired/failed link via `/media/:id/refresh`; `review.tsx` remembers targets; `tsc --noEmit` pass. New Hono auth batch: `/auth/login` (email or 07 phone), `/auth/register` (phone-first `<phone>@phone.gabfix.ug`), `/auth/otp/request` + `/auth/otp/verify` (migration `20261125140000_auth_otp.sql`, `phone_otp_codes`, SHA-256 peppered hash, 10 min, 5 tries, 60 s throttle; local stack echoes `debugCode` because no SMS provider, D12), `/auth/refresh`. New `GET /services/:slug/form` (service-level definition, else category) and `POST /bookings` now honours `form.definitionId`, rejecting a non-current id with 409 `form_version_stale` and snapshotting the negotiated definition. Client `src/lib/api/forms.ts` caches the definition per service for 24 h, `scope.tsx` registers the server schema and records `formDefinitionId`, `createBooking` sends it. `db reset` clean through 13 migrations. Automated `backend/tests/api-contract.test.mjs` (node:test, `cd backend && npm test`): 9/9 pass covering auth login/register/OTP/refresh, media validation, signed upload→complete→refresh(409)→delete, cross-customer RLS, receipts RLS and form negotiation; fixtures cleaned. Client connectivity: dev builds now rewrite loopback API URLs to the Expo dev host and the network error names the failing URL; `.env.example` added. No device/staging verification, no SMS delivery. |
| 2026-11-25 | Booking media contract + receipts desk-issue RLS fix | B1/B2/B3/D1/W3/W6 moved forward locally | Added `20261125120000_booking_media.sql` (`booking_media` table + RLS + audit trigger; receipts desk-issue policy now allows desk to issue to the booking's customer). Hono `api` gained `POST /bookings/:id/media/targets`, `/complete`, `/refresh`, `DELETE /bookings/:id/media/:mediaId`; `POST /bookings` returns `uploads` for supplied media and rejects >10 items, >25 MB, >30 s video, unsupported mime. Storage origin override `STORAGE_PUBLIC_URL` (local `kong:8000` rewritten to `127.0.0.1:54321`). `db reset` clean through the new migration. Smoke: upload PUT 200 → complete 200 uploaded → refresh 409 → delete 200; 11 items/oversized video/long video/bad mime 400; receipts desk 201, customer 403, wrong `issued_to` 403. Types regenerated for `admin-web`/`erp-app`; admin `queries.ts` null-booking-id guard added; both `tsc --noEmit` pass. Smoke rows/objects/receipts cleaned. No device/staging verification. |
| 2026-11-24 | Availability subtraction verified; booking create hardened; form definitions seeded/validated | B1/B3/D1/E1 moved forward locally | Verified `GET /availability` subtraction with temporary assigned booking (10:00–12:00 Kampala blocked 09:00/10:00/11:00, surrounding slots free; temp rows cleaned). Added server-side `POST /bookings` lead-time/capacity checks after idempotency replay lookup (`availableTechnicianCount`, Kampala-aware `LEAD_HOURS=3`); smoke: 201 for free slot, 201 replay same idempotency key/booking id, 409 for under-3-hour lead, 409 for occupied slot, 201 for different free slot; temp bookings cleaned. Seeded 7 category `service_form_definitions` from client schemas via `seed.sql`/`db reset`; booking create now validates answers against stored current definition and writes server-selected snapshot; smoke: unknown field 400, missing required 400, valid booking 201 with `booking_form_snapshots` row, temp booking/idempotency keys cleaned. Client schedule already wired to live availability (inspection only). Focused check: `client-app` `npx tsc --noEmit` pass. No device/staging verification. |
| 2026-11-25 (catalogue session) | Admin catalogue CRUD + category-hiding enforcement | D3 added (🟨), D1 evidence, W2 admin/backend lines | New `admin-web/src/pages/Catalogue.tsx` and `lib/catalogue.ts`: category tree with parent nesting, display order, collapse and per-category service counts; services table with search and live/hidden filters; category and service editors (name, slug, description, image, parent, pricing mode segmented control, price/hourly rate, duration, required skill, popular rank, tag, active toggle); image upload to the public `service-icons` bucket through the existing `manage_catalogue` storage policy. Deactivation is the only removal path. `GET /catalogue` now also drops services whose category is inactive, `/services/:slug` and `/services/:slug/form` return 404 for them, and `POST /bookings` rejects a booking that includes one. Verified: `admin-web` `tsc -b` and `vite build` pass; `backend` suite 12/12; category create/update → service create/update → public catalogue visibility → cleanup driven through REST as `admin@gabfix.ug`; `service-icons` upload/public read/delete 200; hiding `outdoor` removed its 2 services from `/catalogue` and 404'd `/services/pavers-laying`, then restored. No in-browser click-through of the new page. |
| 2026-11-25 (evidence, addenda, desk fixes) | Inspection video + addenda, crew column, cash-handover and assignment fixes | F3, E3, G2 | Inspection evidence now covers video (`inspection-evidence.tsx` is the renamed photos card with a library video pill capped at 90 s; `inspection-media.ts` picks the extension/mime, `kind='video'` reaches the desk, and the quote report plays it inline). Submitted reports stay locked: `inspection_addenda` is read into the queue, the quote modal shows the history and a composer for admin/operations, and the ERP report renders a "From the desk" card. The Bookings table now lists the full crew (lead plus helpers) and the active inspection's state, so dispatch results are visible without opening a quote. Two defects found while testing: the desk's remittance insert was refused by the `handovers insert` policy (now `confirm_cash_handover`, capability-checked, verified admin-ok/technician-refused through the UI and REST) and `assign_technician` collided with the `(booking, technician)` unique key and one-lead index (now idempotent, verified repeat, lead swap and revival through the console and RPC). Verified in headless Chrome: ERP report shows `1 photo · 1 video` with a video tile and the desk addendum; console shows `+ Moses Electric` and `Inspection report in · 04 Dec`; addendum toast; cash row `Settled / Remitted`. `admin-web` `tsc -b` passes and `erp-app` `tsc --noEmit` passes. No native pass for the pickers; dispute resolution still open. |
| 2026-11-25 (inspection evidence + dispatch) | Inspection photos and measurements, dispatch from the approvals dialog | F3 evidence; E3 evidence | `erp-app/src/lib/inspection-photos.ts` + `components/inspection-photos.tsx` upload camera/library photos to the private `inspection-media` bucket at `<inspection_id>/<file>`, write `inspection_media` rows (`kind='photo'`, `caption`, `uploaded_by`) and render signed-URL thumbnails; a failed row insert removes the uploaded object again. The capture screen also collects measurements (floor area, rooms, ceiling height) and submits them as label→value instead of `{}`, and renders the saved values when the report is read-only. The admin quote report now shows the photos as clickable thumbnails (`lib/quotes.ts` signs them in the same pass as the queue). `Approvals.tsx` gained an optional technician picker in the confirm dialog that calls `assign_technician` after `confirm_booking`, with a separate message if only the assignment fails. Verified in headless Chrome: the ERP capture screen shows the Photos card and measurement fields, a report submitted with 68 m² / 4 rooms / 2.8 m stored exactly that, the desk modal rendered the checklist chips, the measures and the photo, and confirming GBX-APV1 with Daniel Cleaner produced `confirmed` + a `lead`/`assigned` `job_assignments` row. `admin-web` `tsc -b` + `vite build` and `erp-app` `tsc --noEmit` pass; fixtures, probe rows and the probe object were deleted. No native pass, so the camera/library picker itself was not clicked. |
| 2026-11-25 (approvals + inspection capture) | Manager approvals queue, ERP inspection capture, pricing-change warning; booking-address 403 and ERP sign-in fixes | E3 ⬜→🟨, F3 ⬜→🟨, E2 evidence, D3 evidence | `admin-web/src/pages/Approvals.tsx` + `lib/approvals.ts` (KPIs, two queues, one decision modal) and three new security-definer RPCs in `20261125180000_desk_decisions.sql`: `confirm_booking`, `cancel_booking`, `decide_cancellation_request`, `submit_inspection`; `20261125181000_inspection_brief.sql` adds the inspector-scoped reads `my_inspections()` and `inspection_detail(uuid)` instead of widening `can_view_booking`. ERP gained `inspections/` (list + capture) and a home card; the desk's quote modal now shows a submitted report read-only (the overwriting editor is deleted). Catalogue warns before a pricing-mode change and saves only through `Save anyway`. Browser-verified in headless Chrome: Approvals (confirm, cancel with reason, approve and decline a cancellation request → statuses, `cancel_reason`, request decisions and three history rows), the pricing warning (`Save anyway` persists, Cancel leaves fixed/85,000), the read-only report, and the ERP web build as `tech1@gabfix.ug` (inspections list → capture → submit with an issue flag, 4 h/2 cleaners, quote → `inspected`; complete job on GBX-DUE1 → `completed`). Two user-reported defects found and fixed: `POST /bookings` rejected every device-local address id (`home`, `ntinda`, `addr-…`) with 403 and the client hid the server message, so booking failed with “You don't have access to that.” — the API now accepts an owned `addresses` row or saves what the customer typed (reusing an identical one), and `lib/api/client.ts` surfaces `error.message`/`error.code`; the ERP sign-in no longer disables its fields while a request is in flight, times out after 20 s with a message, and has a show/hide password toggle, and completing a job now confirms and returns to the job list. Checks: `admin-web` `tsc -b` + `vite build`, `erp-app` and `client-app` `tsc --noEmit`, one web export of the ERP app. No native device pass, no SMS/payments. |
| 2026-11-25 (console browser pass + realtime defect) | Costs and Support driven in headless Chrome; live updates fixed | I1/G3 browser-verified; realtime bug fixed | Headless Chrome as `admin@gabfix.ug` against the dev server: the live pill renders `live-pill live-live :: Live`; **Job costs** shows the four KPIs, the decision queue and the margin/commission table, picked up a cost inserted from another session through realtime (~3 s, no Reload), opened the approve modal and approved it (the DB row moved to `approved`); **Support** listed the probe thread with the unread count, opened the thread and inserted a reply from the composer (`support_messages` gained “probe reply from the desk”, thread moved to `waiting_on_customer`); **Quotes & inspections** renders with the desk's Mark accepted/declined buttons gone. One real defect found and fixed: `lib/live.ts` now uses a unique channel topic per subscription — the fixed topic `console-operations` could be handed back by `supabase.channel()` while the previous channel was still leaving (React 19 double-mounts effects in dev), which yields `SUBSCRIBED` with no events at all, i.e. a pill reading “Live” that never updates. After the fix an in-page channel and the app's own subscription both received `INSERT` events. `admin-web` `tsc -b` + `vite build` pass; probe cost rows, probe conversation and the temporary scripts/profile were removed. |
| 2026-11-25 (customer decides on quotes) | Quote accept/decline moved to the customer; accepted quotes become confirmed bookings; one Requests list | E2 advanced; desk-side decision removed | New `POST /quotes/:id/respond` in `backend/supabase/functions/api/index.ts` (customer-only and ownership-checked, calls the admin client because `quotes update manager` stays staff-only): accept/decline, with accept writing `responded_at`, copying `quoted_amount` into `bookings.total_price`, moving `requested`/`awaiting_confirmation` → `confirmed` and inserting the `booking_status_history` row; idempotent replay, 409 for a quote that is not `quoted`, 404 for another customer's quote. `GET /quotes` enrichment extended with `bookingTotal`, `bookingAddress`, `serviceSlug` so an accepted order can be rebuilt locally. Client `lib/api/quotes.ts` gained `respondToQuote`; `components/booking/server-quote-card.tsx` shows Accept/Decline on `quoted` and adds the accepted order to Upcoming; `store/quotes.ts` graduates accepted quotes into local upcoming bookings on sync; `app/(tabs)/bookings.tsx` renders server + legacy requests in one newest-first list and hides accepted ones. `admin-web/src/pages/Quotes.tsx` lost the desk's Mark accepted/declined buttons and the `recordQuoteResponse` import, so the console only reports the customer's answer. Checks: `client-app` `tsc --noEmit` clean, `jest` 15 suites / 112 tests pass; `admin-web` `tsc -b` and `vite build` pass. API verified as `customer@gabfix.ug` (accept → accepted/confirmed/95,000 + history, replay 200, decline-after-accept 409, unknown 404, bad action 400); probe booking and quote deleted. Not clicked through in the app or browser. |
| 2026-11-25 (quote pipeline, costs, support, realtime) | Server-backed quote requests; job costs/commission; support inbox; live console; mock assignment off; catalogue refresh | E2/G3/I1/B1 advanced; D6 client behaviour fixed | Migrations (applied with `psql -f`): `20261125200000_quote_request_pipeline.sql` (trigger on `bookings` insert → `quotes` row `requested` with `requested_by`, plus backfill), `20261125201000_job_costs_commission.sql` (`cost_status`, cost decision columns, `commission_rate`, `approve_job_costs`, `add_job_cost`, `decide_job_cost`, `job_cost_overview`), `20261125202000_realtime_publication.sql` (12 operational tables in `supabase_realtime`, `replica identity full`), `20261125203000_job_cost_lines.sql` (per-line cost history). Client: `lib/api/quotes.ts` (`fetchMyQuotes`, `submitQuoteRequest`), `store/quotes.ts` server list + `syncQuoteRequests`, `components/booking/server-quote-card.tsx`, Bookings → Requests merges desk state, `quote/[slug]` submits to the server (device fallback only when no API is configured), `confirmed.tsx` no longer files a quote request under Upcoming, `config/mock.ts` assignment/completion switches **off** (the client no longer invents crews or completions the desk never sees), and `useServices`/`useServiceCategories` now re-read on focus so a category or service added in the console appears without an app restart. Console: `lib/live.ts` + topbar live pill (Postgres changes → debounced reload; `QuotesPage`/`ApprovalsPage`/`SupportPage`/`CostsPage` take `refreshKey`), `pages/Costs.tsx` + `lib/costs.ts`, `pages/Support.tsx` + `lib/support.ts`, `support`/`costs` added to `PageId`, sidebar, titles, topbar labels and `canViewPage` (support role sees Support), new `messages` icon, CSS for the pill, inbox and inline cost form. Checks: `client-app` `tsc --noEmit` and `jest` 15 suites / 112 tests pass (assignment suite now enables the simulation explicitly; the stale `client.ts` network-message assertion corrected); `admin-web` `tsc -b` + `vite build` pass; types regenerated from the local stack. Verified through the same RLS/RPC surface the pages use as `admin@gabfix.ug`: `/quotes` returns reference/service/slot, cost add → overview → approve → history, support queue → thread → reply → status, and two realtime-shaped defects fixed (`max(uuid)` in `job_cost_overview`, text→`cost_status` cast in `decide_job_cost`). No in-browser click-through of the new pages, no device pass; pending quotes still need the desk to open Quotes & inspections. |
| 2026-11-25 (quotes + browser pass) | Admin quotes/inspections queue; catalogue browser verification; modal portal fix; category drag reorder | E2 evidence; D3 browser-verified; Admin Web checklist item | New `admin-web/src/pages/Quotes.tsx` + `lib/quotes.ts`: KPIs (awaiting price, with the customer, inspections to book, accepted), open/quoted/closed filters and search over live `quotes` joined with bookings, customers, addresses and `booking_items`, detail modal that sends a priced quote (amount, coverage, expiry, `prepared_by`, `quoted_at`, status `quoted`), requests an inspection (`required` + note), schedules it (`scheduled` + inspector + `datetime`), saves submitted-inspector notes and records phone accept/decline. Writes rely on the existing manager/admin RLS; support stays read-only. Catalogue page driven in headless Chrome as `admin@gabfix.ug`: created a category, created a service in it, toggled visibility, filtered by search, and dragged “Building and finishing” above “Upholstery and carpets” (DB `display_order` 10–70 changed and the tree re-rendered; restored afterwards). Two defects found and fixed: the shared `Modal` now uses `createPortal(..., document.body)` because `.page` carries an animation transform that made the fixed backdrop page-sized and pushed tall editors off-screen; `.price-cell` no longer wraps “UGX 45,000/hr”. Verified `admin-web` `tsc -b` and `vite build`; quote flow end-to-end in the browser (180,000 sent → inspection requested → scheduled) with no console/HTTP errors; all quote, inspection and temporary booking-item fixtures deleted. No device/staging verification. |
| 2026-11-26 (assignment refresh + custom part-payment) | Dispatch's cleaner reaches an already-open client booking; post-confirmation payments accept a typed amount | B1 evidence, E5 refined | `GBX-6D117E` (Prhyme Manuel, `confirmed`) has a `job_assignments` row for `Moses Electric` as `lead`/`assigned`; `GET /bookings` as that customer returns the crew and RLS exposes the assignment plus its `technician_profiles` row (the nested `profiles` embed stays hidden by `profiles read own or desk`, so the API falls back to `display_name`). The client only refreshed assignments on the Bookings tab, so a booking detail opened afterwards stayed stale; `client-app/src/app/booking/[id].tsx` now calls `syncBookingAssignments()` on mount. `PaymentMethodSheet` gained optional `editableAmount`/`maxAmount`: the customer types any amount from UGX 1 up to the balance due, defaulting to the 30 % deposit or the full balance, and `BalancePaymentSelection` carries the chosen amount. A full amount routes to `kind=balance`; a part-payment routes to `kind=deposit` and is recorded as `depositPayment`. `client-app` `tsc --noEmit` clean; pricing + wallet tests 22/22 pass. Not clicked through in a browser or on a device. |
| 2026-11-26 (app payments reach the ledger) | In-app checkout, deposit and balance payments are recorded server-side instead of only on the phone | E5 gap closed; B1 evidence | Found that no in-app payment was ever registered: `payBookingDeposit`/`payBookingBalance` only wrote AsyncStorage, the API had no payments route, and `admin-web` reads the real `payments` table — `GBX-6D117E` showed 0 payment rows after a deposit was paid in the app. New `POST /bookings/:id/payments` in `backend/supabase/functions/api/index.ts` resolves the booking by reference or UUID, re-checks the caller owns it (desk roles allowed), sums existing paid rows, rejects over-balance (400) and already-settled (409), maps digital methods to the `app` enum with `provider` keeping the exact method, honours `Idempotency-Key`, and writes with the service role because `payments insert` RLS excludes customers. Client `recordBookingPayment` in `lib/api/bookings.ts`; `app/payment/[id].tsx` now treats a checkout, deposit or balance payment as settled only after the row is recorded, and shows the failed state (booking hold / unchanged balance) otherwise. Verified against the local stack: 201 + one `payments` row, replay of the same key returns the same row and does not duplicate, 999,999 against a 70,000 balance → 400, probe booking deleted. `client-app` `tsc --noEmit` clean, pricing + wallet 22/22. Not clicked through in the app; payments made before this change remain local-only. |
| 2026-11-26 (payment ledger method + duplicate accounts) | The desk can tell how an in-app payment was made; signing up cannot quietly create a second profile for a number that already has one | B1 evidence, E5 refined | Drove the balance flow end to end in the Expo web build (headless Chrome, real `customer@gabfix.ug` session, seeded `GBX-DUE1`): booking detail → "Pay balance" → Visa card → approval, ending on “Balance paid. Receipt available.” with a real `payments` row (`20,000`, `app`, `visa_card`) and the booking settled at 90,000. That exposed a defect: the route wrote `key:<Idempotency-Key>` into `payments.provider`, and `admin-web` maps methods by regex on `provider`, so every in-app payment showed as “MTN MoMo”. `provider` now keeps the exact method and the retry key moves to `provider_reference` (replay lookup matches that column); verified with a probe booking — new row `provider = visa_card`, replay with the same key returned the same payment id — probe booking and payment deleted. Separately, `POST /auth/register` now rejects a number that already belongs to an active profile (409 `account_exists`, before `admin.auth.admin.createUser`), so a duplicate attempt no longer leaves an Auth user with no profile behind a generic 400. The schema already forced `07XXXXXXXX` (`profiles_phone_format`) and `UNIQUE (phone)`, so this guard is about the error and the orphan user, not a new constraint; the same person registering a *different* number and email stays undetectable until phone/email verification is enforced (D12). Backend 12/12 tests, `client-app` `tsc --noEmit` clean, no device pass. The pre-fix deposit on `GBX-6D117E` remains local-only. |
| 2026-11-26 | ERP release crash fix; quote expiry + push; accepted quote visibility and deposit payment | J1 ⬜→🟨, B1 evidence, E5 completed, ERP crash blocker removed | `erp-app/src/lib/env.ts` now reads `window.location` only on web (release build crashed with `Cannot read property 'hostname' of undefined`); `20261125204000_quote_expiry_and_push.sql` expires stale quotes every 15 min via `pg_cron` and notifies/pushes on quote send (verified: notification rows, expiry 1, `pg_net` 200 to Expo). API `GET /bookings`/`GET /quotes` enrich with assigned crew; client `syncBookingAssignments()` mirrors dispatch's cleaner into the saved booking and the booking detail shows the name. Booking detail's stub "Pay balance" now opens the real method sheet → `/payment/[id]` with deposit (30% floor) or full balance, writing `depositPayment`/`balancePayment`; wallet ledger shows the deposit row. Verified in the Expo web build: accepted a probe quote (booking `confirmed`, local booking had Daniel Cleaner), paid a UGX 75,000 deposit (paid 75,000, balance 175,000) and the ERP home query returns the confirmed booking for Daniel. Probe rows removed; client 112 tests, backend 12 tests, client/ERP `tsc` pass. No device build. |
| 2026-11-26 (admin deploy + duplicate accounts) | The `admin-web` production build stops depending on the mobile app's Expo tsconfig; the duplicate customer accounts become one | deployment unblocked; D12 evidence | Vercel failed the `admin-web` build with `failed to resolve "extends":"expo/tsconfig.base" in client-app/tsconfig.json`: esbuild walks up from each transformed file for a `tsconfig.json`, and the shared catalogue/rate-card sources sit under `client-app`, whose tsconfig extends the Expo base — a package present locally but not in the admin-only install. `admin-web/vite.config.ts` now sets `esbuild.tsconfigRaw` explicitly (target, `useDefineForClassFields`, `jsx: automatic`, `isolatedModules`), which stops esbuild reading any tsconfig; `npm run build` passes both normally and with `expo/tsconfig.base` renamed away, matching the deploy environment. Separately the two duplicate profiles were merged into `d9d7dc80…` (`prhymemanuel@gmail.com`), whose phone is now `0779740511`: 2 bookings, 2 addresses, 2 quotes and 2 idempotency keys moved across, the older Auth users (`manuelbagoole@`, `manuel_bagoole@`) and their profiles deleted, leaving one active profile for that person. `POST /bookings/:id/payments` re-checked afterwards with a probe booking (201, one row, `provider` = method, correct balance; probe rows deleted). `GBX-988A7A` still read 630,000 only in the app at that point: its 270,000 deposit predated the ledger route and had no `payments` row. |
| 2026-11-26 (ledger backfill + payment kind) | Both confirmed bookings settle in the desk ledger, and a partial balance payment is no longer labelled a deposit | money reconciliation; §10 payments | The two bookings had no `payments` rows at all, so the admin dashboard read `GBX-988A7A` as 900,000 outstanding while the app showed 630,000. Backfilled `GBX-988A7A` with a 270,000 MTN deposit and `GBX-6D117E` with a 750,000 Airtel payment (both `method = app`, exact provider in `provider`, `recorded_by` the customer, `provider_reference` a `backfill-2026-11-26-*` key); the ledger now reads 270,000 paid / 630,000 balance and 750,000 paid / settled. Separately the desk labelled any row smaller than the booking total "Deposit", which mislabels a part-payment of the balance. Migration `20261126120000_payment_kind.sql` adds a nullable `payments.kind` (`deposit` | `balance`); `POST /bookings/:id/payments` stores the kind the client already sends (and echoes it on an idempotent replay), and `admin-web` prefers the column, falling back to the amount comparison only for rows written before it. Verified with probe booking `GBX-KINDT` (100,000): a 30,000 deposit and a 30,000 balance payment stored `deposit` and `balance`; probe rows deleted. `admin-web` build passes; both generated `database.types.ts` files gained the column. `20261126130000_backfill_ledger_payments.sql` carries the two rows into any environment, keyed on the booking reference and skipping bookings that already have the backfill row (re-run locally: `INSERT 0 0`). |
| 2026-11-26 (instalments in the booking payment field) | The desk can see what was actually collected on a booking, instalment by instalment, and the total; the Payments KPIs reflect the ledger instead of fixed text | §10 payments; B1 evidence | `admin-web` `Booking.installments` is built in `loadConsoleData` from that booking's `paid` payment rows (oldest first) with kind, method, amount and date, so the Bookings payment cell lists every instalment and closes with a “Paid in total” line equal to `Booking.paid`; the CSV export gained an Installments column. The Payments page's deposit, outstanding-balance and refund cards now sum real rows (`UGX 8.42m / 68 transactions` was hardcoded), and retrying a failed payment keeps its instalment role instead of forcing “Deposit”. `npx tsc --noEmit` and `npm run build` pass. The Total field now carries its labels in the header — “Total”, a rule, then “Balance” in red — while each row shows the total amount, the same rule, and the balance in red a step smaller below it; “Paid in total” is green. A Payments button per booking opens a payment-history dialog (`BookingPaymentsDialog`) listing every row including failed and refunded attempts, with Total/Paid/Balance and a per-payment receipt CSV. The Overview revenue chart now scales to the collected money (nice 1/2/2.5/5 axis steps) instead of a fixed 7m axis, and its aria-label follows the data. Checked in the running dev build (headless Chrome, owner sign-in): 9 booking rows, `GBX-988A7A` reads Total 900,000 / Balance 630,000 / Paid in total 270,000, dialog and receipt button render, Payments KPIs read UGX 1.2m / 1.1m / 0 from the ledger, chart axes read 0–3m with peak 1.7m. |
| 2026-11-26 (wallet Pay balance accepts a typed amount) | A customer can pay part of a booking's balance from Payments and wallet, exactly as on the booking detail | E5 refined | The Balance due card's per-booking **Pay** opened `PaymentMethodSheet` with the full balance fixed, while the booking detail's Pay balance drawer already let the customer type an amount. `client-app/src/app/profile/payments.tsx` now passes `editableAmount` / `maxAmount` for a booking (the late-fee account balance stays whole, because `settleLateFees` clears the fees), and `onContinue` sends `selection.amount` instead of the balance the drawer opened with: a full amount routes to `kind=balance`, anything smaller to `kind=deposit` so the ledger records a part-payment. The processing screen gained `from=payments`, so a part-payment started here is titled “Pay balance”, returns to Payments with the paid banner and reopens the drawer on a failure instead of jumping to the booking. Verified in the Expo web build (headless Chrome, seeded local booking with UGX 90,000 due): the drawer showed an “Amount to pay” field prefilled 90,000 with “Balance due UGX 90,000”, typing 40,000 carried through the number step (“UGX 40,000 due”) to the processing screen (“We sent a prompt … for UGX 40,000”, title “Pay balance”), and backing out left the balance at 90,000. `tsc --noEmit` clean; the probe booking and the temporary scripts were removed. No device pass. |
| 2026-11-26 (clickable booking rows) | The desk can see a whole booking and assign its cleaner from one place, and the table stops competing for width | D3 evidence | Every row on `admin-web`'s Bookings table is now clickable (mouse, or Enter/Space with the row focused) and opens `components/BookingDetailsDialog.tsx`: customer and phone, service and hours, date/time, status and payment chips, inspection state, Total/Paid/Balance, the instalment list, the customer's job scope and media, and the crew currently on the job. The same dialog carries the cleaner picker (Available/Unavailable, current cleaner preselected) with an Assign/Reassign button that stays disabled until a different cleaner is chosen, and a Payments button that hands over to the existing payment-history dialog. The per-row Payments/Assign buttons and the empty Actions column are gone, freeing the table's width. Checked in the running dev build (headless Chrome, owner sign-in): all 9 rows clickable, no row actions left, clicking `GBX-988A7A` opened its dialog (900,000 / 540,000 / 360,000 with three deposits and Job scope), the Assign button read disabled until a picker change, and Payments opened the receipt dialog. `tsc --noEmit` and `npm run build` pass. |
| 2026-11-26 (cleaner's cash reaches the customer dashboard) | Cash the customer hands the cleaner in person shows on the customer's own dashboard and wallet as money received, without the customer re-entering it | §10 payments; E5; B1 evidence | The ERP's “Record cash” wrote a `cash` `payments` row that only the desk could see: `GET /bookings` carried status and crew but no money, and the customer's wallet was built only from the device's local `paid`/`depositPayment`/`balancePayment`, so a completed job still showed its full balance due. `GET /bookings` now totals the caller's settled payments with the service role (customers cannot read `payments` under RLS) over the ids the caller already passed RLS for, returning `paidTotal`, `cashPaid` and `cashPaidAt`. `syncBookingsFromServer()` mirrors them: paid only ever rises, `balance` is re-derived from the local total, and a `cashPayment { amount, atISO }` is stored from the cleaner's own timestamp. The wallet renders that as `Cash · <service>` with “Cash · confirmed by cleaner”, the Home tab now syncs on focus so the balance-due card is current on the dashboard, and the old shortcut that marked every locally-cash booking confirmed was removed. Verified in the Expo web build as a signed-in customer: seeded `GBX-DONE` (45,000 total, 0 paid) and `GBX-DUE1` (90,000 total, 20,000 paid), opened Home, then Payments: both bookings read paid in full with 0 due, the wallet showed a confirmed 45,000 cash row and a confirmed 70,000 cash row plus the 20,000 digital residual, and those amounts match the local `payments` table. Jest 16/16 across the wallet and sync suites, `tsc --noEmit` clean, backend contract suite 12/12. No device pass. |
| 2026-11-26 (service image upload) | The desk can upload a service image from the catalogue instead of only a category image | D3 evidence; catalogue CRUD | In `admin-web/src/pages/Catalogue.tsx` the service editor rendered the **Upload image** button wired to `fileInput.current?.click()`, but the only `<input type="file">` in the tree belonged to the category editor, so the button did nothing (the rendered `.image-field-actions` for a service held just the button). The service editor now has its own hidden input with the same accept list, re-upload and reset behaviour. Checked in the running dev build with headless Chrome: the editor exposes one file input, choosing a PNG uploaded it to `service-icons` (`service/ac-blowing-<timestamp>.png`) and the preview rendered from the public bucket URL with the Remove action present; the probe object was deleted afterwards. `npm run build` passes. |
| 2026-11-26 (cleaner completion reaches the customer) | A job the cleaner finishes in the ERP leaves the customer's Upcoming tab without anyone pressing anything | B1 evidence, F1 | The client only mirrored dispatch's cleaner from `GET /bookings`; the server's booking status never reached the device, so completing a job in the ERP left the customer's copy `upcoming` until the mock completion switch fired. `syncBookingAssignments()` is now `syncBookingsFromServer()` in `client-app/src/store/bookings.ts`: it keeps the assignment sync and, for any matched server booking with `status = 'completed'`, routes the local `upcoming` booking through the existing `completeBooking()` path, so it moves to Completed with `completedAtISO`, the rating prompt and the recurring-plan seeding. The Bookings tab re-pulls on focus (`useFocusEffect`) instead of only on mount, and pull-to-refresh and the booking detail still sync. New `src/store/__tests__/sync-from-server.test.ts` mocks `fetchMyBookings` and covers: completed in the ERP → local completed (+ crew still applied), confirmed → still upcoming, an existing completion left untouched, and an unreachable API keeping the local copy. `tsc --noEmit` clean; 4/4 new tests pass. Not clicked through in the browser or on a device. |
| 2026-11-26 (password reveal + local sign-up) | Staff can check a typed password before signing in, and a customer can create an account again without an SMS provider | D3; B1 evidence; D12 | `admin-web`'s sign-in password field gained an eye / eye-off toggle (`components/Login.tsx` with new `eye`/`eyeOff` paths in `components/Icon.tsx` and `.password-field` / `.password-toggle` in `styles.css`), flipping the input type and exposing `aria-pressed` plus a Show/Hide password label. Customer sign-up was blocked because `client-app/.env.local` pointed at the deployed project, and only the local stack echoes the OTP `debugCode` (no SMS provider yet, D12); the file is back on `http://127.0.0.1:54321/functions/v1/api`, and `app/otp.tsx` now keeps the development code in state so **Resend code** refreshes the hint. Verified against the local stack: register returned 201, `POST /auth/otp/request` returned a 6-digit `debugCode`, `POST /auth/otp/verify` with it returned a session; the probe user and OTP rows were then deleted. `client-app` `tsc --noEmit` clean, `admin-web` `npm run build` passes, and the toggle's eye icon was screenshotted on the built login page (not clicked). Checked the linked production project as well: `supabase migration list --linked` reports all 25 migrations, including `20261126120000_payment_kind.sql` and `20261126130000_backfill_ledger_payments.sql`, already applied; the API function and `admin-web` were not redeployed. |
| 2026-11-26 (admin console theme) | The theme in `gabfix-admin-ui-optimization-plan.md` is applied across `admin-web`: token layer, 248/64px shell, 1440px frame, hero + overlapping KPI band on the five dashboard pages, drawers, split-screen sign-in and a sub-1024px notice | D3 evidence; admin UI matches the client theme | New `src/styles/tokens.css` (palette, type, spacing, radius, shadow, size, motion and z-index tokens plus legacy aliases) and `src/styles/theme.css` (shell, page frame, heroes, buttons/inputs/chips/KPI/table rhythm, drawer + confirm dialog, identity menu, sign-in split screen, ≤1279px rail, <1024px notice), imported around the mechanically tokenised `styles.css` (local `:root` palette removed, every font-size lifted to a 12px floor, radii snapped to 12/14/16/20, ~45 raw hex literals replaced). Shell and components: `PageHeader variant="hero"`, new `Drawer` (portal, Esc + Tab trap, panel focus) now used by the booking detail, payment history and assign-cleaner flows, a real cash badge and realtime status in the sidebar, a real identity menu with sign-out in the topbar, Settings showing the signed-in user, the Overview hero restructured so its KPI row overlaps, and the sign-in page rebuilt as the split screen with seeded account shortcuts kept dev-only. `npm run build` passes. Headless Chrome against the local stack as `admin@gabfix.ug`: Overview, Bookings, Payments, Cash, Reports, Costs, Settings, Approvals, Quotes, Support, Customers, Cleaners, Catalogue, Services, Forms, Promos and the booking drawer reviewed at 1440, plus Overview at 1280/1024 and the <1024 notice at 900; the Bookings amount column was clipped and the table padding was tightened to fit. Login reviewed from a production preview. No device pass, no deploy. |
| 2026-11-26 (admin layout nits) | The sidebar's full nav list and the seven-column catalogue table both fit without clipping at the plan's frame widths | D3 evidence; admin UI | Two leftovers from the theme pass. Sidebar: the six nav groups overflowed a short window, so `.nav` now has a visible thin scrollbar, a bottom fade and tighter padding, plus a `@media (max-height: 1000px) and (min-width: 1024px)` block (40px items, `--space-3` gaps) — every group is reachable at 1440×900 and the list still reaches Reports at 1440×1000. Catalogue: the services table needs 770px, but the 248px sidebar plus the 288px rail left it 595px between 1280 and 1429, so it scrolled inside its card; that band only (`catalogue-page` scope) now stacks `.forms-layout`, puts the Categories card and the “Deactivate” note side by side, and caps the category list at five rows with the same bottom fade. Measured in headless Chrome: `.table-scroll` 918/918 at 1280, 1004/1004 at 1366, 1067/1067 at 1429, 760/760 at 1430, 770/770 at 1440 and 801/801 at 1279 (the ≤1279 icon rail), with document width equal to the viewport throughout; screenshots reviewed at 1280 and 1366. `npm run build` passes. No device pass, no deploy. |
| 2026-11-26 (admin UI improvement checklist) | The remaining admin UI work is written down with priorities and measured evidence | D3 follow-up | `gabfix-admin-ui-improvement-checklist.md` records the post-theme backlog in eight sections (table fitting, catalogue rail density, CSS architecture, accessibility, states, performance, consistency, verification) with P0/P1/P2 marks and done-when criteria. It is grounded in a headless-Chrome overflow audit of all 16 pages at 1024/1280/1440: the page frame never overflows, but `.table-scroll` clips on Bookings (1029/918 at 1280), Payments (1108/1078 at 1440), Overview's Live bookings (777/734 at 1440), Job costs (931/918 at 1280), Cash (875/854) and Customers (873/854) at 1024, and Catalogue (750/546) at 1024–1279. P0s: the Payments and Overview tables overflow at 1440, scrollable tables have no `tabindex` so keyboard users cannot reach their content, and there is no skip link. No application code changed. |
| 2026-11-26 (admin P0 tables + keyboard access) | The Payments and Overview tables fit at the design widths, and a keyboard user can reach a clipped table and skip the nav | D3 evidence; admin UI | Overview's seven-column live table (777px in a 734px card at 1440, 574 at 1280) now carries the visit time in the booking sub-line and, between 1280 and 1360, `.overview-layout` stacks with the action rail as a three-up row — 734/734 at 1440, 918/918 at 1280, 854/854 at 1024. Payments' transactions table (1108/1078 at 1440) folds the booking reference under the transaction id: 1078/1078 at 1440, 994 at 1280/1024 (still a listed P1). All 17 `.table-scroll` regions gained `role="region"`, their table's name and `tabIndex={0}` with a 2px green focus ring; `App.tsx` adds a `.skip-link` that focuses `main#main-content` with `preventDefault` so `location.hash` (the router) is unchanged. Verified in headless Chrome with `Emulation.setFocusEmulationEnabled`: skip link on-screen when focused (top 12px) and lands on `MAIN#main-content` with `#/bookings` unchanged, scroll region focus shows `2px solid rgb(17,142,69)`, no document overflow at 1024/1280/1440. `npm run build` passes. No device pass, no deploy. |
| 2026-11-26 (admin tables + Playwright, client native modules) | The desk table reads cleanly at every supported width and the client app survives a runtime without optional native modules | Admin UI; client bootstrap | Bookings no longer prints the payment method per instalment (it stays in the payments drawer). Table gutters tighten below 1440 (7px) and below 1100 (5px), headers and the UUID reference may wrap, so Bookings, Payments, Job costs, Cash, Customers and the catalogue all measure `scrollWidth === clientWidth` at 1440, 1280 and 1024 (1078, 918, 854). Catalogue rail stacks up to 1429px and truncates category rows to two lines. Zebra rows use new `--row-alt`/`--row-hover` tokens; the document and sidebar-nav scrollbars are hidden. A 5-test Playwright suite (`admin-web/tests`, `channel: 'chrome'`) covers sign-in, nav routing, scroll-region naming/focus, the 1440 fit and the skip link — all pass. Client: `src/lib/native-module.ts` lazily requires `expo-notifications`/`expo-crypto` and returns null when absent, so a missing native module no longer crashes the root layout; push and id generation degrade. `tsc --noEmit` clean; admin `npm run build` passes. No device pass, no deploy. |
| 2026-11-26 (dashboard parity with production) | Localhost and production show the same dashboard from the same commit | Admin UI | The 1280–1360 `.overview-layout` stacking band was removed. It flipped the dashboard shape (rail beside the charts vs. rail as a three-up row below) for a browser at 1360 CSS px, so localhost and the Vercel build six pixels wider looked like different products while both were serving commit `c9f0ee2` — verified by matching prod's CSS bundle byte-for-byte (`index-BdcRuc8e.css`, including `--row-alt`) and finding this commit's `overview-main`/`overview-hero-title` markers in prod's JS. The rail now stays beside the charts from 1280 up: 704 + 320 at 1360 with the live table at 654/654, 660/660 at 1366, 918/918 at 1280 where the sidebar is collapsed. Between 1280 and 1335 that one table scrolls inside its named region by up to 64px. `npm run build` passes; 5/5 Playwright tests pass. No deploy. |

---

## 12. Risk register and mitigations

> **Edit required: Enhance.** Keep the risks visible and add owner, likelihood, impact, mitigation status and review date as delivery progresses.


| Risk | Impact | Mitigation |
|---|---|---|
| Architecture and older UI/Phase 2 documents conflict | Rework and inconsistent behaviour | Architecture wins; maintain the alignment checklist |
| Apps use different generated database types | Compile/runtime drift | Regenerate types independently after every schema change |
| RLS gaps hidden by front-end filtering | Customer/staff data exposure | Negative permission tests for every role and object |
| Mock data remains in some Admin Web pages | Staff may act on misleading data | Track each page as mock/live and visibly label development-only data |
| Device testing is deferred | Camera, push, keyboard, offline and native defects appear late | Reserve a device acceptance phase in every milestone |
| Payment/SMS provider not yet selected | Real payment/OTP cannot be completed | Keep provider adapters and fake implementations; do not hard-code provider assumptions |
| D18/D19/D21/D22/D23 remain open | Dependent modules may be built incorrectly | Decision gate before starting dependent implementation |
| Offline replay duplicates or reorders writes | Financial/job integrity issue | Idempotency keys, ordered queue, original timestamps and conflict tests |
| Financial calculations drift across screens | Incorrect commission/reports | Calculate on server and reconcile reports against source rows |
| Staff location collection creates privacy concerns | Unnecessary personal-data exposure | Do not implement GPS trail until D23 defines purpose, scope, access and retention |

---

## 13. Immediate next actions

> **Edit required: Optimize.** Prioritize the next actions against current repository state and dependencies; remove completed actions from the active queue but retain their evidence in progress.


### Next-session plan (planned 2026-11-24, updated 2026-11-24 after implementation)

This plan follows the authoritative architecture and §9 dependencies: stabilise the contract before broad client cutover (Workstream B), complete server-driven catalogue/form behaviour (D), and harden booking creation/dispatch rules (E/F).

| Priority | Work item | Workstream / refs | Status | Deliverable / evidence |
|---|---|---|---|---|
| P0 | **Verify and harden availability** | B, E, F; W0/W4 | ✅ Local smoke | Temporary assigned booking 10:00–12:00 Kampala blocked 09:00/10:00/11:00 on `GET /availability`; surrounding slots remained available; temp rows cleaned. Further skill/window/override cases still worth focused API tests when harness exists. |
| P0 | **Wire client schedule to live availability** | B, D, E; W2/W4 | ✅ Existing (verified by inspection) | `client-app/src/app/book/[slug]/schedule.tsx` uses `useAvailability(slug, selectedISO)` with API-backed `getAvailability` and local fallback; no code change needed this session. |
| P0 | **Enforce availability/capacity server-side on booking create** | B, E, F; W4 | ✅ Local smoke | `POST /bookings` checks 3-hour lead and `availableTechnicianCount` after idempotency replay lookup. Smoke: 201 free slot, 201 replay same key/id, 409 under-3-hour lead, 409 occupied slot, 201 different free slot. Temp rows cleaned. |
| P1 | **Seed and validate service form definitions** | D; W2/W3 | 🟨 In progress | 7 category definitions seeded; booking create validates against the stored definition and snapshots it. This session added `GET /services/:slug/form` (service-level first, then category), client `forms.ts` cache (24 h, stale cache survives offline), `scope.tsx` server-schema registration + `formDefinitionId` on the draft, and `POST /bookings` negotiation (409 `form_version_stale`). Contract test proves a valid id snapshots that definition and an unknown id is rejected. Remaining: admin form builder/version-history UI, service-specific definitions authored in admin, definition migration when answers reference removed fields. |
| P1 | **Media upload contract** | B, D; W3 | ✅ Local smoke + contract test | `booking_media` table + RLS; `POST /bookings/:id/media/targets` and `/complete`/`/refresh`/`DELETE` live; `POST /bookings` returns `uploads` and rejects >10 items / >25 MB / >30 s video / bad mime. Client `media-upload.ts` now uses the signed target, shows retries, and refreshes an expired link. Upload→complete→delete verified by the automated contract test; refresh after upload 409. Device upload not yet verified. |
| P1 | **Fix receipts desk-issue RLS** | G, M; W6 | ✅ Local smoke | Desk/admin/CR can insert a receipt for a booking; `issued_to` must match that booking's customer. Positive (201) and negative (customer 403, wrong customer 403) checked; no audit bypass introduced. |
| P2 | **Route-by-route backend gap map** | B; W0 | ✅ Recorded | §11.5 maps every client `src/lib/api/*` call to route, tables/RPC, access and test status. Next batches: auth, payments/wallet/receipts, security/sessions, referrals/reviews/push. |
| P2 | **Regenerate staff DB types + contract tests** | B; W0/W10 | ✅ Local automated suite | `admin-web`/`erp-app` types regenerated after `booking_media`; both `tsc --noEmit` pass. `backend/tests/api-contract.test.mjs` runs 9 tests (`cd backend && npm test`) over auth, media, booking, form negotiation, cross-customer RLS and receipts RLS; fixtures are removed in `after`. Broader route coverage (quotes/support/notifications/payments) still to add. |

**Session guardrails:** no device/EAS/store verification claims; no commits unless explicitly asked; do not weaken tests/RLS to pass; keep `Gabfix_Architecture_Implementation_Plan_with_Edit_Classifications.md` authoritative on conflicts; update §11 session log and affected progress docs before ending the session.

### Carried-forward actions (not next-session primary scope)

1. **Freeze the baseline:** record current Git state and run typecheck/lint/tests for all three apps plus a clean `supabase db reset`.
2. **Reconcile progress documents:** ensure `gabfix-eco-progress.md`, the setup checklist, ERP release checklist and this plan agree on the same date and status.
3. **Prioritise the technician vertical slice:** complete device verification for sign-in → assigned jobs → job detail → status progression → photos → offline sync → cash.
4. **Complete Admin Web real-data coverage:** prioritise booking detail/decision queues, service/form management, support, costs/commission and reports.
5. **Resolve open decisions in dependency order:** D19 and D22 where they affect data/admin scope; D21 before live-tracking completion; D23 before any staff GPS implementation; D18 before app-customer laundry work.
6. **Start the release evidence pack:** screenshots, device/build details, test logs, migration reset logs, RLS results and known limitations.

### First milestone to call complete

> **Edit required: Enhance.** Keep this as the first integrated acceptance milestone and add explicit pass evidence for each end-to-end step.


The next meaningful milestone should be a **verified end-to-end booking-to-job-to-payment slice**:

- Customer signs in and creates a booking from the server-driven catalogue.
- Server validates the dynamic form and creates the booking idempotently.
- Manager confirms/quotes/inspects as required.
- Dispatcher assigns an eligible technician and a lead.
- Technician receives the job, works through the checklist, captures photos and completes it (including offline recovery test).
- Payment rows and balance update correctly.
- Admin enters job costs and marks them complete.
- Commission becomes eligible only after the defined conditions.
- Customer receives the correct receipt and notification.
- All roles see only the data/actions allowed to them.

This vertical slice proves the core architecture more effectively than completing isolated screens.

---

## 14. Document maintenance rules

> **Edit required: Enhance.** Extend the maintenance rules so every section retains an edit classification and progress claims remain evidence-based.


- Update **§11 Progress Register** at the end of every implementation session that changes code or closes a decision.
- Record only evidence-backed status: file exists, typecheck passes, browser verified, local backend verified and physical device verified are different claims.
- When a feature is complete, record the exact test command, environment, device/browser and date.
- When a decision changes, update the architecture first, then this plan and the app-specific checklists.
- Preserve historical session rows; add a new row rather than overwriting the previous session.
- Keep visual tokens sourced from `client-app/src/theme/tokens.ts`; if the client theme changes, update Admin Web and ERP token copies in the same planned change.
- Do not mark a proposed provider, unresolved decision or future-release feature as confirmed.

**Source files used:** `Full_App_Architecture_2.md`, `gabfix-eco-progress.md`, `Technician_App_Setup_Checklist.md`, `erp-app/ERP_Release_Readiness_Checklist.md`, `client-app/Gabfix_UI_Progress.md`, `client-app/Gabfix_Implementation_Plan.md`, `client-app/Gabfix_App_Ui_2.md`, `client-app/Phase_2_Unified_Implementation_Checklist.md`, `client-app/Client_App_Ecosystem_Alignment.md`, and the uploaded repository source tree.
