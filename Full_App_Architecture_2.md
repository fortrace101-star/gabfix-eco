# Full App Architecture

## Progress (updated 2026-11-23, after Part 16)

**14 of 25 decisions made: 56%.** `██████░░░░`

Method: the 25 decisions are D1 to D23 from `Ecosystem_Gap_Analysis.md` plus D24 and D25, added later. Each counts equally, and a decision counts only once the owner has confirmed it. This block is recalculated after every write to this file.

**Decided (14):** D1 Hono entry point, D2 Expo push, D3 Sign-in, D4 Service forms, D5 Categories, D6 Pricing (with optional inspection), D7 One ERP app for everyone (settled by instruction), D8 Roles (called D7 in this file), D9 Booking stages and inspection, D10 Cash held by technicians, D13 Support conversations (not tickets or technician chat), D20 Who is told when a booking is made, D24 Store and inventory removed, job costs added, D25 Phone numbers, 07 only.

**Left (11):** D11 Late fees, tips, promos, referrals, D12 Payment gateway and SMS provider, D14 Deleting accounts, D15 Guest links, receipts, legal pages, D16 Recurring plans, D17 Which legacy features are in the first release, D18 Laundry for app customers, D19 Legacy data, D21 Live tracking, D22 Admin web, D23 Staff GPS trail.

**Still open inside decided areas:** travel time and the daily hours cap, the extra technician trades, the list of edge functions (to be revised after review), whether a fee applies after On the way (D11), which notifications are critical and skip quiet hours (D20), whether laundry shop cash needs its own handover (D10), and the payment provider (D12).

**Numbering:** this file calls roles D7, and the gap analysis calls them D8. The gap analysis D7 (one ERP app for everyone) was settled by the owner's instruction.

## 1. Overview

A cleaning and home services business with several applications sharing one backend:

- **Client app** (Expo / React Native): customers make bookings.
- **Internal ERP app** (Expo / React Native): used by all staff, including the desk-based roles, with screens shown by role. Covers jobs, laundry orders and the laundry shop's machines. There is no stock or inventory (D24).
- **Admin web app**: for the desk-based roles, which are admin, manager (who also covers dispatch) and customer relations. They use the same accounts as in the ERP app.
- **Backend**: Supabase (Postgres, auth, storage, realtime, edge functions). Push notifications go through the Expo push service. Firebase is needed only to supply Android push credentials (an FCM service account key uploaded to EAS).

All apps are clients of the same Supabase project. Information flows between them through the shared database. The client app reaches it through one Hono API function (D1); the admin web and the ERP app may also read directly through the Supabase library, with row level security in charge.

**Legacy ERP features:** the features of the legacy ERP (four web apps and an Express and Postgres server) are adapted into the admin web app and the ERP app, inside this architecture. Where the old system and this document disagree, this document wins. Work already done in the old system is brought over and adapted, not redesigned from nothing. The module-by-module map is in `Ecosystem_Gap_Analysis.md`. Dropped by D24: the legacy store, stock, purchasing and tool-checkout features.

## Technology Stack

Everything we have chosen, in one place, grouped by purpose.

| Area | Technology | Used for |
| --- | --- | --- |
| Mobile apps | Expo and React Native | Client app and ERP app. Development builds are required, since push notifications do not run in Expo Go. |
| Admin web app | Next.js or React with Vite | Desk-based roles. Still to be chosen between the two. |
| Database | Supabase Postgres | All data, with migrations as SQL files and row level security on every table. |
| Auto-generated API | Supabase client library for JavaScript | Direct reads, live updates and plain writes from the admin web app and the ERP app. The client app does not use it: it goes through the Hono entry point (D1). |
| Edge functions | Deno and TypeScript | Push notifications, webhooks, invite codes, payment confirmation. |
| Function routing | Hono | The client app's single entry point, one `api` function (D1). Other functions stay separate. |
| Authentication | Supabase Auth | Phone or email plus password for customers at launch. Phone code verification and Google sign-in follow later. Invite-code signup for staff. |
| Google sign-in on mobile (later) | Google Sign-In library for React Native | Not at launch. When added, it gets an ID token that is handed to Supabase. |
| SMS provider (later) | Twilio, MessageBird, Vonage or Textlocal | Sends the phone verification codes once added. Still to be chosen. |
| File storage | Supabase Storage | Job photos in private buckets, service icons in public ones. |
| Realtime | Supabase Realtime | Live updates for dispatchers and staff. |
| Scheduled jobs | Postgres cron | Reminders and housekeeping. |
| Push notifications | Expo push service and expo-notifications | Device tokens and delivery, sent from an edge function. Firebase only supplies Android credentials. |
| Local development | Docker Desktop, Node, Supabase CLI | The full local backend stack. |
| Firebase | A Firebase project for Android push credentials | Service account key uploaded to EAS. No Firebase library in the apps. |
| Draft and local state | Zustand with persist, on AsyncStorage | Booking drafts and the offline action queue. |
| Data caching | TanStack Query with persistence | Showing recent data without signal. |
| Connectivity | NetInfo | Detecting when to retry queued actions. |
| Deployment | Supabase CLI, later GitHub Actions | Manual pushes now, automation once a staging project exists. |
| Payments | Provider to be chosen | Webhook confirmed by an edge function. |

## 2. Repository Structure

One repository with self-contained folders. No workspaces, no shared packages, no Metro tweaks.

- `client-app/` own package file, own node\_modules, own Expo config.
- `erp-app/` same, fully independent.
- `admin-web/` own package file (Next.js or React with Vite).
- `backend/` holds the `supabase/` folder (config, migrations, seed, functions).

The only thing the apps share is the backend. If they need the same database types, generate them from the schema into each app instead of sharing code. The client app is copied in fresh from the existing repo, without Git history or node\_modules. The old repo is kept as an archive.

## 3. Local Development

**Tools:** Docker Desktop, Node, Supabase CLI. No Firebase tooling is needed locally.

**Workflow:**

1. In `backend/`, run `supabase init`, then `supabase start`. This boots Postgres, auth, storage and Studio locally. No cloud account is needed yet.
2. The terminal prints a local API URL and anon key. All apps use these in development.
3. Change the schema locally, capture changes as migration files (written by hand or generated with `supabase db diff`), test, and commit to Git.
4. Test data lives in the seed file, which runs only locally on database reset.

**Connecting apps to the local instance:**

- Web app: localhost works directly.
- iOS simulator: localhost works.
- Android emulator: use 10.0.2.2.
- Physical phones: use the computer's local network IP, on the same Wi-Fi.

### Supabase guidelines (offline and local development)

The repo root contains `supabase-guidelines.md`, a local-first guide that matches this section. Its commands agree with section 3 and section 4: `supabase init`, `supabase start`, `supabase db diff -f <name>`, `supabase db reset` to prove migrations replay from scratch, then `supabase link`, `supabase db push --dry-run --remote`, `supabase db push --remote`, `supabase config push` (auth settings and storage buckets from `config.toml`), `supabase functions deploy` and `supabase secrets set`. Two rules from it are adopted here: never push `seed.sql` to production, and enable row level security in the same migration that creates each table. Buckets must be declared in `config.toml` or SQL, or they will not reach production. One fault in the file: every link in its reference list points only to `supabase.com`, so the specific guide pages are lost and need restoring from the official docs.

## 4. Production Deployment

**Targets** are projects you create in the cloud, and the local folder is linked to them. The code itself never contains the target.

- Supabase: create a project on supabase.com, run `supabase login`, then `supabase link` with the project reference. After that, `supabase db push` applies migrations and `supabase functions deploy` deploys edge functions.
- Firebase: create one project in the console and register the Android apps. It is used only to produce the FCM service account key that Expo needs for Android push. There is nothing to deploy to it. Use a separate dev project and production project.
- Secrets: store the Expo access token (if you enable enhanced push security) with `supabase secrets set`. The Firebase service account key is uploaded to EAS, not stored in Supabase. iPhone push needs an APNs key, which `eas build` can generate once an Apple developer account exists.
- App config: Expo apps get the production Supabase URL and anon key through environment variables in release builds.

**Ongoing updates:** change local, make a new migration, test, then `db push`. Migrations carry only structure (tables, columns, indexes, policies, functions), never local test data. The only exception is deliberate reference data inserted inside a migration, such as a list of service types.

**Rules:**

- Local is the only place the schema is changed. Never edit tables directly in the production dashboard, or local and production drift apart.
- Write careful additive or altering migrations, and avoid dropping things once real data exists.
- Use separate dev or staging projects for risky changes.
- Start with manual CLI pushes. Later, move to GitHub Actions, or Supabase's GitHub integration (a paid-plan feature, check current pricing).

## 5. Backend Design

**Two layers working side by side on the same Postgres database:**

- **Auto-generated database API:** the admin web and the ERP app read and write directly for plain CRUD, protected by row level security (RLS) policies. The client app goes through the Hono function (D1). RLS is essential, not optional.
- **Edge functions:** small TypeScript files on Deno, one URL each, running on demand in isolated environments with no shared memory and time limits. Used for push notifications, third-party services, webhooks, and any logic needing secret keys. Sensitive writes can be forced through a function by withholding direct write access.

**Organising function code (decided):** the three options we compared were a shared folder, function-to-function calls, and one function with several routes. We use a mix, as set out below.

1. **Shared folder (`_shared`)** for reusable helpers: the form engine, pricing, status rules and the push sender. Code is bundled into each function at deploy time, only on the server side, never into the apps.
2. **Function-to-function calls over HTTP** are allowed but used sparingly, since each call adds a network hop and a possible cold start.
3. **One Hono function as the client app's entry point** (see the decision below).
4. **Separate functions** for anything with a different trigger: payment webhooks, scheduled jobs, and database-triggered notification functions.

**Decision (D1, confirmed): one Hono entry point for the client app.** Chosen for speed: the client app is already built and tested against its REST contract, so only the server side needs building, and no rewrite of the client's data layer is needed. The client app is already built around a REST contract (one base address, a token, retry on expiry, an idempotency header, a fixed error shape, with tests). We keep that contract and serve it from one Hono edge function. Staff apps may still read directly through the Supabase library and use live updates.

