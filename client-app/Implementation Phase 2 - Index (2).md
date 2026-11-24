# Implementation Phase 2 - Index and coverage map

One page that shows **every request you have made, and which guide section specifies it**. It adds no new instructions. Read it first, then open the section it points to. Written 2026-11-21. Section numbers were taken from the headings of the uploaded files; nothing was compiled or run.

**Rule for conflicts:** Stage 3 corrects Stage 1 (S3 Section 2, C1 to C11), and Stage 3 Section 5 replaces Stage 1's order of work. Where S1, S2 and S3 disagree, the later stage wins.

## 1. Reading order

| Order | Document | Use it for |
|---|---|---|
| 1 | `Full_App_Architecture_2.md` | **Authority.** Decisions D1–D25, roles, tables, data paths and the cross-app documentation rule |
| 2 | `Client_App_Ecosystem_Alignment.md` | Where the client documents still disagree with the architecture, and the ordered edits |
| 3 | This index | Finding where a request lives |
| 4 | S1 (`Implementation Phase 2 - Stage 1.md`) | Screen layouts, copy, data models, per-file checklists, acceptance criteria |
| 5 | S2 (`... Stage 2.md`) | Only Sections 1 and 2: recap and Q17 to Q29 defaults. **The uploaded file stops there**; its promised Sections 3 to 9 were carried into S3 |
| 6 | S3 (`... Stage 3.md`) | Corrections to S1, final job-scope contract, working code, the single build order, device matrix |
| 7 | S4 (`... Stage 4.md`) | Client-side cutover inventory: which mock each backend route replaces, storage, push and the mock-switch list. Table names and the data path are corrected by D1/D3/D9/D10 and the banner at the top |
| 8 | S5 (`... Stage 5.md`) | Build profiles, permissions, privacy and deletion, store plan, monitoring, rollback |
| 9 | Dashboard Addendum (`Implementation Phase 2 - Dashboard Addendum.md`) | Final Home block order, quick actions, action-card stack; amends S1 Section 13 and S3 step 17 |
| 10 | Live Tracking Addendum (`... Live Tracking Addendum.md`) | Customer map, polling contract, privacy; the staff-side sender is `erp-app` (D21 open) |
| 11 | Technician Mobile App (`... Technician Mobile App.md`) | Design base for `erp-app/`: shared status machine, ordered offline queue, version gate, contact rule |
| 12 | Technician Workspace (`... Technician Workspace (ERP).md`) | Field workflows and the guest job-complete page; delivered through `erp-app/` and `admin-web/`, not a web workspace inside `admin/` |
| Skip | `Implementation Phase 2.md` (first draft) | Superseded by S1 |

## 2. Your first message (the original brief)

| Request | Where |
|---|---|
| Check the code against `Gabfix_UI_Progress.md` | S1 Section 1 (audit); S1 Section 7 (housekeeping) |
| Support email, call and WhatsApp numbers | S1 Section 2 (A); fixed call number in S1 D18 |
| New order step between Details and Add-ons: job scale, rooms, photos and video | S1 Section 3 (B); final schema-driven design in S3 Section 3 |
| Profile: add Notifications, Security, Devices and sessions | S1 Section 4 (C), layout in 4.1 |
| Six answers (call number, score dip, Phase 9, backend timing, wrong-password code, SDK checks) | S1 D15 to D19; S2 Section 1 |
| Keep Gabfix design, colours and layout | S1 design rule; S2 intro |

## 3. The 23 change items

| # | Request | Where |
|---|---|---|
| 1 | Download receipt PDFs | S1 11.1 |
| 2 | MTN/Airtel "Use new number", prefix validation, save per network | S1 11.2; table `saved_wallet_numbers` in S4 2.1 |
| 3 | Save draft returns to Home ("Continue your booking") | S1 12.1; code in S3 4.2 (`dismissTo`) |
| 4 | Remove capsules and Top Cleaners from Hero | S1 13.0 to 13.2 |
| 5 | Remove Home Cleaning and Property/Office blocks; stats tiles, Balance due card, other at-a-glance ideas | S1 13.1, 13.3, 13.5 |
| 6 | Bottom-pinned drawers (Remove method, Pay Balance) | S1 11.5 |
| 7 | Filterable, searchable transaction history | S1 11.4; code in S3 4.1 |
| 8 | Active field stays above the keyboard | S1 12.2; library note in S3 C1 |
| 9 | Services as twin cards by category; dynamic details form for admin-added services | S1 14.2 to 14.4; final form engine in S3 Sections 3 and 4.4 |
| 10 | Pay Balance uses the processing page and asks which number or card | S1 11.3 |
| 11 | Cleaner photo after 6 minutes, with push and in-app notice | S1 12.3; code in S3 4.3; real version in S4 5.5 |
| 12 | Discard goes to Services | S1 12.1; S3 4.2 |
| 13 | Remove How it Works and Loved by Customers from Home | S1 13.0 to 13.1 |
| 14 | Remove the yellow shape when logged in | S1 13.2 |
| 15 | Optional rating of the job and the cleaner | S1 12.4 |
| 16 | Remove Reviews, Related, Top Cleaners, How it Works, Discount badge and trust strip from service pages | S1 14.5 |
| 17 | Refer and Earn rows open the friend lists | S1 16.5 |
| 18 | Active Bookings tab text in deeper green | S1 16.1; default Q24 in S2 |
| 19 | Help Center "Browse by topic" for creating a ticket | S1 16.3; reference image `Ticket.jpg` |
| 20 | FAQ chip alignment | S1 16.4 |
| 21 | Contact Us as a bottom button | S1 16.3 |
| 22 | Cancel booking text in red | S1 16.2 |
| 23 | Remove Service Areas; Most popular cards to match the Home Cleaning card style | S1 Section 15 (I); S1 13.4 |

