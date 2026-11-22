# Full App Architecture

## 1. Overview

A cleaning and home services business with several applications sharing one backend:

- **Client app** (Expo / React Native): customers make bookings.
- **Internal ERP app** (Expo / React Native): used by all staff, including the desk-based roles, with screens shown by role. Covers jobs, laundry orders, machines, stock and inventory.
- **Admin web app**: for the desk-based roles, which are admin, manager (who also covers dispatch) and customer relations. They use the same accounts as in the ERP app.
- **Backend**: Supabase (Postgres, auth, storage, realtime, edge functions) plus Firebase used only for FCM push notifications.

All apps are clients of the same Supabase project. Information flows between them through the shared database.

## Technology Stack

Everything we have chosen, in one place, grouped by purpose.

| Area | Technology | Used for |
| --- | --- | --- |
| Mobile apps | Expo and React Native | Client app and ERP app. Development builds are required, since push and Google sign-in do not run in Expo Go. |
| Admin web app | Next.js or React with Vite | Desk-based roles. Still to be chosen between the two. |
| Database | Supabase Postgres | All data, with migrations as SQL files and row level security on every table. |
| Auto-generated API | Supabase client library for JavaScript | Direct reads and writes from all three apps. |
| Edge functions | Deno and TypeScript | Push notifications, webhooks, invite codes, payment confirmation. |
| Function routing | Hono | Optional router for groups of related functions, to be decided per feature. |
| Authentication | Supabase Auth with Google | Google sign-in, phone verification by SMS, invite-code staff signup. |
| Google sign-in on mobile | Google Sign-In library for React Native | Gets an ID token that is handed to Supabase. |
| SMS provider | Twilio, MessageBird, Vonage or Textlocal | Sends the one-time codes. One still to be chosen. |
| File storage | Supabase Storage | Job photos in private buckets, service icons in public ones. |
| Realtime | Supabase Realtime | Live updates for dispatchers and staff. |
| Scheduled jobs | Postgres cron | Reminders and housekeeping. |
| Push notifications | Firebase Cloud Messaging and React Native Firebase | Device tokens and delivery, triggered from an edge function. |
| Local development | Docker Desktop, Node, Supabase CLI | The full local backend stack. |
| Firebase tooling | firebase-tools | Project setup and the service account key only. |
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

**Tools:** Docker Desktop, Node, Supabase CLI, firebase-tools (only needed for Firebase work).

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

## 4. Production Deployment

**Targets** are projects you create in the cloud, and the local folder is linked to them. The code itself never contains the target.

- Supabase: create a project on supabase.com, run `supabase login`, then `supabase link` with the project reference. After that, `supabase db push` applies migrations and `supabase functions deploy` deploys edge functions.
- Firebase: create a project in the console, run `firebase login`, then `firebase use` with the project ID (saved in `.firebaserc`, which supports aliases like dev and prod). Since Firebase is only used for FCM, there is nothing to deploy to it.
- Secrets: store the Firebase service account key with `supabase secrets set`.
- App config: Expo apps get the production Supabase URL and anon key through environment variables in release builds.

**Ongoing updates:** change local, make a new migration, test, then `db push`. Migrations carry only structure (tables, columns, indexes, policies, functions), never local test data. The only exception is deliberate reference data inserted inside a migration, such as a list of service types.

**Rules:**

- Local is the only place the schema is changed. Never edit tables directly in the production dashboard, or local and production drift apart.
- Write careful additive or altering migrations, and avoid dropping things once real data exists.
- Use separate dev or staging projects for risky changes.
- Start with manual CLI pushes. Later, move to GitHub Actions, or Supabase's GitHub integration (a paid-plan feature, check current pricing).

## 5. Backend Design

**Two layers working side by side on the same Postgres database:**

- **Auto-generated database API:** apps read and write directly for plain CRUD, protected by row level security (RLS) policies. RLS is essential, not optional.
- **Edge functions:** small TypeScript files on Deno, one URL each, running on demand in isolated environments with no shared memory and time limits. Used for push notifications, third-party services, webhooks, and any logic needing secret keys. Sensitive writes can be forced through a function by withholding direct write access.

**Organising function code (to be decided per feature):**

