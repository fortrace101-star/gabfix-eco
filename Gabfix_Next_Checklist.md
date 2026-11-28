# Gabfix Next Checklist — Technician Home + Booking Chat

Scope: the work started on 2026-11-27 — the technician app opens on Home, technicians chat with the
customer on the current booking, a customer automatically gets that chat when a technician is
assigned, and both app shells carry update-count badges (Chat/Jobs/Cash on the ERP, Bookings/
Messages plus per-stage beacons on the client). Then the architecture/client-feature items that were
next in line.

Legend: `[x]` built and checked · `[~]` built, runtime not checked · `[ ]` open · `[!]` blocked in
this environment.

References: `Gabfix_Architecture_Implementation_Plan_with_Edit_Classifications.md` §10–§11,
`Technician_App_Setup_Checklist.md` (A/B/C tracks), `gabfix-admin-ui-improvement-checklist.md`.

---

## 0. This session

- [x] **Docs:** this checklist.
- [x] **Local stack back.** The Docker stack now runs; the **edge runtime container had exited**
      (`Exited (255)`), which is why every `/functions/v1/api` call returned 503. It was restarted
      (health 200) and the three pending migrations were applied with `psql -f`:
      `20261126150000_service_landing_copy.sql`, `20261127120000_booking_chat.sql` (9 threads
      backfilled) and `20261127130000_booking_reference_format.sql`.
- [x] **Disk:** 13 GB free at the end of the session; generated caches can be cleared again if a
      full Playwright install is needed.

---

## A. Technician app (`erp-app`)

- [x] **A1. Open on Home.** `src/app/(app)/_layout.tsx` exports
      `unstable_settings = { initialRouteName: 'home' }` (the `initialRouteName` prop is not exposed
      by `expo-router/js-tabs` and fails typecheck). `src/app/index.tsx` already redirects a signed-in
      session to `/home`.
      **Check on a build:** cold start signed in, and relaunch on `/notifications`, both land on Home
      the next time the app is opened from scratch. Not run (no device/stack).
- [x] **A2. Chat inbox.** New `src/app/(app)/chat/index.tsx`, a tab visible to technician, customer
      relations, manager and admin (`VISIBLE_FOR.chat`), icon `MessageCircle`. Lists one row per
      assigned booking thread: customer name, reference, visit window, last message. Pull to refresh;
      polls every 30 s.
- [x] **A3. Booking thread.** New `src/app/(app)/chat/[bookingId].tsx`: customer bubble alignment by
      `sender_id`, timestamps, composer with 2000-char limit, 15 s refresh, read receipt written to
      `booking_threads.lead_last_read_at` for the lead.
- [x] **A4. Entry from the job.** `jobs/[id].tsx` Customer card has “Message customer”, which routes
      to `/chat/<bookingId>`.
- [x] **A5. Types.** `booking_threads` / `booking_messages` added to `erp-app/src/lib/database.types.ts`
      so the typed client compiles. **Regenerate this file after the migration is applied.**