## 4. After the screens

| Topic | Where |
|---|---|
| Build order (22 steps, two-developer lanes) | S3 Section 5 |
| Progress-document patch and counts | S3 Section 6; S1 Section 8 |
| Device matrix and definition of done | S3 Section 7; S1 10.2 |
| Open questions and the defaults adopted (Q1 to Q29) | S1 Section 9; S2 Section 2 |
| Backend and mock cutover (Q30 to Q35) | S4 |
| Release and operations (Q36 to Q39) | S5 |
| Packages and `app.json` changes | S1 Section 5 and 4.12; S3 C1 |
| Dashboard extras (quick actions, Active job, Next visit, ticket card, Invite banner); open questions Q40 to Q43 | Dashboard Addendum |
| Live technician map: customer map fixes, `technician_locations`, `tracking_state`, tracking endpoints; Q44 to Q48 | Live Tracking Addendum |
| Technician workspace: roles, screens, job lifecycle, dispatch, cash confirmation, offline queue, ERP changes; Q49 to Q55 | Technician Workspace, Sections 1 to 16 |
| Guest job-complete link: Active and App-only states, feedback once, 30-day limit, clean-up; Q56 to Q60 | Technician Workspace, Section 17 |
| Express modular SSR (guest page, receipts and PDFs, legal pages); Q61 to Q63 | Technician Workspace, Section 18 |
| Receipt and invoice link lifetime (permanent in-app copy, revocable shareable link) | Technician Workspace, Section 17.3 |
| Cross-app authority, stale references and the ordered doc edits | `Full_App_Architecture_2.md`; `Client_App_Ecosystem_Alignment.md` |

## 5. Gaps that remain in the documents

1. **Dashboard stats image (Q17):** never received. The default tiles are Upcoming, Completed and Total spent (S1 13.3). Sending the image changes one array in `home.tsx`.
2. **Stage 2 file is incomplete:** Sections 3 to 9 are missing from the uploaded copy. S3 holds their content, so no action is needed unless you want that file finished for neatness.
3. **Unchecked APIs:** `FileSystem.createUploadTask`, `StorageAccessFramework.createFileAsync`, the `expo-notifications` time-interval trigger (S3 8.3), plus the "confirm" items in S4 and S5. Each is checked in the step that uses it.
4. **Decisions deferred by you:** SMS provider (S4 Q30) and mobile money gateway (S4 Q31). Neither blocks anything until the backend stage. Until the SMS provider is chosen, guest links and technician invites go by WhatsApp and email.
5. **Nothing is compiled:** the first task when implementing is `npx tsc --noEmit` on a clean install. The `admin/` project has its own check, `npm run typecheck`.
6. **The technician app now exists as `erp-app/`:** one Expo app for all staff, with role-filtered screens, tracked in `Technician_App_Setup_Checklist.md`. The "ERP workspace inside `admin/`" wording in the Technician Workspace document is superseded by architecture §1/D7; `admin-web/` remains the desk surface. Background location comes from the native app, not a browser page (D23 still open).
7. **Guest link wording:** Technician Workspace Section 17.3 (App-only page) replaces any earlier "link ended" or permanent-receipt-link idea, including in the Express note.
8. **Demo ERP logins are gone:** `admin-web` now signs in through Supabase Auth (`signInWithPassword`) and reads the role from `profiles`; the hard-coded accounts were removed (setup checklist D2). The client app's own mock auth remains behind an unset `EXPO_PUBLIC_API_BASE_URL` until the Hono `api` function exists.
9. **Questions added since S5:** Q40 to Q63 are listed in the addenda and Technician Workspace, each with a default.

## 6. Where the code stood when this index was written

The uploaded repo snapshot was still unchanged: no `src/config/support.ts`, no `src/config/mock.ts`, no new packages, and `src/config/areas.ts` still present. Every item above is therefore **specified, not built**.