1. A shared folder (`_shared`) for reusable helpers such as the FCM sender and database client. Code is bundled into each function at deploy time, only on the server side, never into the apps. This is the default recommendation.
2. Function-to-function calls over HTTP. Works but adds a network hop and possible cold start, so use sparingly.
3. One function with several routes using a small framework like Hono, suited to closely related actions such as all booking operations.

A likely mix: Hono for related operations, `_shared` for helpers, and separate functions for different triggers.

## 6. Push Notifications (FCM)

1. **App side:** after the user grants permission, the app gets an FCM device token and saves it in a device tokens table linked to the user. This needs a development build, not Expo Go.
2. **Trigger:** a Supabase database webhook (built on Postgres triggers) fires when a row is inserted or updated and calls an edge function. The database does the watching, the function wakes on demand.
3. **Function:** looks up the user's device tokens and builds the message.
4. **Send:** authenticates to Firebase with the service account key (stored as a Supabase secret) and calls the FCM API.
5. **Cleanup:** if Firebase reports an invalid token, delete it from the table.

The same function serves all apps. FCM delivery cannot be emulated, so test real delivery against a separate dev Firebase project.

## 7. Authentication

- **Google sign-in** via Supabase auth. Create OAuth client IDs in Google Cloud (web, iOS, Android). Enable the Google provider in Supabase with the web client ID and secret. Locally, put settings in the config file with the secret in an environment variable, not in Git. Use separate Google clients for local and production.
- **Native apps:** use the Google Sign-In library to get an ID token, then pass it to Supabase with sign in with ID token. Needs a development build.
- **Web app:** use sign in with OAuth.
- **Phone verification by SMS:** Supabase phone auth with an external provider such as Twilio, MessageBird, Vonage or Textlocal. Locally, use the test-numbers option to avoid real texts. Provider messages cost money.
- **Roles:** Google tells us who someone is, not their role. A database trigger creates a profile row with a default role of customer on first sign-in. Admins promote staff manually or through an invite flow.

## 8. Storage

Supabase Storage with buckets, running locally in Docker too. Uses the same RLS ideas. Public buckets for things like service icons, private buckets with signed links for job photos. For example: technicians upload before and after photos, customers see only their own bookings' photos, support sees all. Bucket setup goes in migrations.

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
| Laundry operator | Runs the laundry store end to end: handles laundry orders from pickup to delivery, including walk-ins, records machine activity, and manages the laundry store's own stock and consumables. |
| Store manager | Physical side only: runs the main store for contract jobs, covering its machines, consumables and stock levels. Never sees or touches orders, bookings, pricing or dispatch. |
| Customer relations | Read and message only. Views customers, bookings and orders and messages customers. Also sees abandoned booking drafts and records the follow-up reason. Cannot create, change or cancel anything. |
| Manager | One combined role for now (sales, operations, dispatch). Sees all bookings and orders, assigns work, oversees inventory. Permissions are per capability so the role can be split later. |
| Admin | Everything, including staff invites, role assignment and the per-trade daily hours caps. |

**Role details (confirmed):**

- **Laundry operator:** handles customers' laundry orders from pickup to delivery, including walk-ins, and records machine activity in the laundry store. The laundry operator also manages the laundry store's own stock and consumables, so there is no separate laundry manager role. Orders move through stages: received, washing, drying, ready, delivered. Walk-in orders may have no app account, so staff can create a customer record with just a name and phone number.
- **Store manager:** physical side only, for the main store that supports contract jobs (machines, consumables, stock). Never sees or touches orders.
- **Customer relations:** read and message only. Can view bookings and orders and message customers, but cannot create, change or cancel anything.
- **Manager:** one combined role for now (sales, operations, dispatch). Permissions are checked per capability (for example can assign jobs, can view sales reports), so the role can be split later by giving different people different capabilities, with no rewrite.
- **Admin:** everything, including invites, roles and per-trade settings.

**Which app each role uses:** the admin web app is for admin, manager and customer relations. The Expo ERP app serves all staff, including those desk-based roles, using the same account and the same database rules. Screens in the ERP app are shown by role: technicians see their jobs, the laundry operator sees orders and machines, the manager sees everything.

**Technicians and skills:** technician types (cleaner, electrician, plumber, handyman, and more to be added later) are data, not separate roles. A technician profile links to one or more skills, and each service is tagged with the skill it requires. New trades are a small data change.

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