- [~] **A6. Update badges.** `src/store/badges.ts` keeps a per-device last-seen timestamp for
      Chat/Jobs/Cash, `src/lib/tab-badges.ts` counts what is newer, and `brand-tab-bar.tsx` renders
      the count (cap `9+`). Chat counts threads whose newest message is not mine, Jobs active
      bookings whose `updated_at` moved (the technician's own assignments only), Cash cash payments
      and handovers created/confirmed since. Opening a tab calls `markTabSeen()`, so the badge clears
      without a server read table; a first launch baselines at "now" instead of flagging all history.
      **Not run against a database**, so the three queries and the clear-on-focus behaviour are
      unverified. The thread's own `lead_last_read_at` marker is still written but not used by the
      badge.
- [ ] **A7. Realtime.** Polling only. Add a Supabase Realtime subscription on `booking_messages` and
      stop the interval when the screen is focused.
- [ ] **A8. Attachments.** Technician chat is text-only. Photos should go through the existing
      `job-photos` bucket plus a `booking_messages.storage_path` (or reuse `booking_media`).
- [ ] **A9. Offline.** Sending while offline fails with “Not sent”; queue it like the job status
      actions (`src/lib/action-queue.ts`) and replay on reconnect.
- [ ] **A10. Chat tab density.** Six tabs now render at 60 px each on a 360 px screen; check the
      “Schedule” label does not clip on a handset, and consider moving Cash under Home if it does.
- [~] **A11. Cash handover state.** Each handover line now reads `Awaiting confirmation` in red until
      the desk confirms it, then `Confirmed <time>` in green (`cash.tsx`). Compiles; not seen on a
      device.

---

## B. Backend

- [x] **B1. Schema.** `backend/supabase/migrations/20261127120000_booking_chat.sql`:
      `booking_threads` (one per booking, unique `booking_id`, `customer_id`, `lead_id`, read
      markers, `last_message_at`) and `booking_messages` (`thread_id`, `sender_id`, `body`,
      `created_at`).
- [x] **B2. Automatic session.** `job_assignments_ensure_thread` trigger calls
      `ensure_booking_thread()` on assignment insert/update: creates the thread, promotes the lead
      when one is assigned, never resurrects a removed assignment. A backfill statement threads
      existing assignments.
- [x] **B3. Access.** RLS: customer, `lead_id`, any assigned technician, or desk can read; messages
      insert only as yourself on a thread you can see. `can_view_booking_thread()` mirrors that.
- [x] **B4. API (client app).** `GET /threads`, `GET /threads/:id/messages`,
      `POST /threads/:id/messages` in `backend/supabase/functions/api/index.ts`. Returns counterpart
      names, booking reference, last message, unread flag and `viewerId`; marks the caller's read
      marker on open and on send.
- [~] **B5. Apply + verify.** Applied with `psql -f` (the CLI ledger is stale: migrations applied
      that way on 2026-11-25/26 are listed as unapplied, so `migration up` would re-run them).
      Checked so far: `GET /threads` returns 200 with `viewerId` and 3 threads for the seeded
      customer; `backend npm test` 12/12. Still to check by hand: assignment → one thread, lead
      swap, send in both directions, outsider/deactivated access, unread flip.
      - assign a technician to a booking with `assign_technician` → one `booking_threads` row, lead set;
      - swap the lead → `lead_id` follows the new lead and the old thread survives;
      - customer `GET /threads` → the thread appears; technician select → same thread;
      - customer POST → technician sees it; technician POST → customer sees it;
      - outsider customer → 404/empty; desk → can read; deactivated → 403;
      - `last_message_at` moves on insert, unread flips to 1 for the other side.
- [ ] **B6. Notifications.** Assignment should notify the customer (“Chat with <lead> opened”), and a
      new message should notify the recipient when they are not in the thread (reuse `notifications`
      + `device_tokens`).
- [ ] **B7. Desk inbox.** `admin-web` has no booking-chat view; support currently sees
      `support_conversations` only. Add a read/write agent view if the desk is expected to answer.
- [ ] **B8. Retention.** Decide what happens to the thread when the booking completes or is
      cancelled; today it stays readable.

---

## C. Client app (`client-app`)

- [x] **C1. API wrapper.** `src/lib/api/chat.ts` — `fetchBookingThreads`, `fetchBookingMessages`,
      `sendBookingMessage`.
- [x] **C2. Inbox merge.** `store/messages.ts` gained `kind: 'booking'` + `serverId`,
      `syncBookingThreads()` (replaces booking threads, keeps local support/cleaner threads) and
      `loadBookingMessages()`. `messages.tsx` syncs on mount and shows “Showing saved messages” when
      the API is unreachable. Subtitle now says “team lead”.
- [x] **C3. Sending.** Booking-thread sends POST to the API and show Sending → Sent, or “Not sent” on
      failure (`status: 'failed'`); support/cleaner threads keep the demo reply.
- [ ] **C4. Attachments.** Photo-only messages on booking threads are local-only (the API is
      text-only); text + photo sends the text. Needs upload support before it is honest to show it.
- [ ] **C5. Realtime / foreground refresh.** Threads load on mount and thread open only; add a focus
      refetch and a Realtime subscription on `booking_messages`.
- [ ] **C6. Support thread is still simulated.** The local `support` thread and canned replies remain;
      `/support/conversation` exists and should replace it.
- [ ] **C7. Empty-state copy.** With real threads the inbox empty state should say job chats appear
      when a technician is assigned, not only “contact support”.
- [~] **C8. Messages badge.** The client tab bar now sums `ChatThread.unread` from
      `store/messages.ts`, so booking threads coming from `/threads` raise the same badge as the
      local support/cleaner threads. Compiles; not seen running.
- [~] **C9. Booking beacons.** `hasBookingUpdate()` in `store/bookings.ts` compares the newest
      customer-visible stage change (created, assigned, completed, cancelled, cash received) with
      `updatesSeenAtISO`; hydration baselines older bookings so an upgrade does not flag history.
      `bookings.tsx` shows a beacon dot on each affected card and on the Upcoming/Completed/Cancelled
      segment (new `beacons` prop on `SegmentedControl`), the tab badge counts affected bookings, and
      `booking/[id].tsx` clears the beacon via `markBookingSeen()`. The selected segment label is now
      theme green (`green700`) on the white thumb. Compiles; not seen running.

---

## D. Tests worth adding with the stack back

- [ ] **D1.** Store test: server thread maps to `kind: 'booking'`, `from` uses `viewerId`, a failed
      send flips to `failed`, and `syncBookingThreads` keeps local threads.
- [ ] **D2.** API contract test: thread list shape, 404 for a stranger, read marker updated.
- [ ] **D3.** RLS test: helper/lead/customer/desk visibility matrix.
- [ ] **D4.** ERP Playwright/web pass: `/chat` renders threads, opening one shows history, Home is the
      first tab after sign-in.

---

## E. Resume the architecture / client-feature backlog

Ordered by what unblocks the most:

1. **Regenerate DB types** for `erp-app` and `admin-web` now that the chat, reference and landing-copy
   migrations are in the local DB.
2. **Admin catalogue landing copy** — migration applied; now save a service with includes/excludes/
   FAQs and confirm `GET /services/:slug` returns them and the client service page renders them.
3. **ERP C-track finish** — C2 job detail form snapshot/crew marking, C6 schedule, C7 notifications +
   profile, C8 states/copy (`Technician_App_Setup_Checklist.md`).
4. **ERP B11 push** — blocked on a development build; pair with the chat notification work (B6).
5. **Client E-track** — E1 receipt file download, E2 modal accessibility, E3 device pass.
6. **Admin D5/D6** — page-by-page pass and UI role gating.
7. **Docs** — record the chat decisions (thread per booking, lead as customer counterpart, desk read
   access) in the architecture plan §11/§13 and the progress tables.

---

## F. Verification gates

| App | Command | This session |
| --- | --- | --- |
| `erp-app` | `./node_modules/.bin/tsc --noEmit` | clean |
| `erp-app` | `npx eslint src` | not run (disk) |
| `client-app` | `./node_modules/.bin/tsc --noEmit` | clean |
| `client-app` | `npm test` | not run (disk) |
| `client-app` | eslint on the touched files | clean |
| `admin-web` | `npx tsc -b` + `npm run build` | clean |
| `backend` | `npm test` (contract + RLS) | 12/12 pass |
| Runtime | `GET /threads` as the seeded customer | 200, `viewerId`, 3 threads |
| Runtime | `POST /bookings` as the seeded customer | 201, reference `GBX-KSXUSMIWUF` |
| Runtime | `GET /functions/v1/api/health` | 200 after restarting the edge runtime |

Nothing was committed or deployed.

---

## G. Assumptions to confirm

- One conversation per booking, not per technician — a helper sees the same thread as the lead, and
  the lead is the customer's named contact.
- The desk may read every booking chat; only the customer and assigned crew may write.
- A completed job exports its thread as JSONL to the private `chat-archives` bucket and deletes the
  thread (messages cascade). The owner-only Chat Archive screen lists and downloads the files.
- Text plus one photo or short video (25 MB, 30 s) per message; chat is live in the ERP and refreshes
  every few seconds in the client app, which has no Realtime client.

---

## H. Requested polish (2026-11-27)

- [~] **H1. Booking codes.** `public.new_booking_reference()` now returns `GBX-` + 10 alphanumerics
  (A–Z, 0–9) and is the `bookings.reference` default; `client-app/src/lib/booking-reference.ts` is
  the device-side twin used by the API fallback and recurring-plan seeding. Verified: the helper
  returns `GBX-RXUCNAA5RN` and a live booking got `GBX-KSXUSMIWUF`. Existing references were left
  as they are.
- [~] **H2. Admin logo.** `client-app/assets/images/gabfix-logo.png` is copied to
  `admin-web/src/assets/gabfix-logo.png` and replaces the “G” tile in the sidebar, the sign-in panel
  and the small-window notice; `.brand-mark` is now a circular transparent holder. Build passes; not
  viewed in a browser.
- [~] **H3. Admin sidebar badges.** `lib/nav-badges.ts` counts pending staff/sales bookings + pending
  cancellation requests (Approvals), `requested` quotes, unread support threads and `submitted` job
  costs; `App.tsx` adds unassigned confirmed bookings and unremitted cash. Each nav item shows its
  count up to `99+`. Build passes; counts not checked against a signed-in console.
- [~] **H4. Cash handover wording.** `Awaiting confirmation` is red and `Confirmed <time>` is green,
  per handover row in the ERP.
- [~] **H5. Order-flow back.** `useDraftExit` now returns `requestBack`: header back and hardware back
  step to the previous order stage without the draft sheet; only backing out of `details` or pressing
  the X (top right) asks to save. Compiles; not clicked through.
- [~] **H6. Sign out.** The profile danger row and the Home menu sign out immediately; the “Sign out?”
  alert is gone from `app/(tabs)/profile.tsx` and `app/(tabs)/home.tsx`. Compiles and lints; not
  clicked on a device.
- [~] **H7. Chat identity.** Titles read “Daniel (Gabfix Team)” for the customer (first name of the
  technician display name) and “Marion (Customer)” for the crew (first name on the customer profile).
- [~] **H8. Live chat + push.** `booking_threads`/`booking_messages` stream through Realtime; the ERP
  subscribes in the inbox, thread and tab badges. A message trigger queues an Expo push to the other
  party and writes no Alerts row, so chat stays in Chat. Client thread polls every 4 s.
- [~] **H9. Chat media.** `booking_messages` carries one image/video, uploaded through signed URLs to
  the private `chat-media` bucket; both apps pick, validate (25 MB / 30 s) and render it. API upload,
  send and signed read-back verified with a live 1×1 PNG.
- [~] **H10. Archive naming + download.** Files are `GBX-<reference>.jsonl`; the console lists and
  downloads through owner-only `/chat-archives` API routes (verified: list 200, signed URL 200).
- [~] **H11. Chat layout.** The ERP inbox and thread now use the client app's header, avatar, bubble
  and composer layout; badges sit lower-left over every tab icon in both apps.
- [~] **H12. Booking steps + tracking.** Stepper and tracking connector lines are behind the circles;
  tracking dots are filled colours and the line ends at the first/last circle centres.
- [~] **H13. Tracking follows the crew.** `bookings.status` changes push to the customer and the track
  screen mirrors `on_the_way`/`in_progress`/`completed`; the cleaner card shows the assignee once the
  assignment syncs.
- [~] **H14. Payment + consent.** The deposit plan no longer asks for the balance method; the terms /
  cancellation / late-fee agreement moved from review to sign-up (Terms, Payment & refund, Privacy).
- [~] **H15. Admin job scope.** The drawer lists services, address, every form answer and notes.
- [~] **H16. In-app sound.** A short bundled chime plays for incoming messages while either app is
  open (`expo-audio`); push sound carries the closed-app case.

---

## I. Final implementation phase — session 2026-11-28 (M2 audit log, C2 account deletion)

Scope: the two untouched register items that close the governance/account-lifecycle tail, with
tests. G1 (payment adapter), H1 (laundry workspace), K1 (promo/referral server workflows) and Z1
(release evidence) remain open.

- [x] **M2-B1. Audit read functions.** `20261128120000_audit_log_view.sql`: `audit_log_page()`
      (filters: table, action, actor-name fragment, record id, inclusive date range; paging; total
      via a window count; actor name/role joined server-side because `audit_log.actor_id` lost its
      `profiles` FK in `20261125160000`) and `audit_log_tables()` for the entity filter. Both are
      `security definer` and raise `42501` for anyone who is not an `admin`, so the table's RLS stays
      untouched.
- [x] **M2-B2. Audit totals.** `20261128140000_audit_log_summary.sql` returns events/created/
      updated/deleted/tables/newestAt for the KPI strip.
- [x] **M2-A1. Console page.** `admin-web/src/lib/audit.ts` (reader, summary, changed-field diff,
      CSV rows) and `pages/Audit.tsx` (filters, 25-row pager, expandable before/after table,
      empty/loading/error states, CSV export that reuses the filters with a 5 000-row cap and a
      truncation notice). Nav item “Audit log” under **Business**, `canViewPage` owner-only, topbar
      label, `database.types.ts` regenerated from the local schema.
- [x] **M2-V1. Checks.** `backend npm test` 14/14 (audit test: owner 200, manager and customer 403,
      entity+action filter, totals add up); headless Chrome at 1440 as `admin@gabfix.ug`: 25 rows,
      “Showing 1–25 of 665”, 9 entities, 174 deletions, 2-field expanded diff, payments filter → 38
      rows, 39-line CSV with the same filter, table `1078/1078`, no console/page errors.
      `admin-web` typecheck + build pass.
- [ ] **M2-V2.** Review the page at 1280 and 1024, and agree what support/chat text an owner may see
      in the diff (D14 redaction rules).
- [x] **C2-B1. Deletion schema and guards.** `20261128130000_account_deletion.sql`:
      `account_deletions` (profile, HMAC phone code, kept-booking count, desk read policy),
      `account_deletion_blockers()` (upcoming bookings, unpaid balance, open cash dispute),
      `account_deletion_status()` for the app screen, and `finalise_customer_deletion()` which the
      service role alone may call, re-checks the blockers in the transaction, refuses staff
      accounts, blanks the profile (`Deleted customer`, phone null, `auth_user_id` null,
      deactivated), addresses, drafts, push tokens, notification prefs, chat/ticket text, review
      comments and booking name snapshots, and keeps bookings, payments, referrals and audit.
- [x] **C2-B2. API.** `GET /account/deletion` (blockers for the screen) and `POST /account/delete`
      (blockers re-checked, password confirmed through a real Supabase sign-in, HMAC of the phone
      computed in the function, blanking RPC, `auth.admin.deleteUser` last so every session ends and
      the account cannot sign in again; a failed Auth delete leaves a fail-closed blanked profile).
- [x] **C2-C1. Client screen.** `client-app/src/lib/api/account.ts` and
      `app/profile/delete-account.tsx`: what is removed/kept, blocked reasons with a link to bookings,
      password field, irreversible warning and confirm sheet; success clears the device
      (`deleteLocalAccount`) and opens Login. Profile's old local-only confirm is gone.
- [x] **C2-V1. Checks.** `backend npm test` 14/14 deletion case (wrong password 401 → blocked 409
      with `upcomingBookings` 1 and an outstanding balance → cancel → 200 with `bookingsKept` 1 →
      sign-in 401, profile blanked, 64-hex phone code, booking snapshot blanked); live probe repeated
      the same flow. `client-app` `npx tsc --noEmit` and eslint on the touched files pass.
- [ ] **C2-V2.** Open `/profile/delete-account` in the Expo web build and on a device; check the
      blocked state with a live booking and the confirm-sheet behaviour with the keyboard open.
- [ ] **C2-V3.** Decide how the desk sees `account_deletions` (D14 says phone deletion requests go to
      a manager/admin), and whether audit rows for a deleted profile should be redacted for owners.

### Verification gates this session

| App | Command | Result |
| --- | --- | --- |
| `backend` | `npm test` (contract + RLS, now 14 tests) | 14/14 pass |
| `admin-web` | `npm run typecheck` | clean |
| `admin-web` | `npm run build` | passes (pre-existing >500 kB chunk warning) |
| `admin-web` | headless Chrome `#/audit` at 1440 | pass, no console/page errors |
| `client-app` | `npx tsc --noEmit` | clean |
| `client-app` | eslint on the three touched files | clean |
| Runtime | `GET /account/deletion`, `POST /account/delete` as a probe customer | 200 / 401 / 409 / 200 as expected |
| Runtime | `audit_log_page` as admin / manager / customer | 200 / 403 / 403 |

Nothing was committed or deployed. The ERP app was not touched by this batch.