- **Function:** one function, for example named `api`, holding every route the client app already calls. Hono is open source and runs on Deno, so there is nothing external to sign up for and no separate server.
- **Setup:** create the function with the Supabase CLI, import Hono from `jsr:@hono/hono` in its index file, set the base path to the function's name, define routes, and finish with `Deno.serve(app.fetch)`. The base path is required: edge functions cannot be matched to the root path, and every route must be prefixed with the function name.
- **Local run:** `supabase start`, then `supabase functions serve`. The `--no-verify-jwt` flag skips token checking and is for early local testing only, never for a deployed function.
- **Security:** use Supabase's Hono adapter for per-route auth (`npm:@supabase/server@^1/adapters/hono`), so each route runs as the logged-in user and row level security stays in charge.
- **Why one function:** a full REST API in one function reduces cold starts and simplifies deployment.
- **Sources:** the [Supabase routing guide](https://supabase.com/docs/guides/functions/routing) and the [Hono guide for Supabase](https://hono.dev/docs/getting-started/supabase-functions).

## 6. Push Notifications (Expo push service)

1. **App side:** after the user grants permission, the app gets an Expo push token with `expo-notifications` and saves it in the device tokens table, linked to the user. This needs a development build, not Expo Go.
2. **Trigger:** a Supabase database webhook (built on Postgres triggers) fires when a row is inserted or updated and calls an edge function. The database does the watching, the function wakes on demand.
3. **Function:** looks up the user's device tokens, applies the user's notification preferences and quiet hours, and builds the message. The whole notification must stay under 4096 bytes.
4. **Send:** posts the messages to the Expo push service in batches. The response gives one ticket per message.
5. **Cleanup:** if a ticket or a later receipt says `DeviceNotRegistered`, delete that token from the table. A scheduled job checks receipts, which Expo recommends doing after a delay such as 30 minutes, and prunes dead tokens.

The same function serves all apps. Sending through the Expo push service is free. Android credentials: an FCM V1 service account key uploaded to EAS. iPhone credentials: an APNs key. Real delivery cannot be emulated locally, so test on real devices with a separate dev setup, and test again whenever credentials change.

## 7. Authentication

**Decision (D3, confirmed): password sign-in at launch.** This matches how the client app is already built. Phone code verification and Google sign-in are added later, and staff sign up by invite code.

**At launch**

- **Customers:** sign up and sign in with phone or email plus a password, through Supabase Auth. The client app already has these screens.
- **Staff:** sign up with an invite code created by the admin. The invite carries the role. An edge function checks the code, assigns the role and marks it used, as described in the decisions section.
- **Roles:** a database trigger creates a profile row with a default role of customer on first sign-up. Staff roles come only from invites, never from sign-up alone.
- **Rate limits:** password attempts are limited (the client spec says five tries per ten minutes).
- **Devices and sessions:** the client already shows a device list and login history, so the backend keeps device and session records to feed them.

**Later, when the SMS provider is chosen**

- **Phone verification by SMS:** Supabase phone auth with an external provider such as Twilio, MessageBird, Vonage or Textlocal. Until then, codes are mocked in development only, and phone numbers are not verified in production. Locally, the test-numbers option avoids real texts. Provider messages cost money. Phone numbers use the 07 standard everywhere (D25), and the international form (+256) is built only at the moment a number is handed to the SMS provider.
- **Two-step sign-in by SMS:** the client has the screens. It follows the same provider.

**Later, Google sign-in**

- The client's Google button is a placeholder for now. When it is built: create OAuth client IDs in Google Cloud (web, iOS, Android), enable the Google provider in Supabase, keep secrets in environment variables and out of Git, and use separate Google clients for local and production. Native apps use the Google Sign-In library to get an ID token and pass it to Supabase. The web app uses sign in with OAuth. This needs a development build.

## 8. Storage

Supabase Storage with buckets, running locally in Docker too. Inspection photos and videos go to their own private bucket, `inspection-media` (D9). Uses the same RLS ideas. Public buckets for things like service icons, private buckets with signed links for job photos. For example: technicians upload before and after photos, customers see only their own bookings' photos, support sees all. Bucket setup goes in migrations.

## 9. Offline Behaviour

Supabase is online-first. Requests fail offline and nothing is queued automatically. The session persists on device and refreshes when connectivity returns.

- **Draft bookings** live only on the device. Keep them in local state persisted to storage (for example Zustand persist with AsyncStorage) so users can leave and resume.
- **On confirm,** send one insert to Supabase. If offline, tell the user it will be sent when back online, keep the completed booking in a small local queue, and retry when NetInfo reports connectivity.
- **Idempotency:** generate the booking ID on the phone before sending, so retries never create duplicates.
- **Reading data:** light caching, for example TanStack Query with persistence, so screens show recent data.
- **Technicians:** technicians get a full offline mode, with jobs downloaded ahead of time and an ordered queue of actions and photos that syncs when signal returns. Details are in section 12.

## 10. Roles and Permissions

| Role | Scope |
| --- | --- |
| Customer | Own profile, bookings, laundry orders, payments and photos. Signs up normally, no invite code. |
| Technician | Only jobs the dispatcher assigned to them. Trade is defined by skills, each with an admin-set daily hours cap. Works offline and syncs later. |
| Laundry operator | Runs the laundry shop end to end: handles laundry orders from pickup to delivery, including walk-ins, and records machine activity. There is no stock to manage (D24). |
| Customer relations | Views customers, bookings and orders and messages customers. Also sees abandoned booking drafts and records the follow-up reason. Can create bookings for customers who contact the company outside the app (D7). Cannot confirm any booking. Can cancel ("unconfirm") only a booking they created that is still awaiting the manager's confirmation. After the manager has confirmed a booking, cannot cancel it and instead sends the manager a cancellation request, only for staff-created bookings. Cannot cancel or request cancellation on a booking the customer made in the app, and sends the manager a note instead (D7). When an app customer phones and the app fails, may book for them after recording why (D7). Cannot change anything else. |
| Sales operator (D7) | Field sales. Finds customers, logs leads, creates proposed bookings for customers they bring in, and follows up. Sees only their own leads, proposals and customers (confirmed). A proposed booking is not live until the manager confirms it. Can cancel their own proposals while unconfirmed, and sends the manager a cancellation request once confirmed, only on staff-created bookings. Cannot cancel app-made bookings, and sends the manager a note instead (D7). Earns a flat commission on completed, paid jobs they proposed (D7). Uses the ERP app. |
| Manager | One combined role for now (sales, operations, dispatch). Sees all bookings and orders, assigns work, approves the monthly commission list. Supervises the sales operators. Alone confirms staff-created and sales-proposed bookings, by phoning the customer (D7). Permissions are per capability so the role can be split later. |
| Admin | Everything, including staff invites, role assignment and the per-trade daily hours caps. Alone records the cost of operation for each job (D24). |

**Role details (confirmed):**

- **Laundry operator:** handles customers' laundry orders from pickup to delivery, including walk-ins, and records machine activity in the laundry shop. There is no stock or consumables tracking (D24), and no separate laundry manager role. Orders move through stages: received, washing, drying, ready, delivered. Walk-in orders may have no app account, so staff can create a customer record with just a name and phone number.
- **Customer relations (D7):** reads bookings and orders and messages customers. Can create a booking on a customer's behalf when the customer contacts the company outside the app (for example by phone), because that is part of supporting customers. Cannot confirm bookings (the manager does, see below). Can cancel only a booking they created that is still awaiting the manager's confirmation, which the owner called "unconfirming". Once the manager has confirmed a booking, customer relations cannot cancel it. If the customer calls to cancel, customer relations taps **Request cancellation**, enters the customer's reason, and the manager decides (confirmed). Cannot change prices, assign technicians or touch anything else.
- **Staff-created bookings (D7):** the manager, admin and customer relations can create bookings for customers who did not use the app. The booking records its source (app, staff or sales) and who created it. A customer with no app account is held as a record with just a name and phone number, the same as laundry walk-ins. Such offline customers are the only ones staff book for and manage. An app customer books, pays and cancels for themselves. When an offline customer later creates an app account and verifies their phone number, their upcoming bookings are handed over to them (D7).
- **Confirmation by phone (D7, confirmed):** a booking created by staff or proposed by a sales operator stays unconfirmed until the manager phones the customer, checks that the booking is valid, and confirms it. The manager alone does this, so the admin is not loaded with it. The booking records who called, when, and a cancel reason if it falls through. The manager can cancel any booking. The admin can also cancel any booking, as an override only, and is not part of the routine confirmation work.
- **Cancellation requests (D7, confirmed):** once the manager has confirmed a booking, customer relations cannot cancel it. When a customer calls to cancel, customer relations taps **Request cancellation** on the booking and enters the customer's reason. The manager is notified and sees the request in a queue. The manager decides: if they agree they cancel the booking, which is recorded as a cancellation from a customer request, and if not they decline with a short note. Either way the person who raised the request is told. The manager alone cancels confirmed bookings, and the admin keeps the override. The client's 24 hour late fee applies to a cancellation approved this way, with no manager waive option (confirmed). Sales operators get the same button on bookings they proposed (confirmed). The button appears only on staff-created bookings: on a booking the customer made in the app, staff cannot cancel or request cancellation, and send the manager a note instead (confirmed). Once a booking is handed over to an app customer, the button disappears.
- **Sales operator (D7, confirmed as a role):** a new role for the people who go out, find customers and bring them in. They log leads, create proposed bookings for customers they bring in, and follow up. Each customer they bring in is tagged with their id. They use the ERP app, since they work in the field. The manager supervises them and confirms their proposals. Their proposed bookings need the manager's confirmation, the same as customer relations bookings. They can cancel their own proposals while still awaiting confirmation. After the manager confirms, they use **Request cancellation** instead, the same as customer relations (confirmed). They see only their own leads, proposals and customers (confirmed). These rights apply only to bookings staff created and end when the booking is handed over to an app customer. Commission is decided (D7 decision 15).
- **Manager:** one combined role for now (sales, operations, dispatch). Permissions are checked per capability (for example can assign jobs, can view sales reports), so the role can be split later by giving different people different capabilities, with no rewrite.
- **Admin:** everything, including invites, roles and per-trade settings. Alone enters the cost of operation for each job (D24).

**Which app each role uses:** the admin web app is for admin, manager and customer relations. The Expo ERP app serves all staff, including those desk-based roles, using the same account and the same database rules. Screens in the ERP app are shown by role: technicians see their jobs, the laundry operator sees orders and machines, the sales operator sees leads, proposals and follow-ups, the manager sees everything.

**Technicians and skills:** technician types (cleaner, electrician, plumber, handyman, and more to be added later) are data, not separate roles. A technician profile links to one or more skills, and each service is tagged with the one skill it requires, which drives dispatch only. A skill is not a catalogue category (see D5). New trades are a small data change.

**Dispatch and suggestions:** the dispatcher picks, technicians never claim jobs, and a technician sees only jobs assigned to them. The system suggests technicians in two steps, and the dispatcher always makes the final call.

1. **Filter out** anyone who is off duty, on time off, outside working hours, or already assigned at that time. Also filter out anyone whose daily hours cap would be exceeded. The system adds up hours already assigned that day and excludes the technician if the new job would push them over the cap. How travel gaps count is still open (see the travel time decision).
2. **Rank the rest** by skill match and their priority or value rating. Location plays no part, since every technician starts from the office. The dispatcher sees the ranked list with reasons.

**Schedule data:** a weekly working pattern plus date-specific overrides for days off.

**Daily hours cap:** set per trade (skill), not per person, and only the admin can change it. It is a maximum daily hours column on the skills table. A technician with two skills gets the stricter of the two caps.

A database rule prevents assigning a job to someone already booked at that time. Assignment triggers a push notification to the technician.

**Crew on a booking:** a booking can need more than one technician, for example a plumber and a cleaner, or three cleaners for a large job. The booking states how many technicians it needs, and every technician the dispatcher assigns is added to the booking's crew automatically, since the crew is simply all assignment rows for that booking.

- Each assignment has a crew role of lead or helper, and the database enforces exactly one lead per booking.
- Customers see the whole crew on their booking in the client app, with each person's photo, display name and trade. A lead can be drawn with an orange ring and helpers plain. That is purely a front-end choice and can change any time.
- Customers see only those fields for technicians assigned to their own bookings, never phone numbers or schedules. This is done with a database view exposing just those fields, backed by a row level security rule.
- Technician photos are stored in a private Supabase Storage bucket, with access following the assignment rule described in the decisions section.

## 11. Main Tables (first sketch)

All tables get row level security. Names are placeholders to refine.

**Identity and access**

- `profiles`: id (matches auth user), full\_name, phone (stored as 10 digits starting 07, D25), role, status (active or deactivated), deactivated\_at, deactivated\_by, created\_at. Walk-in laundry customers may exist without an auth user.
- `device_tokens`: id, user\_id, expo\_push\_token, platform, last\_seen\_at.
- `reactivation_requests`: id, profile\_id, message (optional), status (pending, approved, declined), requested\_at, decided\_by, decided\_at. Created by an edge function, since the customer is not logged in when they send it.

**Services and technicians**

- `skills`: id, name (cleaning, electrical, plumbing, handyman, more later), max\_daily\_hours (set by admin only).
- `categories`: id, parent\_id (null for a top-level category, set for a sub-category), name, description, image\_path, display\_order, active. The customer catalogue tree. Seeded with the client's seven categories: Cleaning, Upholstery and carpets, Surface care, Pest control, Repairs and installations, Building and finishing, and Outdoor and landscaping.
- `services`: id, category\_id, name, description, image\_path, pricing\_type (fixed, hourly, quote), price (the fixed price, or the rate per hour of service, never per technician), duration, required\_skill\_id, active. Each service has exactly one category (what customers browse) and one required skill (what dispatch uses).
- `service_form_definitions`: id, service\_id or category\_id (one of the two, a service form overrides its category form), version, schema (jsonb: sections, fields, conditional rules), is\_current, created\_by, created\_at. The client's versioned form definition. Editing a form creates a new version, so old bookings are never affected.
- `booking_form_snapshots`: id, booking\_id, form\_definition\_id, form\_version, questions (jsonb, the exact questions asked), answers (jsonb), created\_at. Saved with the booking. Photo and video answers hold a Supabase Storage path inside the answers. The backend validates the answers against the schema before saving.
- `technician_profiles`: user\_id, display\_name, photo\_path, priority\_rating, active.
- `technician_skills`: technician\_id, skill\_id.
- `technician_availability`: id, technician\_id, weekday, start\_time, end\_time (the weekly working pattern). Date-specific days off and overrides go in technician\_overrides: id, technician\_id, date, is\_off, start\_time, end\_time.

**Bookings and jobs**

- `addresses`: id, customer\_id, label (for example home or office), line items, area, latitude and longitude (optional), notes, is\_default, created\_at.
- `bookings`: id (generated on the phone, or by the server for staff-created bookings), source (app or staff), created\_by (the staff member, for staff-created bookings), customer\_id, address\_id, status (requested, awaiting confirmation, confirmed, scheduled, on the way, in progress, completed, cancelled, see D9), technicians\_needed, scheduled\_start, scheduled\_end, billed\_hours (hourly services), total\_price, notes, created\_at.
- `cancellation_requests` (D7): id, booking\_id, requested\_by, reason, status (pending, approved, declined), decided\_by, decided\_at, decision\_note, created\_at. Raised by customer relations, or by the sales operator who proposed the booking, on a confirmed staff-created booking that has not been handed over to an app customer (D7). Only the manager decides.
- `booking_items`: id, booking\_id, service\_id, quantity, price.
- `quotes`: id, booking\_id, requested\_by (customer), description, quoted\_amount, prepared\_by (manager), status (requested, inspection required, inspection scheduled, inspected, quoted, accepted, declined, expired, see D9), inspection\_required (true or false), quoted\_at, responded\_at, created\_at. Used for services with the quote or hourly pricing type. The inspection details live in `inspections`.
- `inspections` (D9): id, quote\_id, booking\_id, required\_by (manager or admin), required\_at, required\_note (why), inspector\_id (a technician or a staff member), scheduled\_at, status (required, scheduled, in progress, submitted, withdrawn), started\_at, submitted\_at, checklist (JSON, from the legacy inspection template), notes, measurements (JSON), recommended\_hours, recommended\_crew, withdrawn\_by, withdrawn\_reason. One active inspection per quote. The report is the checklist, notes, measurements, recommended hours and crew, and the media.
- `inspection_media` (D9): id, inspection\_id, storage\_path, kind (photo or video), caption, taken\_at, uploaded\_by.
- `inspection_addenda` (D9): id, inspection\_id, author\_id (manager or admin), note, created\_at. Notes added to a submitted report, which itself stays locked.
- `booking_status_history` (D9): id, booking\_id, from\_status, to\_status, changed\_by (or system), note, changed\_at. Written by the one function that moves stages.
- `job_assignments`: id, booking\_id, technician\_id, crew\_role (lead or helper), assigned\_by, status (assigned, accepted, declined, in progress, done, removed), starts\_at, ends\_at (the planned times), started\_at, completed\_at (the actual times, set by the technician in the app). One row per technician per booking, so a booking can have as many technicians as it needs. Rules: no overlapping times per technician, and exactly one lead per booking.
- `job_photos`: id, booking\_id, uploaded\_by, storage\_path, kind (before or after).

**Laundry shop and job costs**

The business has one shop, the laundry shop. There is no store for contract jobs, no store manager role and no inventory of any kind (D24). Nothing is scoped by store, because there is only one shop, so the laundry operator role itself limits what that person can see and change.

- `equipment`: id, name, type, location, status, last\_service\_date. The laundry shop's machines only.
- `job_costs` (D24): id, booking\_id, description (what was used, in the admin's own words), amount, entered\_by (admin), created\_at, updated\_at. One row per cost the admin enters against a booking. There is no stock, item list or quantity on hand, and no ledger: only the money spent on the job. A booking's total cost is the sum of its rows. Margin is the booking's total price minus its total cost, calculated and never typed in.

**Laundry**

- `laundry_orders`: id, customer\_id (nullable for walk-ins), walk\_in\_name, walk\_in\_phone, status (received, washing, drying, ready, delivered), created\_by, picked\_up\_at, delivered\_at.
- `machine_logs`: id, equipment\_id, laundry\_order\_id, operator\_id, action, started\_at, ended\_at.

**Payments and access control**

- `payments`: id, booking\_id or laundry\_order\_id, amount, method (app, cash), status, provider, provider\_reference, recorded\_by (staff member, for cash), paid\_at, created\_at. One order can have many payment rows.
- `cash_handovers` (D10): id, technician\_id, amount, confirmed\_by (manager or admin), confirmed\_at, note. One row each time a technician hands cash over. Append only.
- `cash_disputes` (D10): id, payment\_id, technician\_id, expected\_amount, received\_amount, technician\_note, status (open or resolved), resolved\_by (manager or admin), resolution\_reason, resolved\_at, created\_at.
- `staff_invites`: id, code, role, created\_by, expires\_at, used\_at, revoked.
- `capabilities` and `role_capabilities`: capability-based permissions, so the manager role can be split later.
- `audit_log`: id, actor\_id, action, table\_name, record\_id, old\_value, new\_value, created\_at. Append only.

**Communication**

- `notifications`: id, user\_id, title, body, type, read\_at, created\_at.
- `booking_drafts`: id, customer\_id, selected\_services, last\_step, status (in progress, abandoned, followed up, completed), abandoned\_at, follow\_up\_reason, followed\_up\_by, followed\_up\_at, booking\_id (set when the draft becomes a booking), updated\_at. The client app saves the draft as the customer goes. See the abandoned bookings decision in section 12.
- `support_conversations` (D13, resolved 2026-11-24): id, reference (`GBT-` code shown in the client), customer\_id (unique, one row per customer), subject, category (booking, payment, service, account, other), status (open, waiting\_on\_customer, resolved), last\_message\_at, last\_read\_by\_staff\_at, last\_read\_by\_customer\_at, created\_at, updated\_at. Created automatically the first time a customer or staff member sends a message.
- `support_messages`: id, conversation\_id, sender\_id, body, booking\_id (optional), laundry\_order\_id (optional), created\_at. A message is tagged to a booking or laundry order only when it relates to one. General inquiries carry no tag.

D13 is settled in favour of one conversation per customer, with ticket-like subject, category, reference and status on the conversation so the client ticket centre remains the customer entry point. Staff reply in the same thread. There is no technician-to-customer chat in the first release; adding it later means one more notification event and does not change these tables.

- `reviews`: id, booking\_id, customer\_id, target\_type (service or technician), service\_id or technician\_id (whichever is rated), rating (1 to 5), comment (optional), created\_at. One row per rating, so a customer can leave several for one booking.

Customer relations, manager and admin can read and reply in any conversation. A customer can only read and write in their own conversation, enforced by row level security. Each new message also creates a row in `notifications` for the other side, delivered by push.

## 12. Decisions and Additions

**Payments:** customers pay in the client app. No provider chosen yet, to be set up later. The pattern will be: the app starts a payment, the provider confirms it by webhook, and an edge function verifies it and marks the order paid. Provider secret keys live in Supabase secrets, never in the apps. Design in now a `payments` table (order, amount, status, provider reference). Pick a provider that supports your country and currency.

**Service entry and dynamic forms (D4, confirmed):** services and their forms are kept exactly as the client app already defines them. Speed is the reason: the model is built and tested, so only the server side is needed.

- Each service or category has one versioned form definition made of sections and fields. A field can be shown only when an earlier answer calls for it.
- There are nine field types: text, textarea, number, counter, select, multiselect, boolean, measurement (a value with a unit) and media slot (photo or video). The list is fixed by the client app, and adding a type means an app update.
- When a booking is made, the backend checks the answers against the current form version and stores a snapshot of the questions and answers (`booking_form_snapshots`). Later edits to the form do not change old bookings.
- The admin web builds and edits forms with the same schema, copied from the client (see the shared code decision). Which questions a service needs still depends partly on its pricing type: quote services usually ask for more up front.
- Booking steps are the ones already in the client app. Each section points to a step by name.
- Answers are visible to admin, manager and customer relations on every booking. Customer relations can fill in the form when creating a staff-created booking, and is otherwise read only. A technician sees answers only for bookings they are assigned to, including as part of a crew. A customer sees their own. Row level security enforces this.
- Media answers go to Supabase Storage, with the path stored in the snapshot.
- **Existing services keep their layouts, not their hard-coded values.** The services already in the client app keep their screens and layouts. Their content (name, description, category, pricing type, price) is loaded into the database as seed data and edited from the admin from then on, together with a form definition matching what the client already draws. The client reads all of it from the server (D6).
- **New services reuse the client's layouts.** Services the admin adds later are drawn by the client's existing form engine from their form definition, using the same nine field types and the same layouts as the built-in services. No client update is needed to add a service. Only a new field type needs an app update.
- **Deactivating a service.** Admin and manager can deactivate any service, old or new, from the admin web. A deactivated service disappears from the client catalogue and cannot be booked, but past bookings, snapshots and reports keep working. Services are never deleted. A service can be reactivated at any time.

**Service catalogue in the client app (D5, confirmed):** services are shown grouped by category, using the client's own category tree.

- A real `categories` table, with sub-categories through `parent_id`. It holds the seven categories the client already shows, and the admin can add, rename, reorder or deactivate categories and sub-categories.
- A category is a customer-facing grouping and has nothing to do with the trade. Trades (skills) stay separate and only decide which technician can be dispatched. Each service has one category and one required trade, so Sofa deep clean sits under Upholstery and carpets and needs a cleaning technician.
- A category can have its own form definition, shared by its services. A service form, if present, takes priority. Deactivating a category hides it and all its services from customers, but nothing is deleted.
- What customers see and tap are the services, each with one image, its name, its description and its price or hourly rate. Quote services show that a quote is needed instead of a price.
- Each service has a single image, stored in Supabase Storage with the path in `services.image_path`. The bucket is public, since customers must see services before they book.
- Only active services are shown. Admin and manager manage the services and their images.

**Pricing types and deposits (D6, confirmed):** every service has one of three pricing types, stored in `services.pricing_type`. Nothing about a service is hard-coded. The admin enters and edits every value in the admin web or ERP app: name, description, image, category, pricing type and price. This includes the services that already exist in the client app.

- **Fixed price:** the admin sets the price, so the total is known straight away. The customer can pay right away. Fixing a TV is an example.
- **Hourly:** the admin sets one rate per hour of service, never per technician. The client shows the customer that hourly rate, and nothing more. The customer does not choose the hours or the crew. The booking is treated like a quote: the technician side or the admin side decides how many hours the job needs, and the total is the rate times those hours (plus any materials). The customer sees that figure as a quote and must confirm it.
- **Quote:** no price is shown. The customer sends a request with details and photos, and the price is agreed afterwards.
- **Payment timing:** only fixed-price services can be paid right away at booking, because only there is the price known in advance. Hourly and quote services can be paid (in full or as a deposit) only after the customer has confirmed the quote.
- **Crew size is decided by the company.** The customer never chooses how many cleaners or technicians come. The company decides how many technicians a job needs, whatever the trade. The crew size is set during quoting or dispatch, and the customer then sees the crew on the booking.
- **Switching type.** Admin and manager can change any service, old or new, between fixed, hourly and quote at any time. The client changes its wording and screens to match the type (for example the button reads Request quote for a quote service). Bookings already made keep the type and price they were made with.
- **Unchanged from the client:** the lower rate for longer bookings (where the company has set hours), materials, add-ons, frequency discounts, promo codes and 18% VAT stay as the client has them. All their values become admin-editable data rather than code.

**Quote flow (used by quote services and hourly services):** the customer requests the service in the client app and describes the job. For an hourly service the request carries the service, date and address, and the customer sees only the hourly rate. The manager is the lead and prepares the quote. For an hourly service that means setting the hours and the crew, and a technician or the admin side can propose the hours. The quote is then sent back, and the customer gets a push notification. The customer accepts or declines. On acceptance the quoted amount becomes the booking total. Customer relations can see quotes but not prepare them, in line with their read and message only role.

- **Quote requests are not bookings yet.** A quote or hourly request shows in the client's Bookings → Requests section, never in Upcoming, and its booking stage is Requested (D9). The request statuses are: requested, inspection required, inspection scheduled, inspected, quoted, accepted, declined, expired. A request that needs no inspection goes straight from requested to quoted. The client has no inspection steps yet, so it needs new statuses and wording for them.
- The price is agreed through liaison. The manager or the staff member handling the request talks to the customer, and the quote is adjusted until both sides agree.
- **Inspection step (optional, for quote and hourly services; amended by D9).** Inspection is no longer automatic for quote services. When a request arrives, the manager or admin reviews it and either sends a quote straight away, or marks **Inspection required** instead. When it is required, the inspection step appears on the request, a technician visits the site, and the findings are documented as a report. The quote can be sent to the customer for approval only after the report is submitted. The full design is in the D9 decision. Fixed-price services never have an inspection.
- The inspection is scheduled with the customer, so the request shows an Inspection scheduled step in Requests. The inspector is a technician or staff member the manager or admin assigns (D9). Inspections are free (D9).
- Only when the customer confirms the final quote does the request become a booking and move to Upcoming. From then on it follows the normal booking path, including payment and dispatch.

**Deposits:** a deposit is never required, only allowed. For every pricing type, the customer can pay a deposit up front, or pay after the service, and the app always allows a payment. For quote services, paying a deposit becomes possible once the quote is sent and accepted. A deposit is simply a partial payment row in `payments`, so no special logic is needed.

**Hourly billing (D6, corrected on review):** the customer pays the hours confirmed in the quote, not a different figure at the end. The technician's timer still records the real time, but it does not change the price.

- When the technician arrives at the job location they tap start, and the clock begins at that tap, not at the scheduled time, since they may arrive late. They tap complete when the job is done, and the clock stops.
- Start and finish are stored as timestamps on the technician's `job_assignments` row (`started_at`, `completed_at`). They work with the offline queue, so a job timed without signal syncs later with its original times.
- Total price is the confirmed quote hours times the hourly rate (plus any materials). `bookings.billed_hours` holds the confirmed quote hours.
- The timed hours are used to flag a job that runs over its quoted hours, for manager review, and to measure travel time (see the travel time decision). Any extra charge beyond the quote needs manager approval and a new customer confirmation (proposed, see D6 impact).
- The server works out the total when the quote is confirmed and again at completion, never on the phone, so the figure cannot be altered from the app.
- The old rule (billed time is elapsed time rounded up to 15 minutes) is dropped, because it contradicted the confirmed D6.

**Partial and cash payments:** customers usually do not pay in full, and some pay cash on delivery or at the store. So an order or booking is not simply paid or unpaid: it has a total, and any number of payments against it.

- Each payment is its own row in `payments`, with a method of app or cash. App payments are confirmed by the provider webhook. Cash payments are recorded by staff in the ERP app: the laundry operator at the laundry shop, and the technician or manager for contract jobs. The row stores who recorded it, so every cash entry is traceable.
- Amount paid and balance remaining are calculated from the payment rows (total minus the sum of confirmed payments), never typed in by hand. A database view exposes them per booking and per laundry order.
- A booking or order shows as unpaid, part paid or fully paid, worked out from that balance.
- The customer's app shows, on each order, the total, what has been paid and the balance remaining. Cash entries are marked as recorded by staff.
- A recorded payment cannot be edited or deleted by the person who made it. A mistake is fixed by a correcting entry, and only the manager or admin can do that. This keeps the money trail clean.
- The unpaid balance reminders to customers (see notification events) are based on this balance.
- **Cash held by technicians (D10):** cash a technician collects on a job belongs to the company until handed over. See the D10 decision below.

**Staff accounts:** invite only. The admin creates an invite with a role attached, and the app generates a one-time code. The staff member signs up with the code, and an edge function checks it, assigns the role and marks the code used. Codes expire after a few days, work once, and can be revoked. Customers sign up normally with no code. Table: `staff_invites` (code, role, created\_by, expires\_at, used\_at, revoked).

**Technician offline mode:** technicians need a proper offline mode for areas with poor signal.

- The day's assigned jobs are downloaded ahead of time so they open without signal.
- Every action (progress, notes, photos) is saved on the phone first, in an ordered local queue, each with its own unique ID so a retry never duplicates.
- Photos are stored on the device and uploaded in the background.
- Each synced update carries its original timestamp, so the record shows when the work happened, not when it uploaded.
- If a dispatcher reassigns a job while the technician is offline, the server wins and the app tells them on sync.

**Support conversations:** each customer has one ongoing conversation with customer relations, the same chat layout for everyone. Customers can message at any time, with or without a booking. When a message concerns a specific booking or laundry order, it is tagged to it, and the app shows that booking or order as a reference inside the chat, so there are no separate threads per booking. Customer relations see a list of customers ordered by latest message, with unread conversations marked, using `last_read_by_staff_at`.

**Notification events:** each event creates a row in `notifications` and sends a push through the Expo push service.

- Customer: a gentle invitation to rate after a job is completed, quote received, booking confirmed (including a staff-created or sales-proposed booking once the manager confirms it, by push if they have the app, otherwise by message, D20), booking cancelled (with the reason), technician assigned, technician on the way, job completed, laundry order status changes (received, washing, drying, ready, delivered), new support message, payment confirmed.
- Customer reminders: occasional reminders of any unpaid balance on an order or booking, and reminders of orders or bookings that are not complete. A scheduled job sends them, with a limit on how often each customer is reminded.
- Staff (starting list, to be adjusted and extended later):
    - Technician: job assigned, reassigned or cancelled (a technician assigned to a cancelled booking is told, D20), and a reminder before a job starts.
    - Laundry operator: new laundry order, and a machine due for service.
    - Customer relations (D20): new support message, a newly abandoned booking, every new booking made in the app, every new quote or hourly request, a staff-created or sales-proposed booking once the manager confirms it, every cancellation with its reason (so they can find out why), and the manager's decision on a cancellation request they raised (D7).
    - Sales operator: the manager's decision on a booking they proposed (confirmed or cancelled) and on a cancellation request they raised (D7). Confirmed by D20: they are told when a booking they proposed is confirmed or cancelled.
    - Manager: reactivation request, new quote or hourly request, new booking (including staff-created and sales-proposed ones awaiting a confirmation call, D7), every cancellation (D20), a new cancellation request (D7), an unassigned booking approaching its start time, and payment failures.
    - Manager and admin, cash (D10): a cash dispute is opened, and cash a technician has held for more than 24 hours without handing over. The technician is told when a handover is confirmed or a dispute is resolved.
    - Admin: everything the manager receives, plus new staff sign-ups using an invite code. For a staff-created or sales-proposed booking, the admin is told when it is confirmed, not when it comes in (D20).

**Abandoned bookings:** the client app saves a booking draft as the customer goes. If the draft is not completed within 24 hours of its last update, a scheduled job marks it abandoned and sends the customer a push notification straight away. Abandoned drafts appear in a follow-up list for customer relations. At a convenient time, customer relations message the customer in the support chat to ask why the booking was not completed, then record the reason in `follow_up_reason` and set the status to followed up. If the customer completes the booking later, the draft is marked completed and linked to the booking. The drafts table doubles as analysis data: where customers stop and the reasons they give, which the admin can review.

**Edge function structure (starting list):** each job that needs trusted server code is its own small edge function, with a shared folder for common code.

- Separate functions, one per job: confirm payment (the provider webhook checks the payment and marks it paid), redeem staff invite (checks the code and assigns the role), calculate billed hours (works out time and price when a technician completes a job), send push notification (sends through the Expo push service and checks receipts), mark abandoned bookings (a scheduled job, 24 hours after the last draft update), send payment and booking reminders (a scheduled job), and submit a reactivation request (works without a login).
- Shared folder: code several functions use, such as checking who is calling and their role, sending a push, and reading payment balances. This avoids repeating the same logic in each function.
- The payment webhook stays isolated because it holds the provider secret keys, which live in Supabase secrets and never in the apps.
- This list is provisional. It will be adjusted once the existing client app, the ERP and their documentation have been reviewed, since features found there may need functions of their own.

**Security rules (who reads and changes what):** every table has row level security. The rules below are the starting position, built from the decisions in this document.

- Customer: reads and changes only their own profile, addresses, bookings, laundry orders, quotes, answers, payments view and support conversation. A customer cannot change a booking's status or price.
- Technician: sees only bookings they are assigned to, including as part of a crew. They can update progress, notes and photos on those jobs, and start and complete them. They record the cash they collect on a job and can read, but never edit, their own cash owed, handovers and disputes (D10).
- Laundry operator: works only with the laundry shop's orders and machines. Can record cash payments at the laundry shop. Alone changes laundry records, since manager and admin see them read only (D7).
- Admin, commission (D7): sees the approved commission list, can adjust it and records payment. Sets the flat commission fee.
- Customer relations: reads customers, bookings, orders, quotes, answers and abandoned drafts. Writes support messages and follow-up reasons, and can create bookings for customers outside the app (D7). Cannot confirm bookings. Can cancel only bookings they created that are still awaiting confirmation, enforced by row level security on the creator and the status. Cannot see job photos, but can read inspection reports and their photos, read only (D9). Can create a cancellation request only on a confirmed booking that staff created and whose owner is still staff, never on one the customer made in the app, and can send the manager a note on any booking (D7). Enforced by row level security so the request can only be inserted as themselves and never changes the booking itself (D7).
- Sales operator (D7): creates leads and proposed bookings, enforced by row level security on the creator. Cannot confirm bookings, see prices beyond what the service shows, assign technicians or see job photos. Sees only their own leads, proposals and customers, enforced by row level security on the creator, while manager and admin see all (D7, confirmed). Can cancel only bookings they created that are still awaiting confirmation, and can insert a cancellation request only on a confirmed booking they proposed, enforced by row level security on the creator and the status. Both rights end when the booking's owner becomes the customer (handover, D7). Cannot act on app-made bookings, and can send the manager a note instead (D7).
- Manager and admin, cash (D10): either can confirm a cash handover and resolve a cash dispute with a written reason. Neither can edit or delete a recorded handover.
- Manager: approves the monthly commission list (D7). Alone confirms staff-created and sales-proposed bookings, after phoning the customer (D7). Can cancel any booking. Reads and decides cancellation requests: approving one cancels the booking, declining needs a note (D7).
- Admin: not given the confirmation work. Can cancel any booking as an override (D7). Every cancellation, including an admin override, asks for a reason and is written to the audit log.
- Manager: sees and changes everything operational, including quotes, dispatch and corrections to payments, and sees the laundry shop read only (D7). Does not see job costs or margin unless given that capability (D24, proposed). Permissions are checked per capability.
- Admin: everything, and alone manages staff invites, roles, trade hour caps, the categories and the services catalogue. Alone enters and changes job costs (D24).

**Job photo access:** before and after photos of a job are private. They are stored in a private Supabase Storage bucket, and a storage rule checks who is asking.

- Who can see a job's photos: the technicians assigned to that booking (including its crew), the booking's customer, the manager and the admin.
- Customer relations cannot see job photos, but can read inspection reports and their photos, read only (D9). Other technicians and other customers cannot see job photos either.
- Only logged-in people can reach them, and the app fetches them through short-lived signed links, so a link cannot be shared around.
- Service images and technician profile photos are covered in the next section.

**Service images and technician photos:**

- Service images are public. Customers need to see them in the catalogue before they log in or book, so they sit in a public bucket and carry no personal information.
- Technician profile photos are private and the access is dynamic. A customer sees a technician's photo only when that technician is assigned to one of their own bookings. A customer with no assignment sees nothing.
- Technicians can see each other's photos. Manager, admin and customer relations can see all technician photos, since they work with staff every day. Other customers cannot.
- Photos are fetched through short-lived signed links, and the storage rule uses the same assignment link as the limited technician view customers already get (photo, display name and trade only).
- This settles the open bucket question for technician photos: private. Service images: public.

**Customer addresses:** a customer can save several addresses, such as home and office, and choose one when booking. The client app already handles the picking.

- Each address has a label, the address lines, the area, optional map coordinates and notes. One address can be marked as the default.
- The area, and the coordinates when present, help with maps and travel time. They are not used to rank technicians, since every technician starts from the office.
- A booking keeps a link to the address used. Changing or deleting a saved address later must not alter the address on past bookings, so an address used by a booking is archived rather than deleted.
- Customers manage only their own addresses. A technician sees the address of a job only while it is assigned and not yet complete, the same rule as the customer's contact details.
- Walk-in laundry customers have no address book, since laundry is picked up or dropped at the store unless a delivery address is entered on the order.

**Customer contact details for technicians:** a technician needs to reach the customer, so for a job assigned to them they see the customer's name, phone number and address, but only until they mark the job complete.

- When the technician marks the job complete, the contact details leave their view. They keep only the job history: the service, date, hours worked, and their own notes and photos.
- Customer relations, manager and admin keep the full contact details, because they handle follow-ups and customer service.
- This is enforced in the database, not just hidden in the app. The technician's view of a customer's contact fields is limited to their active assignments, in the same way customers see only a limited view of technician details.

**Reviews and ratings:** reviews are always optional, and the app only invites them gently.

- After a job is completed, the customer gets a push notification and a simple rating screen they can skip.
- A customer can rate the service, any technician on the booking's crew (not only the lead), or both. Each rating is its own row in `reviews`, with a rating from 1 to 5 and an optional comment.
- Only the booking's customer can review it, and only after it is completed. A customer can rate each target once per booking.
- Technicians can see the ratings and comments about themselves. Manager, admin and customer relations can see all reviews. A customer can see only the reviews they wrote themselves, never anyone else's ratings.
- Average ratings per service and per technician are calculated from the rows, never typed in by hand.
- Customers do not see ratings. Averages are never shown in the catalogue or on technician profiles in the client app. Ratings are internal, for staff only.

**Travel time (partly decided):** every technician starts from the office, so location does not rank technicians. Travel between jobs still affects the daily hours cap.

- Measured travel time: travel is counted from the moment a technician marks a job complete to the moment they tap start on their next job. The gap between those two taps is recorded as travel time, using the `completed_at` and `started_at` timestamps already on `job_assignments`.
- The problem: the real gap is only known after it happens, so it cannot be used to check the cap when the dispatcher is planning the day. A job can look like it fits in the hours left, then travel eats into them, as with four hours left, two hours of travel and a four-hour job.
- Not decided yet: how planning should estimate travel before the real figure exists (for example a fixed allowance, an average of past measured gaps, or the dispatcher's judgment), and what happens when a job runs past the daily cap.
- To be revisited once the whole application is in place. Until then, the dispatch design stands as written, with the daily hours cap counting assigned hours only.

**Cancellations and rescheduling (to be taken from the client app):** the rules for who can cancel or move a booking, any cut-off time and any fee already exist in the client application. They are not designed here. They will be taken from the client app and recorded in this document once it has been reviewed.

**Account deactivation:** accounts are never deleted. All details and history are kept: bookings, payments, reviews, conversations and addresses.

- A customer can deactivate their own account. A deactivated customer cannot log in or book. Their status is set to deactivated, with the time and who did it.
- Only the manager or admin can reactivate an account. The customer sends a request to be reactivated, and the manager or admin approves it. When a deactivated customer tries to log in, the app tells them the account was deactivated and offers a request reactivation button. The request is saved in `reactivation_requests`, and the manager and admin get a notification. Approving it sets the profile back to active.
- Staff accounts are deactivated the same way, by the admin, so a person who leaves keeps their history on past jobs but loses access.
- Walk-in laundry customers have no account, so this applies only to customers with an app account.

**Customer search:** customer relations, manager and admin find a customer by name or phone number. Opening the customer shows everything about them: bookings, laundry orders, quotes, payments and balance, support conversation, addresses and any abandoned drafts.

- Search covers customers with an app account and walk-in laundry customers, since both have a name and phone number on their profile.
- Phone numbers are matched in the 07 standard (D25). A search is typed in the 07 form, with spaces or dashes ignored, such as 0772 123 456 or 0772-123-456. A search typed as +256 or 256 is refused with the same message, since people may enter only the 07 form (D25 amendment).
- Search results follow the same access rules as everything else. Customer relations sees the customer's details but cannot see job photos (inspection reports are the exception, D9).
- Deactivated customers still appear in search, marked as deactivated, so staff can handle reactivation requests.

**Audit trail (starting list):** a log of sensitive actions, recording who did it, when, and what changed. The list below is a starting point, to be extended once the applications are connected.

- Money: every payment recorded, and every correction to one.
- Quotes: a price sent, and a customer accepting or declining.
- Accounts and access: staff invites created and used, roles assigned or changed, accounts deactivated or reactivated, and reactivation requests decided.
- Bookings: assignments and reassignments, cancellations and rescheduling, and jobs started and completed.
- Job costs: every cost entry added, changed or deleted (D24).
- Settings: changes to services, prices and the trade hour caps.
- The log is append only: nobody can edit or delete an entry, and only the admin can read it. Entries are written by database triggers and edge functions, never by the apps directly.

**Backups and recovery (recommendation):** the data includes money records, so losing it would be serious.

- Use Supabase's automatic daily backups on the production project. Check the plan chosen includes them.
- Turn on point in time recovery if the plan allows it, so the database can be restored to a moment shortly before a mistake, not only to the last daily backup.
- Photos in Supabase Storage are not part of the database backup, so keep a separate copy of the job photo bucket on a schedule.
- Keep the schema in the repository as migration files, so the structure can be rebuilt from scratch on a new project.
- Test a restore on the staging project once it exists, before relying on it.
- Provider secrets and keys are kept outside the database, in Supabase secrets, with a copy of the list of what is needed stored safely by the admin.

**Languages, currency, region:** English only, one currency, one region. Prices are stored as plain numbers in one currency. A currency column and a translation layer can be added later if needed.

**Deployment:** manual CLI pushes for now. Move to GitHub Actions once the backend is stable and a staging project exists.

**Additional tables from these decisions:**

- `laundry_orders`: id, customer\_id (nullable), walk-in name and phone, status, created\_by, picked\_up\_at, delivered\_at.
- `machine_logs`: id, equipment\_id, laundry\_order\_id, operator\_id, action, started\_at, ended\_at.
- `payments`: id, booking or order reference, amount, method (app or cash), status, provider, provider\_reference, recorded\_by, store\_id, paid\_at. Many rows per order, for partial and cash payments.
- `staff_invites`: as above.
- `skills.max_daily_hours`: the admin-set cap per trade.
- `technician_schedule`: weekly pattern, plus `technician_overrides` for specific days off.
- Capability-based permissions: a `capabilities` table and a `role_capabilities` table, so the manager role can be split later.

**Still open:**


- Edge functions: a starting list and structure are in the doc (separate functions plus a shared folder). To be revised once the client app, the ERP and their documentation have been reviewed.
- The extra technician trades you will name later.
- Cancellation and rescheduling rules, to be taken from the client app.
- Travel time: how planning estimates it before the real gap is known, and what happens when a job would run past the daily cap. See the travel time decision.
- The payment provider.

**Decision (D2, confirmed): push goes through the Expo push service.** Chosen for speed and because the client app is already built on `expo-notifications`. Direct FCM with React Native Firebase, as first planned, is dropped. Firebase stays only to supply the Android FCM V1 service account key to EAS. Device tokens are Expo push tokens. Dead tokens are removed when Expo reports `DeviceNotRegistered`. Sources: the [Expo guide to sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/).

**Decision (D3, confirmed): customer sign-in is password plus phone code, with the phone code and Google added later.** At launch, customers use phone or email plus a password, as the client app already does, and staff use invite codes. Phone verification waits for an SMS provider, and Google sign-in follows after that. Details are in section 7.

**Decision (D4, confirmed): service forms follow the client app's model.** Keep the services and forms as the client already defines them: one versioned form definition per service or category, nine field types, and a snapshot of questions and answers stored with each booking. Our `service_fields` and `booking_answers` tables are dropped in favour of `service_form_definitions` and `booking_form_snapshots`. This also closes the open item on field types and step names. Existing services stay as built, new services reuse their layouts, and admin and manager can deactivate any service. Chosen for speed. Section 12 and the database section are updated.

**Decision (D5, confirmed): a real categories table with sub-categories.** The customer catalogue uses the client's seven categories and their sub-categories, held in a `categories` table. Trades (skills) stay separate and drive dispatch only. Each service has one category and one required trade. Section 12 and the database section are updated.

**Decision (D6, confirmed): pricing.** Nothing is hard-coded, so every service, including the existing ones, is entered and edited by the admin. There are three pricing types (fixed, hourly, quote), switchable on any service. Hourly is a rate per hour of service, shown to the customer as a rate only. The customer does not pick hours or crew size. The company sets the hours and the crew through a quote that the customer confirms, so hourly works like a quote. Only fixed-price services can be paid right away. Quote requests show in Bookings → Requests and become Upcoming bookings once the customer confirms the agreed price. Hourly jobs bill the confirmed quote hours. Rate tiers, materials, add-ons, frequency discounts, promos and 18% VAT stay as the client has them, as editable data.

**Client changes that follow from D6 (for the client build list):** remove the How many cleaners and How many hours pickers for hourly services and show the rate per hour instead. Make the service type come from the server so wording follows fixed, hourly or quote. Show hourly requests in Requests until the quote is confirmed. Allow payment at booking only for fixed-price services.

**Addition to D6 (confirmed, amended by D9): optional inspection step for quote and hourly services.** An inspection is optional. When the manager or admin marks it required, it happens before the quote is sent, and its findings are documented as a report against the request. Only then can the quote go to the customer. The client needs new statuses and wording for it. The full stage list and the inspection design are settled in D9.


**Decision (D24, confirmed): the store is removed, inventory is removed, and job costs are recorded instead.** Recorded 2026-11-23, owner instruction.

- The main store for contract jobs, the store manager role (which had replaced the old storekeeper) and the `stores` and `staff_stores` tables are removed. The laundry shop is the only shop left, so nothing needs scoping by store.
- There is no inventory tracker and no inventory ledger anywhere, the laundry shop included. Removed: `inventory_items`, `stock_movements`, reorder levels, low stock alerts, issuing materials to technicians, and the manager's view of both stores' inventory.
- Cost of operation replaces it. When technicians come back from a job they bring a list of what they used, kept outside the system. The admin enters the cost into the system against the booking, as one or more rows (a description and an amount). Only the admin enters or changes costs, and every entry, change and deletion is written to the audit log. The system tracks only the money entered. It does not know what was used.
- A booking's total cost is the sum of its cost rows, and margin is its total price minus that cost. Both are calculated.
- Kept: the laundry shop's machines (`equipment`, `machine_logs`) and laundry orders. The hourly pricing line called materials is a price shown to the customer, not stock, and is unchanged.
- *Legacy pick:* the legacy `job_costs` (cost lines that add up to the job's cost) and `cost_categories` (Materials, Labour, Subcontract, Transport, Other). Brought over in simplified form: admin entry only, with no GL account link, supplier or timesheet link. The legacy suppliers, purchase requests, goods-received notes, tool checkouts and utility readings are dropped.
- *Open (proposed answers in brackets):* whether laundry orders also get cost entries (no, jobs only); whether the manager sees job costs and margin (no, admin only, unless given the capability); whether cost rows carry a category from the legacy list (no, description and amount only); and that the laundry shop's machines stay (yes).

**Decision (D25, confirmed, amended): phone numbers are entered and shown as 10 digits starting 07, everywhere.** Recorded 2026-11-23, owner instruction. Amended later the same day by a further owner instruction: people may enter only the 07 form, never 256.

- The standard form is 10 digits starting with 07, for example 0772123456, shown grouped as 0772 123 456. The +256 form is never shown.
- **Amended: input is restricted to the 07 form.** A person can enter only a number that starts with 07, as 10 digits. The 256, +256 and 00256 forms are not accepted: no + key is offered, a pasted number in those forms is refused with the message "Enter a 10-digit number starting with 07", and the old 9-digit form is refused too. Spaces and dashes typed or pasted as separators are ignored *(proposed, and implemented in the patch: change it if you disagree)*. This replaces the earlier rule that 256 and +256 could be typed or pasted and were converted as the person typed.
- Stored data is the one exception. Legacy numbers such as `+256 772 330 118`, and numbers saved by older app versions, are converted to the 07 form once, by a migration and by the on-open conversion. That is a data fix, not an input rule.
- No 256 is pre-filled in any phone field. Validation is exactly 10 digits starting 07 (it was 9 digits starting 7).
- The standard form is what the apps store and send: profile phone, laundry walk-in phone, booking contact phone, the Mobile Money payer number, saved Mobile Money numbers, and the sign-in, register and code requests. Saved numbers kept by older app versions are converted when the app opens.
- The international form is built only where an outside service needs it: the SMS provider, WhatsApp links and tel links. The backend does it with one function at that point.
- Code status: **done**, under the amended rule. One entry cleaner `normalisePhone` (digits only, 10 at most, no 256 conversion), one strict validator `isValidUGPhone`, one data-fix converter `toStandardPhone` (stored numbers and display only), and the display helpers `phoneUG` and `maskPhone`. The final helper code, the changed-file list and the full revised patch are in section 14. The two phone test files pass in a script run (46 checks), plus a typing simulation: typing `+256772123456` ends as `2567721234`, which the validator refuses, and pasting `0772 123 456` gives `0772123456`. The project's own test suite was not run here because its dependencies are not installed, so run `npm test` in `client-app`.

**Decision (D10, confirmed): cash held by technicians is tracked in a handover ledger.** Recorded 2026-11-23, owner instruction.

1. **Cash belongs to the company.** When a technician collects cash on a job they record the amount received. That is the only way a cash booking becomes paid, and the customer cannot mark cash paid. It is a normal `payments` row with method cash, recorded by the technician (section 12, partial and cash payments).
2. **The ledger is calculated.** Per technician: collected, handed over, and owed (collected minus handed over). The owed figure is worked out from the payment and handover rows, never typed in.
3. **Handover.** The manager or admin confirms each handover, by technician and amount, with a note if needed. Both roles can do it. A handover cannot be edited or deleted. A mistake is fixed by a correcting entry, as with payments.
4. **The technician sees what they owe.** Read only: collected, handed over, owed, and any open dispute. They cannot record a handover.
5. **24-hour flag.** Cash held for more than 24 hours without a handover is flagged to the manager and admin. The 24 hours is a setting the admin can change.
6. **Disputes.** If the amount received differs from the amount expected, the technician must add a note, and a dispute is opened. The booking is not marked paid until the manager or admin resolves it, with a written reason. Both roles can resolve. Every dispute, handover and resolution is written to the audit log.
7. **Not in scope:** technician payouts or earnings. The Cash screen shows only money owed to the company.

**Decision (D20, confirmed): who is told when a booking is made, confirmed, requested or cancelled.** Recorded 2026-11-23, owner instruction. The "operator" the owner mentioned at the start is the manager, who covers dispatch, so no separate operator role exists.

1. **New booking made in the app:** the manager, admin and customer relations are told.
2. **Staff-created or sales-proposed booking:** when it comes in, only the manager is told, since the manager phones the customer. When the manager confirms it, the admin and customer relations are told as well. The sales operator who proposed it and the customer are also told at confirmation.
3. **Cancellation of any booking:** the customer, every assigned technician, the manager, the admin and customer relations are told, and the cancel reason is shown in the notification so customer relations can follow up. A sales operator is told when a booking they proposed is cancelled.
4. **New quote or hourly request:** the manager, admin and customer relations are told.
5. **Customer of a staff-created booking:** told by push if they have the app, otherwise by message (the channel is part of D15).
6. Everything else in the earlier list (assignment, on the way, completed, support messages, abandoned bookings, payment failures) is unchanged. The full event-by-role table is in the D20 impact block in section 13.

**Decision (D9, confirmed): booking stages and the optional inspection step.** Recorded 2026-11-23, owner instruction. The owner confirmed that a fixed-price service booked in the app is Confirmed immediately, even with no payment, and that the rest of the stage table works.

**Booking stages** (`bookings.status`, eight values):

| Stage | Meaning | Moves on when |
| --- | --- | --- |
| Requested | A quote or hourly service still being priced. The request status shows the detail. Appears in the client's Requests, never in Upcoming. | The customer accepts the quote, which makes it Confirmed. A staff-created one goes to Awaiting confirmation instead. |
| Awaiting confirmation | Staff-created or sales-proposed, waiting for the manager's call. | Only the manager confirms it, recording who called and when (D7). |
| Confirmed | The company has agreed the booking and it is live. No technician is needed yet. | The crew is full and everyone has accepted, which makes it Scheduled automatically. |
| Scheduled | Every technician needed has been assigned and has accepted. | The lead technician starts the trip. |
| On the way | The trip has started and live location begins. | The lead taps start work. |
| In progress | The work has started and the clock runs. | The lead taps complete. |
| Completed | The server works out billed time. Final. | None. |
| Cancelled | Records who cancelled and why. D7 decides who may cancel and D11 the fee. | None. |

- **Fixed-price bookings made in the app are Confirmed immediately** when submitted, including when the customer pays nothing up front. Payment is never a condition of confirmation (a deposit is allowed, never required). The manager can still cancel. Staff-created and sales-proposed bookings still wait for the manager's call. A staff-created booking for a quote or hourly service starts as Requested, and once the price is agreed it moves to Awaiting confirmation for the manager's call.
- **Naming clash settled.** The gap analysis used Confirmed for "technician accepted". Confirmed now always means the company agreed, and Scheduled means the crew accepted. A declined assignment goes back to dispatch and the booking stays Confirmed. If a crew member is removed from a Scheduled booking, it drops back to Confirmed automatically.
- **Separate fields for separate clocks:** the booking stage, the request (quote) status, each technician's assignment status (assigned, accepted, declined, in progress, done, removed), the payment status, and cancellation requests (a separate record, D7). The legacy stages Invoiced and Paid are payment facts, not stages. Closed is dropped, because the rating and payment are facts of their own and commission reads "completed and paid" from payments.
- **Fixed list, one gate.** The stage list is fixed in the database and is not admin-editable, because the 24-hour fee rule, commission, notifications and the client's labels depend on the names. Every move goes through one server function that holds the table of allowed moves, and each is written to `booking_status_history` and the audit log. Who moves what: the manager alone confirms (D7); the crew's acceptances make it Scheduled; the lead technician moves On the way, In progress and Completed; cancelling follows D7 and the client's 24-hour rule.
- **Crews.** The lead technician's taps drive the booking stage. Each technician's own start and finish times stay on their assignment row.
- **Client labels.** The client keeps its six labels. Awaiting confirmation shows as Pending, Scheduled shows as Confirmed with the crew's faces, and the others map directly. Laundry orders keep their own five stages, received, washing, drying, ready and delivered, separate from this list.
- **Quote status** is named `quoted` (it was `sent` in the tables), matching the client. The set is requested, inspection required, inspection scheduled, inspected, quoted, accepted, declined, expired.

**Optional inspection step (amends D6).** The owner decided inspection is optional for quote and hourly services, where earlier text made it automatic for every quote service.

- **Decision point.** When a request arrives, the manager or admin reviews it and either sends a quote straight away, or marks **Inspection required** instead. Marking records who, when and a short reason. Fixed-price services never have an inspection.
- **Steps when required:** requested, inspection required, inspection scheduled, inspected, quoted, accepted or declined. The booking stage stays Requested the whole time, because the booking is not agreed until the customer accepts a quote. When not required, the request goes from requested straight to quoted.
- **Inspector.** A technician chosen by the manager or admin, using the same ranked suggestions as dispatch (skill, availability, daily hours cap). A staff member can also inspect when the manager or admin assigns them the inspection (confirmed). Either way they see only the inspections assigned to them. The no double-booking rule covers inspections and jobs together.
- **The technician records the visit in the ERP app.** They start the inspection, then work through the checklist (taken from the legacy inspection template: walk the site and note hazards and access, confirm the scope, photograph the current condition, list tools and materials, note anything unusual), write notes, record measurements, take photos and videos with the camera, and add recommended hours and crew. For an hourly service this is where a technician proposes the hours. Everything is saved on the phone first and syncs later through the offline queue, so a visit with no signal still works. The inspector sees the customer's name, phone and address until they submit, the same rule as jobs.
- **Report.** Submitting the report sets the request to inspected and locks it. The manager or admin can add notes to it afterwards (confirmed). The original stays locked, and each note is saved as an addendum with its author and time. The inspection report is the documented record: checklist, notes, measurements, recommended hours and crew, and the media.
- **Gate.** When inspection is required, a function refuses to send the quote until the report is submitted. The manager or admin can withdraw the requirement before the visit starts, with a reason, and the withdrawal is audited.
- **Visibility (confirmed).** The inspector sees only their own inspections. Manager, admin and customer relations see every inspection with its full report and photos, and customer relations is read only. This is an exception to customer relations not seeing job photos. The customer sees the appointment (the date and who is coming) and, later, the quote, never the internal report. Row level security and the signed links on the private `inspection-media` bucket enforce this.
- **Inspections are free (confirmed).** The customer is never charged for an inspection, and no inspection fee or deposit exists. A customer who declines the quote after an inspection owes nothing for it.

## 13. Impact by application (documentation rule)

**Rule (set by the owner, 2026-11-23):** every decision, already made or still to come, is written up here for all four applications, so the client app is not the only one considered. Each decision gets the same four rows, covering **layout and design** and **architecture and logic**:

- **Client app** (`client-app/`, Expo, customers)
- **Web app** (`admin-web/`, desk-based roles: admin, manager, customer relations)
- **Backend** (`backend/`, Supabase, one Hono `api` function plus separate functions)
- **ERP app** (`erp-app/`, Expo, all staff, screens shown by role; does not exist yet)

Each decision also records what it pulls from the **legacy ERP**, and what the **client code and Phase 2 documents** already say. Items marked *(proposed)* are my reading and are not yet confirmed. When a decision is added to sections 1 to 12, its impact block is added here in the same step, and `Conversation_Transcript.md` is extended.

**Where things stand today (read from the code, 2026-11-23):** the client app is built against a REST contract and runs on mock data. `admin-web` is on mock data, has no router and no Supabase library, and holds two hard-coded demo accounts. `backend/` is a config file only. `erp-app/` does not exist. The closest existing design for the ERP app is `Implementation Phase 2 - Technician Mobile App.md` (an Expo app with a shared status machine, an ordered offline action queue, a version gate and a customer-contact rule), plus `Technician Workspace (ERP)`, which was written for a web workspace and must be adapted.

### D1. One Hono entry point for the client app (confirmed)

*Legacy pick:* the old server's layering (routes, services, repositories, one validation schema per route, unknown fields rejected) is the model for how the Hono function is organised. Its `X-App-Id` header and per-app scope idea carries over for staff apps (L10). *Client docs:* Stage 4 section 4 lists the paths the client already calls and the error shape `{ error: { code, message } }`, with 401 only for a missing or expired token.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | None. | Keeps `src/lib/api/client.ts` and its contract. The change is the base address and switching each mock off (Stage 4 section 7). About a dozen calls are wired today. Every other mock store (reviews, tickets, chat, notifications, wallet, plans, quotes, referrals, receipts) needs its own route under the same contract. No Supabase library is added. |
| Web app | None. | Add the Supabase library for sign-in, reads and live updates, with RLS in charge. Rule-bearing writes (quotes, assignment, cash corrections) call the Hono function or a separate function. Remove the demo accounts. |
| Backend | n/a | One `api` function holds every route the client calls. Stage 4 had catalogue reads on PostgREST; under D1 they sit behind Hono too. `_shared` holds the form engine, pricing, status rules and push sender. Webhooks, cron and database-triggered functions stay separate. |
| ERP app | None. | Reads and live updates through the Supabase library, sensitive writes (start, complete, cash, assignment) through functions. Every queued write carries an idempotency key, matching the client's header and the legacy sync outbox (L20). |

### D2. Expo push service (confirmed)

*Legacy pick:* editable notification wording per event and channel with de-duplication (L18, migrations 014, 017, 024) becomes the template source for push text. *Client docs:* Stage 4 section 6.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | None. Notification preferences and quiet hours screens already exist. | Already on `expo-notifications` (`src/lib/push.ts`). It registers its Expo token through `POST /me/push-tokens`. Needs a development build to test remote push. Android channel ids must not be renamed after release. |
| Web app | A notification bell with unread count in the top bar *(proposed)*. | Reads the `notifications` table with live updates. No web push at launch; the legacy portal used web push, which this decision does not cover. |
| Backend | n/a | Database webhook calls a send function. It applies preferences and quiet hours, sends in batches to Expo, checks receipts later and deletes dead tokens. Firebase supplies only the Android key. |
| ERP app | Critical channel for job assignment *(proposed)*. | A second push client with its own Expo token rows, its own package registered in Firebase and EAS credentials. Needs a development build. Android first, iPhone when an Apple account exists. |

### D3. Password sign-in at launch (confirmed)

*Legacy pick:* no open sign-up, invite codes that carry the role, and admin device reset (L10). Login by name or email plus password with refresh. *Client docs:* Stage 4 sections 4 and 5.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | The Google button stays a placeholder. The phone code and two-step sign-in screens exist but cannot work until an SMS provider is chosen, so their launch wording needs deciding *(proposed)*. | Phone or email plus password. Phone numbers are not verified in production at launch. Device list and login history are fed by backend records. |
| Web app | Replace the demo sign-in with a real one. Add an invite-code sign-up page and a "deactivated" state. | Staff only. A customer account is refused. Role comes from the profile. |
| Backend | n/a | Supabase Auth with a trigger that creates a customer profile. A redeem-invite function assigns the staff role. Password attempts limited to five per ten minutes. Session and device tables. SMS later. |
| ERP app | Sign-up with invite code, then screens by role. | Same accounts as the web app. Deactivated staff are signed out. Admin can reset a device. |

### D4. Existing services and forms are kept (confirmed)

*Legacy pick:* versioned job checklists per service (L2, migration 025) follow the same pattern as forms. *Client docs:* Stage 3 sections 3 and 4.4 (form engine), `form-schemas.ts`.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | No change for existing services. New services are drawn by the same form engine, same nine field types and layouts. | Reads services and forms from the server instead of `src/config/services.ts`. The hard-coded services become seed data. Only a new field type needs an app update. |
| Web app | New forms builder (sections, nine field types, conditional rules, version history) and an active toggle, in the client's look. The current Services page is a global rate card and is replaced. | Edits create a new form version. Bookings show the stored snapshot (the Bookings page already has a scope facts area). |
| Backend | n/a | `service_form_definitions` and `booking_form_snapshots`. Answers are validated on create booking. Seed the existing services and forms. Deactivating hides a service and never deletes. |
| ERP app | Job detail shows the booking's answers, read only, with the same form engine. | A copy of the form engine in `erp-app/` (no shared package, see section 2). Technicians see answers only for their assigned jobs. Editing forms stays on the web *(proposed)*. |

### D5. A real categories table (confirmed)

*Legacy pick:* none. The old system had a service with a method and a price, and no category tree. *Client docs:* `src/config/service-categories.ts` (seven categories, sub-category support, an `active` flag, an inherited form).

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | The Services tab keeps its twin cards by category. | Categories come from the server. A deactivated category hides its services. |
| Web app | Categories manager (add, rename, reorder, image, sub-categories, deactivate). The service form has two separate fields, "Category (what customers see)" and "Trade (dispatch)". | Admin only manages categories. |
| Backend | n/a | `categories` table with `parent_id`. Each service has one `category_id` and one `required_skill_id`. Catalogue served through Hono, images in a public bucket. |
| ERP app | The category is a label on a job. | The trade, not the category, decides who can be dispatched. No category editor in the ERP *(proposed)*. |

### D6. Pricing: fixed, hourly, quote (confirmed)

*Legacy pick:* the legacy `services` table already has a method ("Fixed price") and a price. Its job stages begin with Inspection and Quoted. Costing and PDF documents (L4, L5) are later releases. *Client docs:* `src/lib/pricing.ts`, `src/config/pricing.ts`, `src/store/quotes.ts` and the booking details step, which asks "How many cleaners?" and "How many hours?" today.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | **Changes.** Remove the cleaners and hours pickers for hourly services and show the rate per hour of service. Button wording follows the type (for example Request quote). Hourly and quote requests appear in Bookings → Requests and never in Upcoming. A screen or sheet to confirm a returned quote *(proposed)*. Pay now appears only for fixed-price services. | The `pricingMode` field (`hourly` or `quote`) gains `fixed` and comes from the server. Tiers, materials, add-ons, frequency discounts, promos and 18% VAT stay, with values from the server. The existing "Price updated" sheet stays, since the server is the source of truth. |
| Web app | **Changes.** The Services page becomes per-service: pricing type, price or rate. The global rate card becomes admin-editable pricing settings. New Quotes queue: requests, quote preparation (hours and crew), send, liaison notes. Bookings table shows type and quoted hours. | Switching a service's type is an admin and manager action with a warning that past bookings keep their type and price. |
| Backend | n/a | `services.pricing_type` and `price`. `quotes` table. The server recomputes every price. Payment is gated: only fixed price is payable at booking, others after the customer confirms the quote. A deposit is a partial payment row. Crew size is set during quoting or dispatch. |
| ERP app | Quote preparation screen for the manager (hours, crew). A technician may propose hours *(proposed)*. | The technician timer records real time for overrun alerts and travel time, and does not change the price. Cash recording is unchanged. |

**Open under D6, found on review:** a timed job that runs over its quoted hours. The architecture says the timer only flags it. Whether extra hours can be charged, and by whom, is not decided.

### D6 addition. Optional inspection step for quote and hourly services (confirmed, amended by D9)

*Legacy pick:* the legacy `job-checklist.ts` already starts every job at **Inspection**, with a seeded checklist (walk the site and note hazards and access, confirm the scope, photograph the current condition, list tools and materials, note anything unusual). Its stage order is Inspection, Quoted, Scheduled, In Progress, Completed, Invoiced, Paid. Reuse the checklist as the inspection template and the order as input to D9.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | Requests gets two new statuses, **Inspection scheduled** and **Inspected**, between pending and quoted (`QuoteStatus` has only pending, quoted, accepted, declined today). An inspection appointment card with date and who is coming, with reschedule *(proposed)*. New wording. | Status values come from the server. A notification for the inspection appointment. |
| Web app | The Quotes queue gets an inspection step: schedule, assign an inspector, view findings and photos. | The Send quote button is enabled only once the request is inspected, and only when inspection was marked required (D9). |
| Backend | n/a | Amended by D9: the details moved from `quotes` to the new `inspections` and `inspection_media` tables, and `quotes` keeps an `inspection_required` flag. A function refuses to send a quote before the report is submitted, when inspection is required. Findings and media in the private `inspection-media` bucket. An inspector sees only the inspections assigned to them. |
| ERP app | An inspection appears in Today and Jobs for the assigned person, with checklist, measurements and photos. | Works offline through the action queue. Customer contact shows until the inspection is done, the same rule as jobs *(proposed)*. |

**Settled in D9:** inspections are free, and the inspector is a technician or staff member the manager or admin assigns.

### D7. Roles: outside-app bookings, confirmation by the manager, and a sales operator (decided)

**Decision so far:**

1. Customer relations, manager and admin can create bookings for customers who contact the company outside the app, for example by phone.
2. A booking created by staff or proposed by sales is confirmed only by the manager, who phones the customer to check it is valid. The admin is deliberately not given this work. This replaces the earlier rule that customer relations could confirm their own bookings.
3. A sales operator role is added. They log leads, create proposed bookings for customers they bring in, and follow up. The manager supervises them and confirms their proposals.
4. Cancelling: the manager can cancel any booking. Customer relations can cancel only the bookings they created that are still awaiting confirmation. The admin can cancel any booking as an override. Once the manager has confirmed a booking, customer relations cannot cancel it (confirmed).
5. Cancellation requests (confirmed): when a customer phones to cancel a confirmed booking, customer relations sends the manager a cancellation request with the customer's reason, using a **Request cancellation** button. The manager sees it in a queue and decides. Approved means the manager cancels the booking, recorded as a cancellation from a customer request. Declined needs a note. Both outcomes are told to the requester and logged.
6. Late fee (confirmed): the client's rule applies to phone cancellations as it does in the app. Cancelling more than 24 hours before the visit is free and any payment is refunded. Within 24 hours the deposit amount is kept as a late fee, or added to the customer's account if nothing was paid. The manager cannot waive it. A wrongly charged fee is corrected through the manager's existing payment corrections.
7. Sales operators (confirmed): a sales operator can cancel their own proposals while they are still awaiting confirmation, and uses the same Request cancellation button after the manager confirms. Requests from customer relations and sales operators land in the one manager queue, tagged with who raised them.

8. Staff only handle offline customers' bookings (confirmed): customer relations and sales operators cannot cancel, or request cancellation of, a booking that was made by a customer in the app. They can only cancel or request cancellation on bookings staff or sales created. The manager can still cancel any booking directly, and the admin keeps the override. This reverses the earlier assumption that customer relations could raise a request on an app booking.
9. Sales operator visibility (confirmed): a sales operator sees only their own leads, proposals and customers. Manager and admin see everyone's.
10. Message to the manager (confirmed): when an app customer phones because they cannot book or cancel for themselves, customer relations or a sales operator sends the manager a short note about the booking. Staff first guide the customer through the app. Only the manager can then cancel or change the booking directly. The form of the note is in decision 14.
11. Offline and app customers (confirmed): an offline customer has no app account and is held as a name-and-phone record. Staff book for them and manage those bookings. An app customer books, pays and cancels for themselves.
12. Handover (confirmed): when an offline customer later creates an app account and verifies their phone number, all their upcoming bookings move to them, including confirmed ones. From then on staff cannot cancel or request cancellation on those bookings, and only the customer and the manager can. The creator stays recorded on the booking.

13. Staff booking for an app customer (confirmed): when an app customer phones to book, staff first send them to the app. Only if that fails may staff book for them. Before booking, staff must pick why the app failed from five reasons: couldn't find the service, got stuck at payment, didn't understand a screen, no smartphone or data, the app showed an error. A free-text line is always available. The booking is marked staff-created and the manager still confirms it by phone. The reasons are counted for the manager and admin, so repeated problems point to a UI fix or a training session. Staff can cancel such a booking while unconfirmed and request cancellation once confirmed, since the customer asked them to act (confirmed). The handover in decision 12 does not apply, because the customer already has an account.
14. Message to the manager, detail (confirmed): this refines decision 10. Staff pick one of three reasons: can't book in the app, can't cancel in the app, wants to change the time. A free-text box is always there, to add detail to any reason or to give a different one, so there is no separate "Other" choice. The note is tied to the booking, or to the customer's record when there is no booking yet. It lands in the manager's queue with a push, and the manager marks it handled. It cannot change a booking.
15. Sales commission (confirmed): earned only on a job that is both completed and paid, so a cancelled booking earns none. It is a flat fee, the same for every service, set by the admin. The fee is to be reviewed later. Once earned it stays even if the job is refunded later. It is worked out automatically. The manager approves the list, the admin can see and adjust it before paying, and the admin pays. It is approved and paid monthly, and goes to the operator who proposed the booking (confirmed).
16. Accountant role (confirmed): skipped for now. The admin pays commission and the admin and manager already handle payments and corrections. If someone is hired later, the role would be read-only finance.
17. Laundry operator (confirmed): the laundry shop is a separate branch under the company. The laundry operator runs everything there: orders and machines. (The shop's own stock was removed by D24.) This matches the role already in this file. Manager and admin can see all of it, read only. Neither can change laundry records, because they do not know what is happening at the shop. Only the laundry operator changes them (confirmed).
18. Storekeeper (superseded by D24): this role, mapped to the store manager, is removed together with the main store and all inventory. Issuing materials to technicians no longer exists.

D7 is now fully decided, and every proposed item above has been confirmed.

*Legacy pick:* the old CSR role could propose, confirm and close orders (migrations 022, 023, 026). Orders had a source (website, salesperson, admin, other), a proposed-by, a confirmed-by with time, a mandatory cancel reason, and a share token for a read-only link. Take the source, creator, confirmer and cancel reason fields. Do not take the old rule that the CSR confirms any order. *Client docs:* the client's booking status is only upcoming, completed and cancelled, so a staff-created booking awaiting confirmation needs a status the client can show.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | Almost none. A booking made by staff shows a small "Booked by Gabfix support" label *(proposed)*. A customer with an account sees it in Upcoming once confirmed, and may see it as awaiting confirmation until then *(proposed)*. | The booking arrives through the normal booking read route. A customer with no account never sees it. Nothing about booking creation changes in the client. |
| Web app | New "Create booking" screen for customer relations, manager and admin: find or create the customer (name and phone), choose service, address and time, fill the service form with the same form engine, then save. Booking list shows source and creator. A "Waiting for confirmation call" queue for the manager, with a Confirm button (records who called and when) and a Cancel button that asks for a reason. Customer relations see the status but have no confirm button, and get a Cancel button only on their own bookings that are awaiting confirmation. The admin sees Cancel on every booking, labelled as an override and with no confirm button. New Sales section for the manager: sales operators, their leads, proposals and customers. Sales operators do not use the web app *(proposed)*. | The client's form engine is copied into the web app (section 2) and is used to fill forms on the customer's behalf. Fixed-price staff bookings go to confirmation. Quote and hourly services start a quote request instead, as in D6. |
| Backend | n/a | `bookings` gets `source` (app or staff) and `created_by`. Add `confirmed_by`, `confirmed_at`, `cancelled_by` and `cancel_reason`, taken from the legacy lifecycle. The server validates the form, recomputes the price and creates the booking, since the phone does not make the id here. Add `confirmation_called_at` (when the manager phoned the customer). `source` takes app, staff or sales. Row level security: only the manager capability can confirm. Cancelling is allowed for the manager and admin on any booking, and for customer relations only where `created_by` is themselves and the status is still awaiting confirmation. The cancel reason is mandatory. Sales operators can create bookings and leads only as themselves. Walk-in customer records hold name and phone only, and carry `brought_in_by` (the sales operator, when there is one). New tables *(proposed)*: `leads` (id, owner, name, phone, notes, status, created_at) and `lead_followups` (id, lead_id, by, note, due_at, done_at). Every staff-created booking, confirmation and cancellation is written to the audit log. Capabilities: create-booking for customer relations, manager, admin and sales operator, confirm-booking for the manager only, cancel-any-booking for the manager and admin, cancel-own-unconfirmed for customer relations, and manage-sales for the manager. The Sales operator is a new role value and a new invite role. |
| ERP app | The same create-booking flow for customer relations and manager, with screens shown by role. New sales screens for the sales operator, taken from the legacy portal: Dashboard, Leads, Proposals and Follow-ups. The manager gets the confirmation-call queue here too. | Same server function as the web app. Works online only at first *(proposed)*, since staff creating bookings sit at a desk or on a call. Sales operators work in the field, so lead capture should survive poor signal through the same ordered queue technicians use *(proposed)*. |

**D7 addition: cancellation requests (confirmed).**

*Legacy pick:* the old ERP cancelled orders from one manager-only route (`POST /api/orders/:id/cancel`, capability `cancel_orders` held by owner and manager), with a mandatory reason, an audit entry, and a block once a job is Completed. Keep all four. Its `ConcernsInbox` (a manager inbox of open items with a resolve-with-note step) is the template for the request queue. The old plan said it sent no customer notification on cancellation; we do notify (see knock-on effects). *Client code:* the client already has a cancel sheet, stores `cancelReason`, `cancelledAtISO`, deposit refunded and late fee, and its terms say free cancellation more than 24 hours before the visit, otherwise the deposit is kept as a fee. Nothing in the client lets a customer "request" a cancellation, because the customer cancels directly.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | No new screen. When a request is approved the booking shows as cancelled with the reason "Cancelled at your request", and the customer gets a push. The existing refund and late fee lines show on that booking, using the same 24 hour rule the app already applies. | Read-only. The client keeps cancelling directly for itself. It only needs to show cancellations that staff made, so `cancelledBy` is read from the booking. |
| Web app | A **Request cancellation** button on every confirmed staff-created booking for customer relations (never on bookings the customer made in the app, where a **Message manager** button shows instead) (sales operators use the ERP app, not the web app), opening a short form with the customer's reason. The manager gets a "Cancellation requests" queue next to the confirmation-call queue, showing the booking, customer, reason, who asked and when, with Approve (cancels the booking) and Decline (note required) buttons. The admin sees the queue read-only. Staff notes to the manager appear in the same queue area. | Calls one server function that creates the request, and another that decides it. Approving runs the same cancel path as the manager's direct cancel. |
| Backend | n/a | New table `cancellation_requests`: id, booking\_id, requested\_by, reason, status (pending, approved, declined), decided\_by, decided\_at, decision\_note, created\_at. One pending request per booking. Only the manager capability may approve or decline. Approving sets `bookings.status` to cancelled with `cancelled_by` and `cancel_reason`, marks the source as a customer request, and applies the 24 hour late fee rule (confirmed, no waive option): the server works out `refund_amount` and `late_fee` from the visit start and the time the request was created, not the time the manager approved it, so a slow approval cannot change the fee. The client works these out locally today, so with D1 the server becomes the source of truth. Blocked once the job is completed, as in the legacy rule. Every request and decision goes to the audit log. New staff note to the manager (`staff_notes`, proposed): id, booking\_id (optional), customer\_id, written\_by, reason (cant\_book, cant\_cancel, change\_time), message (free text, always available), created\_at, handled\_by, handled\_at. `bookings` gets `app_failure_reason` (five values, plus free text) when staff book for an app customer, required before such a booking can be saved. New `commissions` (proposed): id, booking\_id, sales\_operator\_id, amount (the admin's flat fee at the time it was earned), earned\_at (when the job is completed and paid), status (earned, approved, paid), approved\_by, approved\_at, adjusted\_amount, adjusted\_by, paid\_by, paid\_at. A refund never deletes it. The flat fee is a single admin setting. It cannot change a booking. Handover (decision 11): `bookings` gets `owner` (staff or customer), and when a phone number is verified on a new app account, a server function matches it to the offline customer record, links the record to the account and moves all that customer's upcoming bookings to the customer. Row level security uses `owner` to remove staff cancel and request rights. Requests are accepted only on confirmed bookings whose `source` is staff or sales and whose owner is still the staff side (see handover, decision 11), never on app-made bookings. New capabilities: request-cancellation (customer relations on staff-created bookings, and sales operator only on bookings they proposed), cancel-own-unconfirmed (customer relations and sales operator) and decide-cancellation (manager). |
| ERP app | The same button and form for customer relations, shown only on confirmed bookings that staff created. The sales operator sees Cancel on their own proposals that await confirmation and Request cancellation on their confirmed ones (staff-created only; app-made bookings never show these buttons), with the customer's reason, and is told the decision. The manager gets the same queue with a push when a request arrives. | Same server functions as the web app. Online only, since it is a phone-call task. On a booking the customer made in the app, staff see a **Message manager** button instead, which sends the manager a short note (decision 10). |

**Knock-on effects on later decisions (to be handled when we reach them):**

- **D9, booking stages (settled, see the D9 decision):** needs a stage for a staff-created or sales-proposed booking awaiting the confirmation call. The legacy order lifecycle calls it Proposed. The gap analysis list already uses "Confirmed" to mean the technician accepted, which clashes with the manager's phone confirmation, so the two stages need different names. Also decide whether a customer-made booking needs confirmation too, or only staff-created ones.
- **D20, notifications:** the manager is told about new staff-created and sales-proposed bookings awaiting a call. Because the admin is not to be loaded with this, the admin should not receive these alerts *(proposed, this changes the "admin gets everything the manager gets" line)*. Customer relations and sales operators are told when a booking they created is confirmed or cancelled *(proposed)*. The customer is told by push if they have the app, otherwise by message.
- **D11, deposits and fees (decided here):** the client's rule (free more than 24 hours before the visit, otherwise a late fee equal to the deposit, added to the account if unpaid and settled before the next booking) also covers phone cancellations, with no manager waive option. Still to settle in D11: the fee is measured from when the customer phoned (the request time), *(proposed)*; and a customer with no app account has the unpaid fee held on their name-and-phone record and collected when they next book *(proposed)*. The mismatch of rule per service type (quote and hourly services have no deposit until the quote is accepted) also needs a rule in D11.
- **D9, booking stages (settled, see the D9 decision):** the request is not a booking stage. It is a separate record, so the booking stays confirmed until the manager approves.
- **D20, notifications:** adds the manager's cancellation-request alert, the requester's decision alert, and the customer's cancelled alert. The technician's existing 'job cancelled' alert fires on approval if one was assigned.
- **D17, release order:** the gap analysis put sales and commissions in the third release. You called sales critical, so the sales role, leads and proposals move earlier. Commission can still follow later.
- **D6, quotes:** a sales operator may also bring in a quote or hourly request. It goes through the same inspection and quote path, with the manager preparing the quote.
- **D15, guests and receipts:** customers booked by staff may have no app. Receipts and confirmations need another route, such as a message or a share link like the legacy share token.
- **D8 in the gap analysis, remaining role questions:** sales, accountant, and a proposal flow all depend on how this works.
- **D11 and D10, money:** staff-created bookings may be paid in cash or by mobile money recorded by staff, so payment recording must work for customers with no account.
- **D15, guests and receipts (from the offline and app customer split):** an offline customer has no app, so confirmations, receipts and the handover notice go by message or a share link. When such a customer verifies a phone number in the app, the handover in D7 decision 11 runs.
- **D20, notifications:** adds the staff note to the manager (D7 decision 10) as a manager alert, and tells the customer by push once their bookings are handed over *(proposed)*.
- **D9, booking stages (settled, see the D9 decision):** a booking's owner changes on handover (staff to customer). The stage does not change, so an unconfirmed proposal stays unconfirmed and the manager still makes the confirmation call.
- **D17 and the commission decision:** a sales operator loses cancellation rights on a handed-over booking. Whether they still see it read-only, so that their commission can be shown to them, is not yet decided and is a small leftover from D7 *(open)*.
- **Customer search (section 16):** for a sales operator, search returns only the customers they brought in. Customer relations, manager and admin keep searching every customer.
- **D9, booking stages (settled, see the D9 decision):** a booking staff made for an app customer after the app failed is staff-created, so it goes through the same awaiting-confirmation stage.
- **D10 and D11, money:** commission is paid by the admin outside the customer payment flow, and a later refund does not take it back. The flat fee is an admin setting.
- **D17, release order:** the app-failure reasons and the staff note are small, so they ship with the staff booking screen. Commission can follow later, as already noted.
- **D20, notifications:** adds the manager's alert for a staff note, the manager's monthly commission list ready to approve, and the admin's list ready to pay *(proposed)*.
- **Inventory (store manager), superseded by D24:** the store manager, stock and the materials issue screen are removed.

### D24. Store and inventory removed, job costs added (confirmed)

*Legacy pick:* `job_costs` and `cost_categories` (migration 010), simplified. The legacy suppliers, purchase requests, goods-received notes and tool checkouts are dropped. *Client docs:* none. The client shows no stock.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | No change. The hourly "materials" price line stays, because it is a price and not stock. | None. |
| Web app | No store or stock pages. A **Job costs** panel on a booking, for the admin only: the list of entries, an add entry form (description, amount), the total cost and the margin. The manager and customer relations do not see it *(proposed)*. | Admin alone writes, enforced by row level security. Every change goes to the audit log. |
| Backend | n/a | New `job_costs` table. Remove `stores`, `staff_stores`, `inventory_items` and `stock_movements`. `equipment` and `payments` lose `store_id`. Remove the low stock alert and the store manager role and its security rules. New capability for recording job costs, admin only. |
| ERP app | No store manager screens and no stock screens. The laundry operator keeps orders and machines. Technicians have no materials list: they bring a paper list to the admin. | The role list shrinks by one. |

### D25. Phone numbers in the 07 form (confirmed, amended: 07 only)

*Legacy pick:* none. The legacy system stored phones as free text such as `+256 772 330 118`, so any legacy numbers brought over must be converted once, by a migration, because entry no longer converts 256 forms. *Client docs:* `Part 2, P2b` set the old 9-digit rule, now replaced.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | The +256 chip is gone from every phone field. The placeholder is 07XX XXX XXX. The error reads "Enter a 10-digit number starting with 07". Sign-up and reset go back to the number-only keyboard, since no + key is needed (amendment). Saved numbers and the payment-step number show as 0772 123 456, masked as 0772 ••• 773. The code screen placeholder is 07•• ••• •••. | One normaliser and validator in `utils/validation.ts` and one formatter in `utils/format.ts`, used by every screen. **Amendment (done, see section 14):** the entry rule accepts only exactly 10 digits starting 07 and refuses 256, +256, 00256 and the 9-digit form. The field cap is 14 characters, which is 10 digits plus room for pasted separators. `toStandardPhone` converts old forms only for stored numbers (saved drafts, the saved profile, saved Mobile Money numbers) and for display, never for entry. The login screen no longer treats a leading + as a phone number. Sign-in sends the standard form when the field looks like a phone. Saved numbers are converted on load. **Changed files:** sign-in, sign-up, reset, code, booking location, booking review, quote request, profile edit, wallet sheet, payment methods and payment screens, and the shared helpers and tests. |
| Web app | Phones show as 0772 000 111. The mock data was updated. | The same entry rule applies to any phone typed by staff: 07 form only. Search takes the 07 form, with spaces and dashes ignored, and refuses +256 with the same message. |
| Backend | n/a | Phone columns hold the standard form. Edge functions validate exactly 10 digits starting 07 and refuse anything else with the same message, so a direct call cannot store a 256 form. A one-time migration converts legacy numbers. The +256 form is built only for the SMS provider and WhatsApp. |
| ERP app | The same input rule, 07 form only, for walk-in customers, leads and staff-created bookings. A technician sees the customer phone as 0772 123 456, with tap to call. | Copy the same helper, since the apps keep independent folders. |

### D9. Booking stages and the optional inspection step (confirmed)

*Legacy pick:* the legacy order lifecycle (Proposed, Inspection, Quoted, Scheduled, In Progress, Completed, Invoiced, Paid, and Closed after feedback) is mapped to the eight stages: Proposed becomes Awaiting confirmation, Invoiced and Paid become payment facts, and Closed is dropped. The legacy inspection checklist is reused as the inspection template. *Client docs:* the client shows Pending, Confirmed, On the way, In progress, Completed and Cancelled, with "in progress" derived from the tracking phase, and `QuoteStatus` has only pending, quoted, accepted and declined.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | The six labels stay. Awaiting confirmation shows as Pending and Scheduled as Confirmed, with the crew's faces. A fixed-price booking shows as Confirmed straight after it is submitted. Requests gets three new wording steps before Quoted: **Inspection needed**, **Inspection scheduled** and **Inspected**. An inspection appointment card with the date and who is coming (confirmed: the customer sees the appointment and the quote, never the internal report), with a reschedule option *(proposed)*. | Stage and request status values come from the server, and an unknown value must fall back safely. Live tracking keeps deriving On the way and In progress from the server stage. |
| Web app | On each quote or hourly request, two actions for manager and admin: **Send quote** and **Require inspection**. Once required: schedule it and assign an inspector from ranked suggestions, then read the submitted report with its photos and videos, read only. **Send quote** is disabled until the report is submitted. Booking lists filter by stage. The manager's confirmation-call queue is the Awaiting confirmation stage. | Every stage move calls the one server function. Customer relations reads the whole inspection report and its photos, read only. Manager and admin can add notes to a submitted report. |
| Backend | n/a | New tables `inspections`, `inspection_media`, `inspection_addenda` and `booking_status_history`. The stage function holds the allowed moves and writes the history and the audit log. Fixed-price app bookings are created as Confirmed. The booking moves to Scheduled automatically when the accepted assignments equal `technicians_needed`, and back to Confirmed if one is removed. A function refuses to send a quote before the report is submitted when inspection is required. A private `inspection-media` bucket with signed links. Row level security: the inspector sees only their own, manager, admin and customer relations see all, and customer relations is read only. |
| ERP app | An inspection appears in Today and Jobs for the assigned technician or staff member as its own card. The inspection screen has the checklist, notes, measurements, a camera for photos and videos, recommended hours and crew, and a **Submit report** button. The lead technician's job screen has **Start trip**, **Start work** and **Complete**. Every assigned technician has **Accept** and **Decline**. The manager's screen has the confirmation-call queue and the Require inspection action. | Inspection capture works offline through the action queue, with photos queued for upload and original timestamps kept. Stage taps go through the stage function and carry idempotency keys. |

**Knock-on effects on later decisions:**

- **D20, notifications:** the manager and admin are told of a new quote or hourly request. The inspector is pushed when assigned. The customer is told when an inspection is scheduled and when the quote is ready. The manager is told when a report is submitted. Stage changes drive the customer's confirmed, technician assigned, on the way and completed messages. The accept window for technicians is still to be set *(proposed)*.
- **D11, deposits and fees:** the 24-hour rule is measured against the scheduled start of a Confirmed or Scheduled booking. Whether a fee applies after On the way is still to settle. Inspections are free (D9), so no fee or deposit is ever taken for an inspection visit.
- **D6, hourly pricing:** a technician's proposed hours come from the inspection report, when there is one.
- **D7, commission:** earned only when a booking is Completed and paid, read from the stage and the payments.

### D10. Cash held by technicians (confirmed)

*Legacy pick:* the legacy payment methods table sends cash to a cash-on-hand account, which supports a company-owned view of cash. The old finance ledger itself (double entry) is a later release (D17). *Client docs:* Technician Workspace sections 5, 6.5 and 7 (confirm cash screen, remittance by operations, dispute on a difference, cash confirmed before a job can complete), and the admin web Cash page, which already has tabs for All, Pending, Remitted and Disputes and a reminder setting.

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | No new screens. A cash booking shows "Pay UGX X in cash" and becomes Paid only after the technician confirms. A booking with an open cash dispute shows a neutral "Payment being checked" state *(proposed)*. | Cash can only be collected after the service, never at booking, as the client already enforces. The wallet and receipt read confirmed cash from `payments`. |
| Web app | The existing Cash page becomes database backed, with the same tabs. It lists each technician's collected, handed over and owed. Buttons: **Confirm handover** (amount, note) and **Resolve dispute** (reason required), for the manager and admin. A flag on cash older than 24 hours. The reminder setting becomes the admin-editable 24-hour limit. | Reads the ledger view with live updates. Writes go through functions, not direct table writes. |
| Backend | n/a | Tables `cash_handovers` and `cash_disputes`, and a ledger view per technician (collected from cash `payments` rows, handed over from `cash_handovers`, owed as the difference). A confirm-cash function checks the amount, opens a dispute when it differs, and refuses to mark the booking paid until the dispute is resolved. Handovers are append only. A scheduled job flags cash held beyond the limit. Row level security: a technician reads only their own rows and writes only their own cash payments. Audit log entries for every handover and dispute. |
| ERP app | **Confirm cash** on the job (amount to collect, amount received, a note required on a difference). A **Cash** tab for the technician, read only: collected, handed over, owed, open disputes. Manager and admin see the handover and dispute screens. | Cash confirmation works offline through the action queue with an idempotency key, and the booking stays unpaid until it syncs. A job with cash due cannot be completed until the cash is confirmed (Technician Workspace section 7) *(proposed)*. |

**Knock-on effects on later decisions:**

- **D11, late fees and tips:** a tip paid in cash would enter the same ledger. Who receives a tip is still to decide. A late fee on a cash booking is charged to the customer's account, as the client does.
- **D20, notifications:** adds the cash events for the manager, admin and technician (listed in the notification events).
- **D7, commission:** earned only when a booking is completed and paid, so a booking whose cash dispute is open earns no commission until it is resolved.
- **D17, legacy scope:** the full double-entry ledger and cash flow reports stay in a later release. D10 gives only the technician cash ledger.
- **D12, payment gateway:** unaffected, since this covers cash only. Mobile money confirmations stay with the gateway.
- **D22, admin web:** the Cash page is kept and extended, not replaced.
- **Laundry:** cash taken at the laundry shop is recorded by the laundry operator. Whether it needs its own handover to the manager is not decided *(open)*.

### D20. Who is told when a booking is made (confirmed)

*Legacy pick:* editable message templates per event and channel (in-app and push), with de-duplication, from the legacy notifications (migrations 014, 017, 024, 026). The legacy order events `order_proposed`, `order_proposed_shared` and the confirmed and cancelled events map to the staff-created and sales-proposed events here. Take the template table and the de-duplication key, keep the wording admin-editable (L18, a later release). *Client docs:* Stage 4 sections 5.4 and 6 (quiet hours, critical and routine pushes) and the client's notification preferences screen.

**Event by role** (yes means the role is notified):

| Event | Customer | Technician | Customer relations | Sales operator | Manager | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| New booking made in the app | confirmation | | yes | | yes | yes |
| New quote or hourly request | | | yes | | yes | yes |
| Staff-created or sales-proposed booking comes in | | | | | yes | |
| Staff-created or sales-proposed booking confirmed | yes | | yes | yes (proposer) | decided it | yes |
| Booking cancelled (with reason) | yes | yes (assigned) | yes | yes (proposer) | yes | yes |

| App | Layout and design | Architecture and logic |
| --- | --- | --- |
| Client app | No new screens. The notification list and the notification preferences screen already exist. A cancellation message shows the reason. A booking confirmed by staff reads "Gabfix confirmed your booking" *(proposed)*. Cancellation and confirmation pushes are critical, so quiet hours do not hold them *(proposed)*. | Reads the same `notifications` rows through its existing routes. A customer with no account gets a message instead (D15 sets the channel). |
| Web app | The top-bar bell now serves three desk roles. Each sees only the events in the table for their role. A cancellation entry shows the reason and opens the booking. Customer relations sees a filter for new bookings and quote requests *(proposed)*. | Reads `notifications` with live updates. No web push at launch (D2). |
| Backend | n/a | A notification rule table maps each event to its roles, so the table above is data and not code *(proposed)*. Database triggers on `bookings`, `quotes` and `booking_status_history` fire the send function. Staff-created bookings notify the manager on insert, and the rest on the move to Confirmed. A cancellation notifies the assigned technicians through `job_assignments`. Each notification stores the booking id and the cancel reason. De-duplication key per event, booking and recipient. The audit log is unchanged. |
| ERP app | Same events as the web bell, shown by role. The sales operator sees confirmed and cancelled for their own proposals. A technician sees a cancelled job leave Today with the reason. | Push to the staff Expo token. Assignment and cancellation pushes use the critical Android channel *(proposed)*. A cancelled job that was downloaded for offline use is marked cancelled on the next sync. |

**Knock-on effects on later decisions:**

- **D15, guests and receipts:** the channel for a customer with no app (SMS, WhatsApp or email) must be chosen. Until the SMS provider exists (D12), the manager phones the customer, which fits the confirmation call.
- **D12, SMS provider:** needed for messages to customers with no app. Until then these go out by the manager's call or by WhatsApp from the staff member.
- **D13, support conversations:** a new support message notifies customer relations, and a staff reply notifies the customer. There is no technician chat in the first release.
- **D10, cash held by technicians:** a cash dispute and an unconfirmed cash amount need events for the manager and admin.
- **D11, late fees:** a late-fee charge on a cancellation adds a line to the customer's cancellation message.
- **D21, live tracking:** the technician on the way event is already in the customer list, and an alert for no location update for three minutes goes to the manager.
- **D18, laundry:** if laundry is walk-in only, the customer laundry status pushes in the list are dropped.
- **Quiet hours:** which of these events are critical and so skip quiet hours is proposed above and needs confirming.

### Conflicts and gaps found on review

1. **Fixed in this file:** the stack table, overview and section 5 said all apps read and write the database directly, which D1 changes for the client. The hourly billing paragraph still said time is billed rounded up to 15 minutes, which contradicted D6. Stray `\n` characters were in the D6 client-changes paragraph.
2. **Quote status names differ:** the `quotes` table lists `sent` while the flow text and the client say `quoted`. Settled in D9: the name is `quoted`.
3. **Two designs for the technician side:** `Technician Workspace (ERP)` describes a web workspace inside the admin app at `#/tech` with roles admin, operations and technician. `Technician Mobile App` describes a separate Expo app. Our plan is one Expo ERP app for all staff. Use the Technician Mobile App document as the base and adapt both.
4. **Admin web Services page is a single global rate card,** not per service. D6 replaces it.
5. **Client booking status is only upcoming, completed, cancelled,** and "in progress" is derived from the tracking phase. Settled in D9: the client keeps its six labels, mapped from the eight stages.
6. **Secrets in the legacy zip:** `.env`, `_creds.json` and `_login.json` are in the uploaded archive. If they hold real values, change them and keep them out of git.

7. **Phone patch (D25 amendment): resolved.** The first patch converted 256 and +256 as the person typed. After the owner's 07-only decision it was revised and is embedded in section 14. The backend validator and the one-time legacy-number migration still have to be built under the same rule.

### Next: D7, D9, D10, D20, D24 and D25 are decided. The next decision is chosen with the owner from the list at the top of this file. From now on every decision also lists its knock-on effects on later decisions.

## 14. Phone number standard (D25): reference and revised patch

This section holds the phone standard in full, so the code change is not lost between sessions. It matches the D25 decision above (07 only) and the D25 impact block in section 13.

**The rule**

- The only accepted entry is **10 digits starting 07**, for example 0772123456. It is shown grouped as 0772 123 456 and masked as 0772 ••• 773.
- Refused at entry, with the message "Enter a 10-digit number starting with 07, for example 0772 123 456.": 256772123456, +256 772 123 456, 00256772123456, the old 9-digit form 772123456, a number that does not start 07, and anything that is not exactly 10 digits.
- Spaces and dashes typed or pasted as separators are ignored. Any other character, including a + sign, makes the number invalid.
- No 256 is pre-filled in any field. Sign-up and password reset use the number-only keyboard. Every phone field holds at most 14 characters (10 digits plus room for separators in a paste).
- **Stored numbers are the one exception.** Numbers saved by older versions (saved Mobile Money numbers, saved booking drafts, the saved profile) and legacy ERP numbers like `+256 772 330 118` are converted to the 07 form once. That is a data fix, done by `toStandardPhone`, and never an entry rule. Display helpers use it too, so +256 is never shown.
- The international form is built only where an outside service needs it: the SMS provider, WhatsApp links and tel links. In the client app that is `lib/support.ts`, for the company's own support number, which is not a number a person types.

**The three helpers** (in `client-app/src/utils`, copied into the ERP app and the web app because the apps keep independent folders)

| Helper | Where | Use |
| --- | --- | --- |
| `normalisePhone` | `validation.ts` | Every phone field's change handler and every submit. Digits only, at most 10, no conversion. |
| `isValidUGPhone` | `validation.ts` | Every validation check. Exactly 10 digits starting 07, separators ignored. |
| `toStandardPhone` | `validation.ts` | Data fix only: converts stored old forms. Used when saved numbers are loaded, when a saved draft or profile number prefills a field, and by the display helpers. |
| `phoneUG`, `maskPhone` | `format.ts` | Display: 0772 123 456 and 0772 ••• 773. |

The final code of `utils/validation.ts` (phone part) and `utils/format.ts` (phone part):

```ts
/**
 * Ugandan mobile number. The only accepted entry is 10 digits starting with 07, for example
 * 0772123456. The 256, +256 and 00256 forms and the old 9-digit form are not accepted.
 *
 * `normalisePhone` is for entry fields. It keeps digits only (spaces, dashes and other
 * characters typed or pasted are dropped) and never grows past 10 digits. It does NOT convert
 * 256 forms, so a pasted +256 772 123 456 stays invalid and the field shows the error. Partial
 * input is kept as typed, so it is safe to run on every keystroke.
 */
export const PHONE_ERROR = 'Enter a 10-digit number starting with 07, for example 0772 123 456.';

export const normalisePhone = (value: string): string => value.replace(/\D/g, '').slice(0, 10);

/**
 * Exactly 10 digits starting 07. Spaces and dashes used as separators are ignored. Any other
 * character, including the + of an international number, makes the number invalid.
 */
export const isValidUGPhone = (value: string): boolean => /^07\d{8}$/.test(value.replace(/[\s-]/g, ''));

/**
 * Data fix only, never for entry. Converts a number that was stored in an older form
 * (+256..., 256..., 00256... or the old 9-digit form) to the 07 form. Used when saved numbers are
 * loaded from the phone's storage and when showing a stored number, so +256 is never displayed.
 */
export const toStandardPhone = (value: string): string => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00256')) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith('256')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('7')) digits = `0${digits}`;
  return digits.slice(0, 10);
};
```

```ts
/** Stored number -> 0772 123 456. Old stored forms are converted so +256 is never shown. */
export const phoneUG = (value: string): string => {
  const digits = toStandardPhone(value);
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(' ');
};

/** 0772 ••• 773, used on the OTP and reset screens and for saved numbers. */
export const maskPhone = (value: string): string => {
  const digits = toStandardPhone(value);
  if (digits.length < 10) return phoneUG(digits);
  return `${digits.slice(0, 4)} ••• ${digits.slice(7)}`;
};
```

**What changed in the apps** (24 files in the patch)

| Area | Files | Change |
| --- | --- | --- |
| Shared helpers | `utils/validation.ts`, `utils/format.ts` | The three helpers above. Display converts stored forms. |
| Tests | `utils/__tests__/validation.test.ts`, `utils/__tests__/format.test.ts`, `lib/__tests__/support.test.ts`, `store/__tests__/session.test.ts` | The 07-only entry rule, refusal of every 256 form, the data-fix converter, display and masking, and the seeds. |
| Sign-in and sign-up | `app/login.tsx`, `app/sign-up.tsx`, `app/forgot-password.tsx`, `app/otp.tsx`, `lib/api/auth.ts` | No +256 chip. Number-only keyboard on sign-up and reset. One refusal message. A leading + no longer counts as a phone number at sign-in. The code screen placeholder is 07•• ••• •••. |
| Booking | `app/book/[slug]/location.tsx`, `app/book/[slug]/review.tsx`, `app/quote/[slug].tsx` | The +256 chip is gone from the contact, alternate contact, payer and quote fields. Prefill from a saved draft or profile goes through `toStandardPhone`. Field cap 14. |
| Profile and payments | `app/profile/edit.tsx`, `app/profile/payments.tsx`, `app/payment/[id].tsx`, `app/booking/[id]/rate.tsx`, `components/wallet/add-method-sheet.tsx`, `components/ui/input.tsx`, `config/payments.ts`, `store/payment-methods.ts` | Saved numbers seeded as 0772123456 and 0701234567 and shown in the 07 form. Saved numbers from older versions are converted when the app opens. New saves use the entry rule. |
| Support number | `lib/support.ts` | The support number displays as 0752 777 774. The +256 form stays only inside the tel and WhatsApp links. |
| Admin web | `admin-web/src/data.ts` | The 21 mock phone numbers show as 0772 000 111. |

**Applying it.** From the repo root: `git apply phone-standardisation.patch`. The patch was checked against the original repo zip and applies cleanly. A zip of the 24 changed files is delivered with it as `phone-standardisation-changed-files.zip`. Run `npm test` in `client-app` afterwards.

**Still to build under the same rule** (not in this patch): the backend validator in the edge functions (exactly 10 digits starting 07, anything else refused with the same message), the one-time migration of legacy numbers, and the same helpers in the ERP app and the web app's entry fields.

### Appendix A: the revised patch (`phone-standardisation.patch`)

```diff
diff --git a/admin-web/src/data.ts b/admin-web/src/data.ts
index 56f2383..c2229e1 100644
--- a/admin-web/src/data.ts
+++ b/admin-web/src/data.ts
@@ -35,7 +35,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27104',
     customerId: 'cus-001',
     customer: 'Aisha Nakato',
-    phone: '772 000 111',
+    phone: '0772 000 111',
     service: 'Deep cleaning',
     area: 'Ntinda',
     dateISO: '2026-11-20',
@@ -65,7 +65,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27103',
     customerId: 'cus-002',
     customer: 'Brian Okello',
-    phone: '701 442 830',
+    phone: '0701 442 830',
     service: 'Home cleaning',
     area: 'Kololo',
     dateISO: '2026-11-20',
@@ -80,7 +80,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27102',
     customerId: 'cus-003',
     customer: 'Sarah Namusoke',
-    phone: '758 901 244',
+    phone: '0758 901 244',
     service: 'Office cleaning',
     area: 'Nakasero',
     dateISO: '2026-11-20',
@@ -96,7 +96,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27101',
     customerId: 'cus-004',
     customer: 'Peter Ssemakula',
-    phone: '772 118 604',
+    phone: '0772 118 604',
     service: 'Move-in / move-out',
     area: 'Bugolobi',
     dateISO: '2026-11-21',
@@ -123,7 +123,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27100',
     customerId: 'cus-005',
     customer: 'Grace Atim',
-    phone: '703 271 990',
+    phone: '0703 271 990',
     service: 'Home cleaning',
     area: 'Muyenga',
     dateISO: '2026-11-20',
@@ -139,7 +139,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27099',
     customerId: 'cus-006',
     customer: 'Daniel Muwanga',
-    phone: '782 004 217',
+    phone: '0782 004 217',
     service: 'Deep cleaning',
     area: 'Ntinda',
     dateISO: '2026-11-20',
@@ -154,7 +154,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27098',
     customerId: 'cus-003',
     customer: 'Sarah Namusoke',
-    phone: '758 901 244',
+    phone: '0758 901 244',
     service: 'Office cleaning',
     area: 'Nakasero',
     dateISO: '2026-11-19',
@@ -170,7 +170,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27097',
     customerId: 'cus-005',
     customer: 'Grace Atim',
-    phone: '703 271 990',
+    phone: '0703 271 990',
     service: 'Home cleaning',
     area: 'Muyenga',
     dateISO: '2026-11-19',
@@ -186,7 +186,7 @@ export const initialBookings: Booking[] = [
     id: 'GBX-27096',
     customerId: 'cus-002',
     customer: 'Brian Okello',
-    phone: '701 442 830',
+    phone: '0701 442 830',
     service: 'Home cleaning',
     area: 'Kololo',
     dateISO: '2026-11-18',
@@ -205,7 +205,7 @@ export const initialCleaners: Cleaner[] = [
     id: 'cln-001',
     name: 'Rose Nakato',
     initials: 'RN',
-    phone: '772 419 830',
+    phone: '0772 419 830',
     area: 'Ntinda · Kololo',
     rating: 4.9,
     jobs: 428,
@@ -221,7 +221,7 @@ export const initialCleaners: Cleaner[] = [
     id: 'cln-002',
     name: 'Daniel Kato',
     initials: 'DK',
-    phone: '701 882 145',
+    phone: '0701 882 145',
     area: 'Nakasero · Bugolobi',
     rating: 4.8,
     jobs: 312,
@@ -237,7 +237,7 @@ export const initialCleaners: Cleaner[] = [
     id: 'cln-003',
     name: 'Maria Achieng',
     initials: 'MA',
-    phone: '758 220 467',
+    phone: '0758 220 467',
     area: 'Muyenga · Bugolobi',
     rating: 4.9,
     jobs: 265,
@@ -253,7 +253,7 @@ export const initialCleaners: Cleaner[] = [
     id: 'cln-004',
     name: 'Samuel Tumusiime',
     initials: 'ST',
-    phone: '782 604 991',
+    phone: '0782 604 991',
     area: 'Ntinda · Nakawa',
     rating: 4.6,
     jobs: 148,
@@ -270,7 +270,7 @@ export const initialCleaners: Cleaner[] = [
     id: 'cln-005',
     name: 'Esther Nankya',
     initials: 'EN',
-    phone: '703 511 218',
+    phone: '0703 511 218',
     area: 'Kololo · Nakasero',
     rating: 4.7,
     jobs: 196,
@@ -285,7 +285,7 @@ export const initialCleaners: Cleaner[] = [
     id: 'cln-006',
     name: 'Joel Mugisha',
     initials: 'JM',
-    phone: '774 092 633',
+    phone: '0774 092 633',
     area: 'Muyenga · Kabalagala',
     rating: 4.5,
     jobs: 87,
@@ -303,7 +303,7 @@ export const initialCustomers: Customer[] = [
   {
     id: 'cus-001',
     name: 'Aisha Nakato',
-    phone: '772 000 111',
+    phone: '0772 000 111',
     email: 'aisha.n@example.com',
     area: 'Ntinda',
     segment: 'Residential',
@@ -315,7 +315,7 @@ export const initialCustomers: Customer[] = [
   {
     id: 'cus-002',
     name: 'Brian Okello',
-    phone: '701 442 830',
+    phone: '0701 442 830',
     email: 'brian.okello@example.com',
     area: 'Kololo',
     segment: 'Residential',
@@ -327,7 +327,7 @@ export const initialCustomers: Customer[] = [
   {
     id: 'cus-003',
     name: 'Sarah Namusoke',
-    phone: '758 901 244',
+    phone: '0758 901 244',
     email: 'sarah@brightdesk.co.ug',
     area: 'Nakasero',
     segment: 'Office',
@@ -339,7 +339,7 @@ export const initialCustomers: Customer[] = [
   {
     id: 'cus-004',
     name: 'Peter Ssemakula',
-    phone: '772 118 604',
+    phone: '0772 118 604',
     email: 'p.ssemakula@example.com',
     area: 'Bugolobi',
     segment: 'Residential',
@@ -351,7 +351,7 @@ export const initialCustomers: Customer[] = [
   {
     id: 'cus-005',
     name: 'Grace Atim',
-    phone: '703 271 990',
+    phone: '0703 271 990',
     email: 'grace.atim@example.com',
     area: 'Muyenga',
     segment: 'Residential',
@@ -363,7 +363,7 @@ export const initialCustomers: Customer[] = [
   {
     id: 'cus-006',
     name: 'Daniel Muwanga',
-    phone: '782 004 217',
+    phone: '0782 004 217',
     email: 'daniel.m@example.com',
     area: 'Ntinda',
     segment: 'Residential',
diff --git a/client-app/src/app/book/[slug]/location.tsx b/client-app/src/app/book/[slug]/location.tsx
index 4ecaa45..3f650de 100644
--- a/client-app/src/app/book/[slug]/location.tsx
+++ b/client-app/src/app/book/[slug]/location.tsx
@@ -36,6 +36,7 @@ import {
 import { useAddresses, type SavedAddress } from '@/store/addresses';
 import { useAuthUser } from '@/store/session';
 import { colors, font, radius, space, text } from '@/theme';
+import { isValidUGPhone, normalisePhone, toStandardPhone } from '@/utils/validation';
 
 type PropertyType = BookingLocation['propertyType'];
 
@@ -61,9 +62,12 @@ const propertyOptions: { value: PropertyType; label: string }[] = [
 ];
 
 const phoneDigits = (value?: string): string =>
-  (value ?? '').replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '').slice(0, 9);
+  normalisePhone(value ?? '');
 
-const isValidPhone = (digits: string): boolean => /^7\d{8}$/.test(digits);
+/** A number read back from storage (saved draft, saved profile): old forms are converted once. */
+const storedPhone = (value?: string): string => toStandardPhone(value ?? '');
+
+const isValidPhone = (digits: string): boolean => isValidUGPhone(digits);
 
 /** P11 Location and Contact. Writes the draft's `location` field; P12 reviews it. */
 export default function LocationScreen() {
@@ -86,10 +90,10 @@ export default function LocationScreen() {
       access: saved?.access ?? '',
       propertyType: saved?.propertyType ?? 'apartment',
       contactName: saved?.contactName || user?.name || '',
-      contactPhone: phoneDigits(saved?.contactPhone || user?.phone),
+      contactPhone: storedPhone(saved?.contactPhone || user?.phone),
       otherPerson: Boolean(saved?.alternateContactName),
       alternateName: saved?.alternateContactName ?? '',
-      alternatePhone: phoneDigits(saved?.alternateContactPhone),
+      alternatePhone: storedPhone(saved?.alternateContactPhone),
     };
   });
   const [touched, setTouched] = useState<Record<string, boolean>>({});
@@ -184,7 +188,7 @@ export default function LocationScreen() {
     touched.name && form.contactName.trim().length < 2 ? 'Enter the name of the contact.' : undefined;
   const phoneError =
     touched.phone && !isValidPhone(form.contactPhone)
-      ? 'Enter the 9 digits after +256, for example 772 123 456.'
+      ? 'Enter a 10-digit number starting with 07, for example 0772 123 456.'
       : undefined;
   const alternateNameError =
     touched.alternateName && form.otherPerson && form.alternateName.trim().length < 2
@@ -192,7 +196,7 @@ export default function LocationScreen() {
       : undefined;
   const alternatePhoneError =
     touched.alternatePhone && form.otherPerson && !isValidPhone(form.alternatePhone)
-      ? 'Enter the 9 digits after +256.'
+      ? 'Enter a 10-digit number starting with 07.'
       : undefined;
 
   const complete =
@@ -456,14 +460,13 @@ export default function LocationScreen() {
           />
           <Input
             label="Phone"
-            prefix="+256"
             value={form.contactPhone}
             onChangeText={(value) => update({ contactPhone: phoneDigits(value) })}
             onBlur={() => markTouched('phone')}
             error={phoneError}
             helper="We call this number if the cleaner cannot find you."
             keyboardType="phone-pad"
-            maxLength={9}
+            maxLength={14}
             textContentType="telephoneNumber"
             returnKeyType="done"
           />
@@ -488,13 +491,12 @@ export default function LocationScreen() {
               />
               <Input
                 label="Their phone"
-                prefix="+256"
                 value={form.alternatePhone}
                 onChangeText={(value) => update({ alternatePhone: phoneDigits(value) })}
                 onBlur={() => markTouched('alternatePhone')}
                 error={alternatePhoneError}
                 keyboardType="phone-pad"
-                maxLength={9}
+                maxLength={14}
                 returnKeyType="done"
               />
             </View>
diff --git a/client-app/src/app/book/[slug]/review.tsx b/client-app/src/app/book/[slug]/review.tsx
index fb583eb..0c355df 100644
--- a/client-app/src/app/book/[slug]/review.tsx
+++ b/client-app/src/app/book/[slug]/review.tsx
@@ -57,7 +57,8 @@ import { useBookings } from '@/store/bookings';
 import { useSavedCards } from '@/store/payment-methods';
 import { useAuthUser } from '@/store/session';
 import { chip, colors, font, radius, selectable, space, text } from '@/theme';
-import { ugx } from '@/utils/format';
+import { ugx, phoneUG } from '@/utils/format';
+import { isValidUGPhone, normalisePhone, toStandardPhone } from '@/utils/validation';
 
 type DepositMode = '30' | '50' | 'custom';
 
@@ -106,9 +107,12 @@ const balanceMethods = ['mtn_momo', 'airtel_money', 'visa_card', 'cash'] as cons
 const promoRates: Record<string, { rate: number } | undefined> = pricing.promos;
 
 const phoneDigits = (value?: string): string =>
-  (value ?? '').replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '').slice(0, 9);
+  normalisePhone(value ?? '');
 
-const isValidPhone = (digits: string): boolean => /^7\d{8}$/.test(digits);
+/** A number read back from storage (saved draft, saved profile): old forms are converted once. */
+const storedPhone = (value?: string): string => toStandardPhone(value ?? '');
+
+const isValidPhone = (digits: string): boolean => isValidUGPhone(digits);
 
 const parseISODate = (iso: string): Date => {
   const [year, month, day] = iso.split('-').map(Number);
@@ -299,7 +303,7 @@ export default function ReviewScreen() {
     return payment?.balanceMethod ?? payment?.method ?? 'mtn_momo';
   });
   const [payerPhone, setPayerPhone] = useState(() =>
-    phoneDigits(
+    storedPhone(
       getBookingDraft()?.payment?.payerPhone ||
         getBookingDraft()?.location?.contactPhone ||
         user?.phone,
@@ -357,7 +361,7 @@ export default function ReviewScreen() {
   const phoneValid = isValidPhone(payerPhone);
   const phoneError =
     phoneTouched && (payNowNeedsPhone || afterNeedsPhone) && !phoneValid
-      ? 'Enter the 9 digits after +256, for example 772 123 456.'
+      ? 'Enter a 10-digit number starting with 07, for example 0772 123 456.'
       : undefined;
   const depositError =
     depositTouched && plan === 'deposit' && !depositValid
@@ -838,12 +842,11 @@ export default function ReviewScreen() {
             {payNowMethod === 'mtn_momo' || payNowMethod === 'airtel_money' ? (
               <Input
                 label="Mobile money number"
-                prefix="+256"
                 value={payerPhone}
                 onChangeText={(value) => setPayerPhone(phoneDigits(value))}
                 onBlur={() => setPhoneTouched(true)}
                 keyboardType="phone-pad"
-                maxLength={9}
+                maxLength={14}
                 textContentType="telephoneNumber"
                 helper="You'll get a prompt on this number."
                 error={phoneError}
@@ -935,7 +938,7 @@ export default function ReviewScreen() {
                 subline={
                   method === 'mtn_momo' || method === 'airtel_money'
                     ? payerPhone
-                      ? `+256 ${payerPhone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`
+                      ? phoneUG(payerPhone)
                       : methodInfo[method].subline
                     : undefined
                 }
@@ -962,12 +965,11 @@ export default function ReviewScreen() {
             (balanceMethod === 'mtn_momo' || balanceMethod === 'airtel_money') ? (
               <Input
                 label="Mobile money number"
-                prefix="+256"
                 value={payerPhone}
                 onChangeText={(value) => setPayerPhone(phoneDigits(value))}
                 onBlur={() => setPhoneTouched(true)}
                 keyboardType="phone-pad"
-                maxLength={9}
+                maxLength={14}
                 textContentType="telephoneNumber"
                 helper="We'll send the prompt here after the service."
                 error={phoneError}
diff --git a/client-app/src/app/booking/[id]/rate.tsx b/client-app/src/app/booking/[id]/rate.tsx
index 674e189..09c2de8 100644
--- a/client-app/src/app/booking/[id]/rate.tsx
+++ b/client-app/src/app/booking/[id]/rate.tsx
@@ -34,7 +34,7 @@ import { useSavedCards, useSavedMobileMoney } from '@/store/payment-methods';
 import { addReview, getReviewForBooking } from '@/store/reviews';
 import { colors, font, radius, shadow, space, text } from '@/theme';
 import { errorHaptic, selectionHaptic, successHaptic } from '@/utils/haptics';
-import { ugx } from '@/utils/format';
+import { ugx, maskPhone } from '@/utils/format';
 
 const TAGS = ['On time', 'Thorough', 'Friendly', 'Great value', 'Respectful'] as const;
 const TIP_PRESETS = [2_000, 5_000, 10_000] as const;
@@ -50,10 +50,7 @@ type TipMethod = {
   last4?: string;
 };
 
-const maskedPhone = (phone: string): string => {
-  if (phone.length < 5) return `+256 ${phone}`;
-  return `+256 ${phone.slice(0, 2)} ••• ${phone.slice(-3)}`;
-};
+const maskedPhone = (phone: string): string => maskPhone(phone);
 
 function StarButton({
   value,
diff --git a/client-app/src/app/forgot-password.tsx b/client-app/src/app/forgot-password.tsx
index 372b4e7..c0f0b65 100644
--- a/client-app/src/app/forgot-password.tsx
+++ b/client-app/src/app/forgot-password.tsx
@@ -64,7 +64,7 @@ export default function ForgotPasswordScreen() {
     if (!valid) {
       setError(
         mode === 'phone'
-          ? 'Enter your 9-digit phone number'
+          ? 'Enter a 10-digit number starting with 07, for example 0772 123 456.'
           : 'Enter the email on your account',
       );
       return;
@@ -179,13 +179,12 @@ export default function ForgotPasswordScreen() {
                 <GlassInput
                   value={identifier}
                   onChangeText={(value) => {
-                    setIdentifier(value);
+                    setIdentifier(normalisePhone(value));
                     setError(null);
                   }}
-                  placeholder="Phone Number"
-                  prefix="+256"
+                  placeholder="Phone Number (07XX XXX XXX)"
                   keyboardType="number-pad"
-                  maxLength={9}
+                  maxLength={14}
                   accessibilityLabel="Phone Number"
                   error={error ?? undefined}
                 />
diff --git a/client-app/src/app/login.tsx b/client-app/src/app/login.tsx
index 8080e72..ccfeb92 100644
--- a/client-app/src/app/login.tsx
+++ b/client-app/src/app/login.tsx
@@ -29,7 +29,7 @@ export default function LoginScreen() {
   const [loading, setLoading] = useState(false);
   const submitted = useRef(false);
 
-  const phoneLike = identifier.trim().length > 0 && /^\+?[\d\s]+$/.test(identifier.trim());
+  const phoneLike = identifier.trim().length > 0 && /^[\d\s-]+$/.test(identifier.trim());
 
   const shakeCard = () => {
     if (reducedMotion) return;
@@ -63,7 +63,10 @@ export default function LoginScreen() {
     submitted.current = true;
     setLoading(true);
     try {
-      const session = await login({ identifier: identifier.trim(), password });
+      const session = await login({
+        identifier: phoneLike ? normalisePhone(identifier) : identifier.trim(),
+        password,
+      });
       await startSession(session);
       router.replace('/welcome-back');
     } catch (error) {
@@ -129,7 +132,6 @@ export default function LoginScreen() {
           }}
           placeholder="Email or Phone"
           icon={Mail}
-          prefix={phoneLike ? '+256' : undefined}
           keyboardType={phoneLike ? 'phone-pad' : 'email-address'}
           autoCapitalize="none"
           autoComplete="username"
diff --git a/client-app/src/app/otp.tsx b/client-app/src/app/otp.tsx
index 7cd0867..97583ff 100644
--- a/client-app/src/app/otp.tsx
+++ b/client-app/src/app/otp.tsx
@@ -77,7 +77,7 @@ export default function OtpScreen() {
       </Text>
       <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
         We sent a 6-digit code to{' '}
-        <Text style={styles.phone}>{phone ? maskPhone(phone) : '+256 7•• ••• •••'}</Text>. It
+        <Text style={styles.phone}>{phone ? maskPhone(phone) : '07•• ••• •••'}</Text>. It
         expires in 10 minutes.
       </Text>
 
diff --git a/client-app/src/app/payment/[id].tsx b/client-app/src/app/payment/[id].tsx
index 4bd2a8f..c7ea284 100644
--- a/client-app/src/app/payment/[id].tsx
+++ b/client-app/src/app/payment/[id].tsx
@@ -22,15 +22,12 @@ import { addBookingTip, markPaymentFailed } from '@/store/bookings';
 import { addCard } from '@/store/payment-methods';
 import { colors, font, radius, space, text } from '@/theme';
 import { successHaptic } from '@/utils/haptics';
-import { ugx } from '@/utils/format';
+import { ugx, maskPhone } from '@/utils/format';
 
 const DEMO_APPROVAL_MS = 6_000;
 const PROMPT_TIMEOUT_MS = 120_000;
 
-const maskedPhone = (digits: string): string => {
-  if (digits.length < 5) return `+256 ${digits}`;
-  return `+256 ${digits.slice(0, 2)}• ••• ${digits.slice(-3)}`;
-};
+const maskedPhone = (digits: string): string => maskPhone(digits);
 
 /**
  * P13 Payment Authorisation. The real screen polls `GET /payments/{id}`; with no
diff --git a/client-app/src/app/profile/edit.tsx b/client-app/src/app/profile/edit.tsx
index bfabeb0..34ab5d4 100644
--- a/client-app/src/app/profile/edit.tsx
+++ b/client-app/src/app/profile/edit.tsx
@@ -9,14 +9,12 @@ import { KeyboardScreen } from '@/components/ui/keyboard-screen';
 import { TopBar } from '@/components/ui/top-bar';
 import { updateSessionUser, useAuthUser } from '@/store/session';
 import { colors, radius, space, text } from '@/theme';
+import { isValidUGPhone, normalisePhone, toStandardPhone } from '@/utils/validation';
 
-const phoneDigits = (value: string): string =>
-  value.replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '').slice(0, 9);
+const phoneDigits = (value: string): string => normalisePhone(value);
 
-const formatPhone = (digits?: string): string => {
-  if (!digits) return '';
-  return digits.startsWith('+') ? phoneDigits(digits) : phoneDigits(digits);
-};
+/** The saved profile number may be in an old form: convert it once for the field. */
+const formatPhone = (digits?: string): string => (digits ? toStandardPhone(digits) : '');
 
 /** P27e personal details. Local profile editing until `PUT /me` is connected. */
 export default function EditProfileScreen() {
@@ -28,7 +26,7 @@ export default function EditProfileScreen() {
   const [saving, setSaving] = useState(false);
 
   const nameValid = name.trim().length >= 2;
-  const phoneValid = phone.length === 0 || /^7\d{8}$/.test(phone);
+  const phoneValid = phone.length === 0 || isValidUGPhone(phone);
   const emailValid = email.trim().length === 0 || /^\S+@\S+\.\S+$/.test(email.trim());
   const valid = nameValid && phoneValid && emailValid;
 
@@ -38,7 +36,7 @@ export default function EditProfileScreen() {
     setSaving(true);
     await updateSessionUser({
       name: name.trim(),
-      phone: phone ? `+256${phone}` : undefined,
+      phone: phone || undefined,
       email: email.trim() || undefined,
     });
     setSaving(false);
@@ -65,14 +63,14 @@ export default function EditProfileScreen() {
         />
         <Input
           label="Phone number"
-          prefix="+256"
           value={phone}
           onChangeText={(value) => setPhone(phoneDigits(value))}
           onBlur={() => setTouched(true)}
-          placeholder="772 123 456"
+          placeholder="0772 123 456"
           keyboardType="phone-pad"
+          maxLength={14}
           textContentType="telephoneNumber"
-          error={touched && !phoneValid ? 'Enter the 9 digits after +256.' : undefined}
+          error={touched && !phoneValid ? 'Enter a 10-digit number starting with 07.' : undefined}
         />
         <Input
           label="Email (optional)"
diff --git a/client-app/src/app/profile/payments.tsx b/client-app/src/app/profile/payments.tsx
index 439987d..be4a0c4 100644
--- a/client-app/src/app/profile/payments.tsx
+++ b/client-app/src/app/profile/payments.tsx
@@ -61,15 +61,9 @@ import {
   useSavedMobileMoney,
 } from '@/store/payment-methods';
 import { colors, font, radius, shadow, space, text } from '@/theme';
-import { ugx } from '@/utils/format';
+import { ugx, maskPhone } from '@/utils/format';
 import { successHaptic } from '@/utils/haptics';
 
-const maskPhone = (digits: string): string => {
-  const clean = digits.replace(/\D/g, '');
-  if (clean.length < 9) return `+256 ${clean}`;
-  return `+256 ${clean.slice(0, 3)} ••• ${clean.slice(6)}`;
-};
-
 const dateTimeLabel = (iso: string): string => {
   const date = new Date(iso);
   if (Number.isNaN(date.getTime())) return iso;
diff --git a/client-app/src/app/quote/[slug].tsx b/client-app/src/app/quote/[slug].tsx
index 6361c0a..8ed15c6 100644
--- a/client-app/src/app/quote/[slug].tsx
+++ b/client-app/src/app/quote/[slug].tsx
@@ -40,6 +40,7 @@ import { addQuoteRequest, type QuoteRequest } from '@/store/quotes';
 import { useAuthUser } from '@/store/session';
 import { chip, colors, font, radius, space, text } from '@/theme';
 import { phoneUG } from '@/utils/format';
+import { isValidUGPhone, normalisePhone, toStandardPhone } from '@/utils/validation';
 
 const MAX_PHOTOS = 5;
 
@@ -51,9 +52,12 @@ const FREQUENCY_OPTIONS: { value: BookingFrequency; label: string }[] = [
 ];
 
 const phoneDigits = (value?: string): string =>
-  (value ?? '').replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '').slice(0, 9);
+  normalisePhone(value ?? '');
 
-const isValidPhone = (digits: string): boolean => /^7\d{8}$/.test(digits);
+/** A number read back from storage (saved draft, saved profile): old forms are converted once. */
+const storedPhone = (value?: string): string => toStandardPhone(value ?? '');
+
+const isValidPhone = (digits: string): boolean => isValidUGPhone(digits);
 
 const buildDays = (): Date[] => {
   const start = new Date();
@@ -114,7 +118,7 @@ export default function QuoteRequestScreen() {
     custom && typeof params.details === 'string' ? params.details : '',
   );
   const [contactName, setContactName] = useState(user?.name ?? '');
-  const [contactPhone, setContactPhone] = useState(() => phoneDigits(user?.phone));
+  const [contactPhone, setContactPhone] = useState(() => storedPhone(user?.phone));
   const [photos, setPhotos] = useState<string[]>([]);
   const [touched, setTouched] = useState<Record<string, boolean>>({});
   const [submitted, setSubmitted] = useState<QuoteRequest | null>(null);
@@ -129,7 +133,7 @@ export default function QuoteRequestScreen() {
     touched.name && contactName.trim().length < 2 ? 'Enter the name of the contact.' : undefined;
   const phoneError =
     touched.phone && !isValidPhone(contactPhone)
-      ? 'Enter the 9 digits after +256, for example 772 123 456.'
+      ? 'Enter a 10-digit number starting with 07, for example 0772 123 456.'
       : undefined;
   const complete =
     jobLocation.trim().length >= 3 &&
@@ -444,14 +448,13 @@ export default function QuoteRequestScreen() {
             />
             <Input
               label="Phone"
-              prefix="+256"
               value={contactPhone}
               onChangeText={(value) => setContactPhone(phoneDigits(value))}
               onBlur={() => markTouched('phone')}
               error={phoneError}
               helper="We use this number to ask questions or send the quote."
               keyboardType="phone-pad"
-              maxLength={9}
+              maxLength={14}
               textContentType="telephoneNumber"
               returnKeyType="done"
             />
diff --git a/client-app/src/app/sign-up.tsx b/client-app/src/app/sign-up.tsx
index c8aa6d1..8b4e3ad 100644
--- a/client-app/src/app/sign-up.tsx
+++ b/client-app/src/app/sign-up.tsx
@@ -47,7 +47,7 @@ export default function SignUpScreen() {
   const validate = (): boolean => {
     const next: Errors = {};
     if (name.trim().length < 2) next.name = 'Enter your full name';
-    if (!isValidUGPhone(phone)) next.phone = 'Enter your 9-digit number, for example 7XX XXX XXX';
+    if (!isValidUGPhone(phone)) next.phone = 'Enter a 10-digit number starting with 07, for example 0772 123 456.';
     if (email.trim().length > 0 && !isValidEmail(email)) next.email = 'Enter a valid email address';
     if (!isStrongEnoughPassword(password)) next.password = 'Use at least 8 characters';
     if (!isStrongEnoughPassword(confirm)) next.confirm = 'Retype your password';
@@ -122,13 +122,12 @@ export default function SignUpScreen() {
         <GlassInput
           value={phone}
           onChangeText={(value) => {
-            setPhone(value);
+            setPhone(normalisePhone(value));
             clearError('phone');
           }}
-          placeholder="Phone number"
-          prefix="+256"
+          placeholder="Phone number (07XX XXX XXX)"
           keyboardType="number-pad"
-          maxLength={9}
+          maxLength={14}
           autoComplete="tel"
           textContentType="telephoneNumber"
           helper="We'll send a 6-digit code to verify this number"
diff --git a/client-app/src/components/ui/input.tsx b/client-app/src/components/ui/input.tsx
index 2013b5c..a06678b 100644
--- a/client-app/src/components/ui/input.tsx
+++ b/client-app/src/components/ui/input.tsx
@@ -18,7 +18,7 @@ export type InputProps = Omit<TextInputProps, 'style'> & {
   label?: string;
   helper?: string;
   error?: string;
-  /** Fixed prefix inside the field, for example +256 on phone fields. */
+  /** Fixed prefix inside the field. Not used on phone fields: those take 07 numbers (10 digits). */
   prefix?: string;
   leftIcon?: LucideIcon;
   secure?: boolean;
diff --git a/client-app/src/components/wallet/add-method-sheet.tsx b/client-app/src/components/wallet/add-method-sheet.tsx
index badd71e..7982539 100644
--- a/client-app/src/components/wallet/add-method-sheet.tsx
+++ b/client-app/src/components/wallet/add-method-sheet.tsx
@@ -7,6 +7,7 @@ import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import type { SavedMobileMoney } from '@/config/payments';
 import { colors, radius, space, text } from '@/theme';
+import { isValidUGPhone, normalisePhone } from '@/utils/validation';
 
 type MethodKind = 'mtn' | 'airtel' | 'visa';
 
@@ -16,8 +17,7 @@ const kinds: { id: MethodKind; label: string; hint: string }[] = [
   { id: 'visa', label: 'Visa card', hint: 'Save a card reference' },
 ];
 
-const phoneDigits = (value: string): string =>
-  value.replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '').slice(0, 9);
+const phoneDigits = (value: string): string => normalisePhone(value);
 
 const formatExpiry = (value: string): string => {
   const digits = value.replace(/\D/g, '').slice(0, 4);
@@ -39,7 +39,7 @@ export function AddMethodSheet({ visible, onClose, onAddMobileMoney, onAddCard }
   const [expiry, setExpiry] = useState('');
   const [touched, setTouched] = useState(false);
 
-  const phoneValid = /^7\d{8}$/.test(phone);
+  const phoneValid = isValidUGPhone(phone);
   const last4Valid = /^\d{4}$/.test(last4);
   const expiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
   const valid = kind === 'visa' ? last4Valid && expiryValid : phoneValid;
@@ -128,15 +128,15 @@ export function AddMethodSheet({ visible, onClose, onAddMobileMoney, onAddCard }
       ) : (
         <Input
           label="Mobile Money number"
-          prefix="+256"
           value={phone}
           onChangeText={(value) => setPhone(phoneDigits(value))}
           onBlur={() => setTouched(true)}
-          placeholder="772 123 456"
+          placeholder="0772 123 456"
+          maxLength={14}
           keyboardType="phone-pad"
           error={
             touched && !phoneValid
-              ? 'Enter the 9 digits after +256, for example 772 123 456.'
+              ? 'Enter a 10-digit number starting with 07, for example 0772 123 456.'
               : undefined
           }
         />
diff --git a/client-app/src/config/payments.ts b/client-app/src/config/payments.ts
index 311ce97..2be3798 100644
--- a/client-app/src/config/payments.ts
+++ b/client-app/src/config/payments.ts
@@ -52,13 +52,13 @@ export const demoNewCard: Pick<SavedCard, 'brand' | 'last4' | 'expiry'> = {
 export type SavedMobileMoney = {
   id: string;
   provider: 'MTN' | 'Airtel';
-  /** 9 digits after +256. */
+  /** 10 digits starting 07, for example 0772123456. */
   phone: string;
 };
 
 export const savedMobileMoney: SavedMobileMoney[] = [
-  { id: 'momo-mtn-772123456', provider: 'MTN', phone: '772123456' },
-  { id: 'momo-airtel-701234567', provider: 'Airtel', phone: '701234567' },
+  { id: 'momo-mtn-772123456', provider: 'MTN', phone: '0772123456' },
+  { id: 'momo-airtel-701234567', provider: 'Airtel', phone: '0701234567' },
 ];
 
 export const savedCardById = (id?: string): SavedCard | undefined =>
diff --git a/client-app/src/lib/__tests__/support.test.ts b/client-app/src/lib/__tests__/support.test.ts
index 47d3a37..1627bef 100644
--- a/client-app/src/lib/__tests__/support.test.ts
+++ b/client-app/src/lib/__tests__/support.test.ts
@@ -18,7 +18,7 @@ describe('toUgE164', () => {
 
 describe('formatUgDisplay', () => {
   it('formats an E.164 number for display', () => {
-    expect(formatUgDisplay('+256752777774')).toBe('+256 752 777 774');
+    expect(formatUgDisplay('+256752777774')).toBe('0752 777 774');
   });
 });
 
diff --git a/client-app/src/lib/api/auth.ts b/client-app/src/lib/api/auth.ts
index a502d98..7962939 100644
--- a/client-app/src/lib/api/auth.ts
+++ b/client-app/src/lib/api/auth.ts
@@ -34,7 +34,7 @@ const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve,
 export async function login(payload: LoginPayload): Promise<AuthSession> {
   if (!hasApiBaseUrl) {
     await delay(700);
-    const phoneLike = /^\+?[0-9\s]+$/.test(payload.identifier.trim());
+    const phoneLike = /^[0-9\s-]+$/.test(payload.identifier.trim());
     return {
       accessToken: 'mock-access-token',
       refreshToken: 'mock-refresh-token',
diff --git a/client-app/src/lib/support.ts b/client-app/src/lib/support.ts
index 77f3a81..8baaa73 100644
--- a/client-app/src/lib/support.ts
+++ b/client-app/src/lib/support.ts
@@ -10,9 +10,11 @@ export const toUgE164 = (raw: string): string | null => {
   return match ? `+256${match[1]}` : null;
 };
 
-/** '+256752777774' -> '+256 752 777 774' */
-export const formatUgDisplay = (e164: string): string =>
-  `${e164.slice(0, 4)} ${e164.slice(4, 7)} ${e164.slice(7, 10)} ${e164.slice(10)}`;
+/** '+256752777774' -> '0752 777 774'. The e164 form is kept for tel: and WhatsApp links only. */
+export const formatUgDisplay = (e164: string): string => {
+  const national = `0${e164.replace(/^\+?256/, '')}`;
+  return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7, 10)}`.trim();
+};
 
 export type SupportInput = {
   callNumber: string;
diff --git a/client-app/src/store/__tests__/session.test.ts b/client-app/src/store/__tests__/session.test.ts
index 9435e18..2f36257 100644
--- a/client-app/src/store/__tests__/session.test.ts
+++ b/client-app/src/store/__tests__/session.test.ts
@@ -19,7 +19,7 @@ type BridgeModule = typeof import('@/lib/api/session-bridge');
 const storedSession = {
   accessToken: 'token-1',
   refreshToken: 'refresh-1',
-  user: { id: 'u1', name: 'Aisha Nakato', phone: '+256700000000' },
+  user: { id: 'u1', name: 'Aisha Nakato', phone: '0700000000' },
 };
 
 /** Fresh module instance per test so status does not leak between cases. */
diff --git a/client-app/src/store/payment-methods.ts b/client-app/src/store/payment-methods.ts
index 11a470c..d235730 100644
--- a/client-app/src/store/payment-methods.ts
+++ b/client-app/src/store/payment-methods.ts
@@ -7,6 +7,7 @@ import {
   type SavedCard,
   type SavedMobileMoney,
 } from '@/config/payments';
+import { normalisePhone, toStandardPhone } from '@/utils/validation';
 
 const STORAGE_KEY = 'gabfix.payment-methods.v1';
 
@@ -69,7 +70,10 @@ export async function hydratePaymentMethods(): Promise<void> {
       : null;
     if (parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.mobileMoney)) {
       cards = parsed.cards.filter(isCard);
-      mobileMoney = parsed.mobileMoney.filter(isMobileMoney);
+      // Numbers saved by older versions have 9 digits or a 256 prefix. Convert them to 07 form once (data fix).
+      mobileMoney = parsed.mobileMoney
+        .filter(isMobileMoney)
+        .map((method) => ({ ...method, phone: toStandardPhone(method.phone) }));
     }
   } catch {
     cards = seedCards;
@@ -117,7 +121,7 @@ export function addMobileMoney(provider: SavedMobileMoney['provider'], phone: st
   const method: SavedMobileMoney = {
     id: `momo-${provider.toLowerCase()}-${Date.now()}`,
     provider,
-    phone,
+    phone: normalisePhone(phone),
   };
   setMethods(state.cards, [...state.mobileMoney, method]);
   return method;
diff --git a/client-app/src/utils/__tests__/format.test.ts b/client-app/src/utils/__tests__/format.test.ts
index b1c8028..4a7c6ec 100644
--- a/client-app/src/utils/__tests__/format.test.ts
+++ b/client-app/src/utils/__tests__/format.test.ts
@@ -8,16 +8,18 @@ describe('format utilities', () => {
     expect(ugx(-2500)).toBe('UGX -2,500');
   });
 
-  it('normalises Ugandan numbers to +256', () => {
-    expect(phoneUG('0772777773')).toBe('+256 772 777 773');
-    expect(phoneUG('256772777773')).toBe('+256 772 777 773');
-    expect(phoneUG('772 777 773')).toBe('+256 772 777 773');
+  it('shows Ugandan numbers in the 07 form, converting old stored forms', () => {
+    expect(phoneUG('0772777773')).toBe('0772 777 773');
+    expect(phoneUG('+256 772 777 773')).toBe('0772 777 773');
+    expect(phoneUG('256772777773')).toBe('0772 777 773');
+    expect(phoneUG('772 777 773')).toBe('0772 777 773');
   });
 
   it('masks the middle of a phone number for OTP copy', () => {
-    expect(maskPhone('0772777773')).toBe('+256 772 ••• 773');
+    expect(maskPhone('0772777773')).toBe('0772 ••• 773');
+    expect(maskPhone('+256772777773')).toBe('0772 ••• 773');
     // Too short to mask: falls back to the plain formatted number.
-    expect(maskPhone('0772')).toBe('+256 772');
+    expect(maskPhone('0772')).toBe('0772');
   });
 
   it('formats dates and times in Africa/Kampala', () => {
diff --git a/client-app/src/utils/__tests__/validation.test.ts b/client-app/src/utils/__tests__/validation.test.ts
new file mode 100644
index 0000000..95c5a30
--- /dev/null
+++ b/client-app/src/utils/__tests__/validation.test.ts
@@ -0,0 +1,43 @@
+import { isValidUGPhone, normalisePhone, toStandardPhone } from '@/utils/validation';
+
+describe('Ugandan phone numbers (07 only)', () => {
+  it('keeps digits only and never grows past 10 digits', () => {
+    expect(normalisePhone('0772123456')).toBe('0772123456');
+    expect(normalisePhone('0772 123 456')).toBe('0772123456');
+    expect(normalisePhone('0772-123-456')).toBe('0772123456');
+    expect(normalisePhone('')).toBe('');
+    expect(normalisePhone('07')).toBe('07');
+    expect(normalisePhone('07721234567890')).toBe('0772123456');
+  });
+
+  it('does not convert 256 forms at entry', () => {
+    // A pasted international number stays wrong, so the field shows the error.
+    expect(isValidUGPhone(normalisePhone('+256 772 123 456'))).toBe(false);
+    expect(isValidUGPhone(normalisePhone('256772123456'))).toBe(false);
+    expect(isValidUGPhone(normalisePhone('00256772123456'))).toBe(false);
+    expect(normalisePhone('256772123456')).not.toBe('0772123456');
+  });
+
+  it('accepts only exactly 10 digits starting 07', () => {
+    expect(isValidUGPhone('0772123456')).toBe(true);
+    expect(isValidUGPhone('0772 123 456')).toBe(true);
+    expect(isValidUGPhone('0772-123-456')).toBe(true);
+    expect(isValidUGPhone('+256772123456')).toBe(false);
+    expect(isValidUGPhone('256772123456')).toBe(false);
+    expect(isValidUGPhone('00256772123456')).toBe(false);
+    expect(isValidUGPhone('772123456')).toBe(false);
+    expect(isValidUGPhone('077212345')).toBe(false);
+    expect(isValidUGPhone('0872123456')).toBe(false);
+    expect(isValidUGPhone('+0772123456')).toBe(false);
+    expect(isValidUGPhone('')).toBe(false);
+  });
+
+  it('converts numbers stored in an older form (data fix only)', () => {
+    expect(toStandardPhone('0772123456')).toBe('0772123456');
+    expect(toStandardPhone('+256 772 123 456')).toBe('0772123456');
+    expect(toStandardPhone('256772123456')).toBe('0772123456');
+    expect(toStandardPhone('00256772123456')).toBe('0772123456');
+    expect(toStandardPhone('772123456')).toBe('0772123456');
+    expect(toStandardPhone('')).toBe('');
+  });
+});
diff --git a/client-app/src/utils/format.ts b/client-app/src/utils/format.ts
index 2f821b0..2b63f84 100644
--- a/client-app/src/utils/format.ts
+++ b/client-app/src/utils/format.ts
@@ -1,3 +1,5 @@
+import { toStandardPhone } from './validation';
+
 const withThousands = (value: string): string =>
   value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 
@@ -11,17 +13,17 @@ export const ugx = (amount: number): string => {
   return `UGX ${formatted}`;
 };
 
-/** 7XX XXX XXX -> +256 7XX XXX XXX */
-export const phoneUG = (digits: string): string => {
-  const clean = digits.replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '');
-  return `+256 ${clean.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`.trim();
+/** Stored number -> 0772 123 456. Old stored forms are converted so +256 is never shown. */
+export const phoneUG = (value: string): string => {
+  const digits = toStandardPhone(value);
+  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(' ');
 };
 
-/** +256 7•• ••• 482 — used on the OTP and reset screens. */
-export const maskPhone = (digits: string): string => {
-  const clean = digits.replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '');
-  if (clean.length < 9) return phoneUG(clean);
-  return `+256 ${clean.slice(0, 3)} ••• ${clean.slice(6, 7)}${clean.slice(7)}`;
+/** 0772 ••• 773, used on the OTP and reset screens and for saved numbers. */
+export const maskPhone = (value: string): string => {
+  const digits = toStandardPhone(value);
+  if (digits.length < 10) return phoneUG(digits);
+  return `${digits.slice(0, 4)} ••• ${digits.slice(7)}`;
 };
 
 export const dateLong = (date: Date): string =>
diff --git a/client-app/src/utils/validation.ts b/client-app/src/utils/validation.ts
index 2e5c029..336472f 100644
--- a/client-app/src/utils/validation.ts
+++ b/client-app/src/utils/validation.ts
@@ -1,8 +1,34 @@
-/** Ugandan mobile number: 9 digits starting with 7 (Part 2, P2b). */
-export const normalisePhone = (value: string): string =>
-  value.replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '');
+/**
+ * Ugandan mobile number. The only accepted entry is 10 digits starting with 07, for example
+ * 0772123456. The 256, +256 and 00256 forms and the old 9-digit form are not accepted.
+ *
+ * `normalisePhone` is for entry fields. It keeps digits only (spaces, dashes and other
+ * characters typed or pasted are dropped) and never grows past 10 digits. It does NOT convert
+ * 256 forms, so a pasted +256 772 123 456 stays invalid and the field shows the error. Partial
+ * input is kept as typed, so it is safe to run on every keystroke.
+ */
+export const PHONE_ERROR = 'Enter a 10-digit number starting with 07, for example 0772 123 456.';
 
-export const isValidUGPhone = (value: string): boolean => /^7\d{8}$/.test(normalisePhone(value));
+export const normalisePhone = (value: string): string => value.replace(/\D/g, '').slice(0, 10);
+
+/**
+ * Exactly 10 digits starting 07. Spaces and dashes used as separators are ignored. Any other
+ * character, including the + of an international number, makes the number invalid.
+ */
+export const isValidUGPhone = (value: string): boolean => /^07\d{8}$/.test(value.replace(/[\s-]/g, ''));
+
+/**
+ * Data fix only, never for entry. Converts a number that was stored in an older form
+ * (+256..., 256..., 00256... or the old 9-digit form) to the 07 form. Used when saved numbers are
+ * loaded from the phone's storage and when showing a stored number, so +256 is never displayed.
+ */
+export const toStandardPhone = (value: string): string => {
+  let digits = value.replace(/\D/g, '');
+  if (digits.startsWith('00256')) digits = `0${digits.slice(5)}`;
+  else if (digits.startsWith('256')) digits = `0${digits.slice(3)}`;
+  else if (digits.startsWith('7')) digits = `0${digits}`;
+  return digits.slice(0, 10);
+};
 
 export const isValidEmail = (value: string): boolean =>
   /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
```