- `profiles`: id (matches auth user), full\_name, phone, role, status (active or deactivated), deactivated\_at, deactivated\_by, created\_at. Walk-in laundry customers may exist without an auth user.
- `device_tokens`: id, user\_id, fcm\_token, platform, last\_seen\_at.
- `reactivation_requests`: id, profile\_id, message (optional), status (pending, approved, declined), requested\_at, decided\_by, decided\_at. Created by an edge function, since the customer is not logged in when they send it.

**Services and technicians**

- `skills`: id, name (cleaning, electrical, plumbing, handyman, more later), max\_daily\_hours (set by admin only).
- `services`: id, name, description, image\_path, pricing\_type (fixed, hourly, quote), price (the fixed price, or the hourly rate), duration, required\_skill\_id, active.
- `service_fields`: id, service\_id, label, field\_type, options (for choice types), required, booking\_step, display\_order, active. The questions the customer answers for a service, defined by the admin.
- `booking_answers`: id, booking\_id, field\_id, value (text, number or choice), storage\_path (for photo or video answers), created\_at. The customer's answers, stored against the booking.
- `technician_profiles`: user\_id, display\_name, photo\_path, priority\_rating, active.
- `technician_skills`: technician\_id, skill\_id.
- `technician_availability`: id, technician\_id, weekday, start\_time, end\_time (the weekly working pattern). Date-specific days off and overrides go in technician\_overrides: id, technician\_id, date, is\_off, start\_time, end\_time.

**Bookings and jobs**

- `addresses`: id, customer\_id, label (for example home or office), line items, area, latitude and longitude (optional), notes, is\_default, created\_at.
- `bookings`: id (generated on the phone), customer\_id, address\_id, status, technicians\_needed, scheduled\_start, scheduled\_end, billed\_hours (hourly services), total\_price, notes, created\_at.
- `booking_items`: id, booking\_id, service\_id, quantity, price.
- `quotes`: id, booking\_id, requested\_by (customer), description, quoted\_amount, prepared\_by (manager), status (requested, sent, accepted, declined, expired), sent\_at, responded\_at, created\_at. Used for services with the quote pricing type.
- `job_assignments`: id, booking\_id, technician\_id, crew\_role (lead or helper), assigned\_by, status, starts\_at, ends\_at (the planned times), started\_at, completed\_at (the actual times, set by the technician in the app). One row per technician per booking, so a booking can have as many technicians as it needs. Rules: no overlapping times per technician, and exactly one lead per booking.
- `job_photos`: id, booking\_id, uploaded\_by, storage\_path, kind (before or after).

**Operations and inventory**

**Stores**

The business has two separate stores, each with its own consumables, stock and equipment. The admin console consolidates both for management.

- `stores`: id, name (main store for contract jobs, laundry store), active.
- Every inventory item, stock movement and piece of equipment belongs to a store through `store_id`.
- The store manager is tied to the main store. The laundry operator is tied to the laundry store and runs it end to end: laundry orders, machines, and the laundry store's stock. Admin and manager see both stores.
- Staff are linked to their store through a `staff_stores` table (user\_id, store\_id), which row level security uses to limit what each person can see and change.

**Inventory and equipment**

- `inventory_items`: id, store\_id, name, category, unit, quantity\_on\_hand, reorder\_level.
- `stock_movements`: id, store\_id, item\_id, change, reason, performed\_by, laundry\_order\_id or booking\_id (what the stock was used on, when applicable), created\_at. Recording a movement updates quantity\_on\_hand automatically.
- `equipment`: id, store\_id, name, type, location, status, last\_service\_date (machines).

**Laundry**

- `laundry_orders`: id, customer\_id (nullable for walk-ins), walk\_in\_name, walk\_in\_phone, status (received, washing, drying, ready, delivered), created\_by, picked\_up\_at, delivered\_at.
- `machine_logs`: id, equipment\_id, laundry\_order\_id, operator\_id, action, started\_at, ended\_at.

**Payments and access control**

- `payments`: id, booking\_id or laundry\_order\_id, amount, method (app, cash), status, provider, provider\_reference, recorded\_by (staff member, for cash), store\_id (for cash taken at a store), paid\_at, created\_at. One order can have many payment rows.
- `staff_invites`: id, code, role, created\_by, expires\_at, used\_at, revoked.
- `capabilities` and `role_capabilities`: capability-based permissions, so the manager role can be split later.
- `audit_log`: id, actor\_id, action, table\_name, record\_id, old\_value, new\_value, created\_at. Append only.

**Communication**

- `notifications`: id, user\_id, title, body, type, read\_at, created\_at.
- `booking_drafts`: id, customer\_id, selected\_services, last\_step, status (in progress, abandoned, followed up, completed), abandoned\_at, follow\_up\_reason, followed\_up\_by, followed\_up\_at, booking\_id (set when the draft becomes a booking), updated\_at. The client app saves the draft as the customer goes. See the abandoned bookings decision in section 12.
- `support_conversations`: id, customer\_id (unique, one row per customer), last\_message\_at, last\_read\_by\_staff\_at, created\_at. Created automatically the first time a customer or staff member sends a message.
- `support_messages`: id, conversation\_id, sender\_id, body, booking\_id (optional), laundry\_order\_id (optional), created\_at. A message is tagged to a booking or laundry order only when it relates to one. General inquiries carry no tag.

- `reviews`: id, booking\_id, customer\_id, target\_type (service or technician), service\_id or technician\_id (whichever is rated), rating (1 to 5), comment (optional), created\_at. One row per rating, so a customer can leave several for one booking.

Customer relations, manager and admin can read and reply in any conversation. A customer can only read and write in their own conversation, enforced by row level security. Each new message also creates a row in `notifications` for the other side, delivered by push.

## 12. Decisions and Additions

**Payments:** customers pay in the client app. No provider chosen yet, to be set up later. The pattern will be: the app starts a payment, the provider confirms it by webhook, and an edge function verifies it and marks the order paid. Provider secret keys live in Supabase secrets, never in the apps. Design in now a `payments` table (order, amount, status, provider reference). Pick a provider that supports your country and currency.

**Service entry and dynamic forms:** services are not written in code. The admin enters them in the admin console, and each service defines its own questions as data.

- Each question is a row in `service_fields`: the label, a field type, its options if it is a choice, whether it is required, the booking step where it appears, and its display order.
- Which questions a service needs depends partly on its pricing type. A quote service usually asks for more detail up front so the manager can price it, while fixed and hourly services may need little. Any service can have any number of questions.
- The client app reads these rows and draws the form itself, laying each question out according to its field type. The customer's answers are saved in `booking_answers`, and photo or video answers go to Supabase Storage with the path stored.
- The booking steps are fixed and already exist in the client app. Each question points to one of them by name. The step names are to be taken from the client app.
- The admin does not define field types. They pick from the list of types the client app already knows how to draw. That list is to be taken from the existing client app and expanded as needed, and adding a new type means an app update.
- Answers are visible to admin, manager and customer relations on every booking. Customer relations is read only. A technician sees answers only for bookings they are assigned to, including as part of a crew. A customer sees their own answers. Row level security enforces this.

**Service catalogue in the client app:** services are shown grouped by category, and a category is the trade, so cleaning, electrical, plumbing, handyman and any trade added later.

- No separate category table. The category is the name of the skill a service requires (`services.required_skill_id`), shown as a heading above its services. A new trade appears as a new category automatically.
- A category is only a word. What customers see and tap are the services, each with one image, its name, its description and its price or hourly rate. Quote services show that a quote is needed instead of a price.
- Each service has a single image, stored in Supabase Storage with the path in `services.image_path`. The bucket is public, since customers must see services before they book.
- Only active services are shown. Admin and manager manage the services and their images.

**Pricing types and deposits:** every service has one of three pricing types, stored in `services.pricing_type`.

- Fixed price: the service has a set price, and the booking total is known straight away.
- Hourly: the service is charged at an hourly rate, and the total is worked out from the hours.
- Quote: the price depends on the job, so the customer sends a request and the manager replies with a price.

**Quote flow:** the customer requests a quote in the client app and describes the job. The manager is the lead and prepares the quote, then sends it back, and the customer gets a push notification. The customer accepts or declines. On acceptance the quoted amount becomes the booking total. Customer relations can see quotes but not prepare them, in line with their read and message only role.

**Deposits:** a deposit is never required, only allowed. For every pricing type, the customer can pay a deposit up front, or pay after the service, and the app always allows a payment. For quote services, paying a deposit becomes possible once the quote is sent and accepted. A deposit is simply a partial payment row in `payments`, so no special logic is needed.

**Hourly billing:** for hourly services the app times the job, and the technician records it. When the technician arrives at the job location they tap start, and the clock begins at that tap, not at the scheduled time, since they may arrive late. They tap complete when the job is done, and the clock stops.

- Start and finish are stored as timestamps on the technician's `job_assignments` row (`started_at`, `completed_at`). They work with the offline queue, so a job timed without signal syncs later with its original times.
- Billed time is the elapsed time rounded up to the next 15 minutes, so 1 hour 10 minutes bills as 1 hour 15 minutes.
- Total price is billed hours times the hourly rate. With a crew, each technician's hours are timed on their own assignment, and the booking's `billed_hours` and total are worked out from them.
- The calculation happens on the server when the job is completed, not on the phone, so the figure cannot be altered from the app.

**Partial and cash payments:** customers usually do not pay in full, and some pay cash on delivery or at the store. So an order or booking is not simply paid or unpaid: it has a total, and any number of payments against it.

- Each payment is its own row in `payments`, with a method of app or cash. App payments are confirmed by the provider webhook. Cash payments are recorded by staff in the ERP app: the laundry operator at the laundry store, and the technician or manager for contract jobs. The row stores who recorded it, so every cash entry is traceable.
- Amount paid and balance remaining are calculated from the payment rows (total minus the sum of confirmed payments), never typed in by hand. A database view exposes them per booking and per laundry order.
- A booking or order shows as unpaid, part paid or fully paid, worked out from that balance.
- The customer's app shows, on each order, the total, what has been paid and the balance remaining. Cash entries are marked as recorded by staff.
- A recorded payment cannot be edited or deleted by the person who made it. A mistake is fixed by a correcting entry, and only the manager or admin can do that. This keeps the money trail clean.
- The unpaid balance reminders to customers (see notification events) are based on this balance.

**Staff accounts:** invite only. The admin creates an invite with a role attached, and the app generates a one-time code. The staff member signs up with the code, and an edge function checks it, assigns the role and marks the code used. Codes expire after a few days, work once, and can be revoked. Customers sign up normally with no code. Table: `staff_invites` (code, role, created\_by, expires\_at, used\_at, revoked).

**Technician offline mode:** technicians need a proper offline mode for areas with poor signal.

- The day's assigned jobs are downloaded ahead of time so they open without signal.
- Every action (progress, notes, photos) is saved on the phone first, in an ordered local queue, each with its own unique ID so a retry never duplicates.
- Photos are stored on the device and uploaded in the background.
- Each synced update carries its original timestamp, so the record shows when the work happened, not when it uploaded.
- If a dispatcher reassigns a job while the technician is offline, the server wins and the app tells them on sync.

**Support conversations:** each customer has one ongoing conversation with customer relations, the same chat layout for everyone. Customers can message at any time, with or without a booking. When a message concerns a specific booking or laundry order, it is tagged to it, and the app shows that booking or order as a reference inside the chat, so there are no separate threads per booking. Customer relations see a list of customers ordered by latest message, with unread conversations marked, using `last_read_by_staff_at`.

**Notification events:** each event creates a row in `notifications` and sends a push through FCM.

- Customer: a gentle invitation to rate after a job is completed, quote received, booking confirmed, technician assigned, technician on the way, job completed, laundry order status changes (received, washing, drying, ready, delivered), new support message, payment confirmed.
- Customer reminders: occasional reminders of any unpaid balance on an order or booking, and reminders of orders or bookings that are not complete. A scheduled job sends them, with a limit on how often each customer is reminded.
- Staff (starting list, to be adjusted and extended later):
    - Technician: job assigned, reassigned or cancelled, and a reminder before a job starts.
    - Laundry operator: new laundry order, and low stock in the laundry store.
    - Store manager: low stock in the main store, and a machine due for service.
    - Customer relations: new support message, and a newly abandoned booking.
    - Manager: reactivation request, new quote request, new booking, an unassigned booking approaching its start time, and payment failures.
    - Admin: everything the manager receives, plus new staff sign-ups using an invite code.
- Low stock alerts fire when `quantity_on_hand` falls to the item's `reorder_level`, and go only to the person tied to that store through `staff_stores`.

**Abandoned bookings:** the client app saves a booking draft as the customer goes. If the draft is not completed within 24 hours of its last update, a scheduled job marks it abandoned and sends the customer a push notification straight away. Abandoned drafts appear in a follow-up list for customer relations. At a convenient time, customer relations message the customer in the support chat to ask why the booking was not completed, then record the reason in `follow_up_reason` and set the status to followed up. If the customer completes the booking later, the draft is marked completed and linked to the booking. The drafts table doubles as analysis data: where customers stop and the reasons they give, which the admin can review.

**Edge function structure (starting list):** each job that needs trusted server code is its own small edge function, with a shared folder for common code.

- Separate functions, one per job: confirm payment (the provider webhook checks the payment and marks it paid), redeem staff invite (checks the code and assigns the role), calculate billed hours (works out time and price when a technician completes a job), send push notification (sends through FCM), mark abandoned bookings (a scheduled job, 24 hours after the last draft update), send payment and booking reminders (a scheduled job), and submit a reactivation request (works without a login).
- Shared folder: code several functions use, such as checking who is calling and their role, sending a push, and reading payment balances. This avoids repeating the same logic in each function.
- The payment webhook stays isolated because it holds the provider secret keys, which live in Supabase secrets and never in the apps.
- This list is provisional. It will be adjusted once the existing client app, the ERP and their documentation have been reviewed, since features found there may need functions of their own.

**Security rules (who reads and changes what):** every table has row level security. The rules below are the starting position, built from the decisions in this document.

- Customer: reads and changes only their own profile, addresses, bookings, laundry orders, quotes, answers, payments view and support conversation. A customer cannot change a booking's status or price.
- Technician: sees only bookings they are assigned to, including as part of a crew. They can update progress, notes and photos on those jobs, and start and complete them.
- Laundry operator: works only with the laundry store's orders, machines and stock, through `staff_stores`. Can record cash payments at the laundry store.
- Store manager: works only with the main store's machines, consumables and stock. Never sees orders, bookings, pricing or dispatch.
- Customer relations: reads customers, bookings, orders, quotes, answers and abandoned drafts. Writes only support messages and follow-up reasons. Cannot see job photos.
- Manager: sees and changes everything operational, including quotes, dispatch, corrections to payments and both stores. Permissions are checked per capability.
- Admin: everything, and alone manages staff invites, roles, trade hour caps and the services catalogue.

**Job photo access:** before and after photos of a job are private. They are stored in a private Supabase Storage bucket, and a storage rule checks who is asking.

- Who can see a job's photos: the technicians assigned to that booking (including its crew), the booking's customer, the manager and the admin.
- Customer relations cannot see job photos. Other technicians and other customers cannot either.
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
- Phone numbers are matched ignoring spaces and dashes, so the format typed does not matter.
- Search results follow the same access rules as everything else. Customer relations sees the customer's details but cannot see job photos.
- Deactivated customers still appear in search, marked as deactivated, so staff can handle reactivation requests.

**Audit trail (starting list):** a log of sensitive actions, recording who did it, when, and what changed. The list below is a starting point, to be extended once the applications are connected.

- Money: every payment recorded, and every correction to one.
- Quotes: a price sent, and a customer accepting or declining.
- Accounts and access: staff invites created and used, roles assigned or changed, accounts deactivated or reactivated, and reactivation requests decided.
- Bookings: assignments and reassignments, cancellations and rescheduling, and jobs started and completed.
- Stock: every stock movement, already recorded in `stock_movements`.
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

- The field types and booking step names for the dynamic service forms, to be taken from the existing client app.

- Edge functions: a starting list and structure are in the doc (separate functions plus a shared folder). To be revised once the client app, the ERP and their documentation have been reviewed.
- The extra technician trades you will name later.
- Cancellation and rescheduling rules, to be taken from the client app.
- Travel time: how planning estimates it before the real gap is known, and what happens when a job would run past the daily cap. See the travel time decision.
- The payment provider. The booking stages (statuses) from the existing ERP design, which will be shared with the full architecture document and adopted as the status values. When we have them, decide whether the stage list is fixed in the database or editable by the admin, and which roles can move a booking between stages.
