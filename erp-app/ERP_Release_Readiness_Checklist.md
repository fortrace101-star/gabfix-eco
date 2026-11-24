# ERP App Release Readiness Checklist

Scope: what must be true before `erp-app/` (Gabfix Portal) is handed to staff or shipped as an
Android APK. This is the release gate that follows the build-out in
`../Technician_App_Setup_Checklist.md`; it does not repeat setup tasks that are already complete.

Legend: `[x]` done and verified · `[~]` done on web/build only, or partially done · `[ ]` open.

Last updated: 2026-11-24 (next-session plan recorded in `Gabfix_Architecture_Implementation_Plan_with_Edit_Classifications.md` §13; no new ERP release verification this session).

---

## 0. Verified baseline

- [x] Launcher icon: `assets/images/icon.png` is 1024×1024, opaque, Gabfix mark on `#118E45`;
      adaptive foreground is transparent and content sits inside the 66% safe zone.
- [x] Splash: brand-green background with `gabfix-logo.png` at 120px width; in-app sign-in uses the
      same mark through `src/components/brand/brand-logo.tsx`.
- [x] App identity: name `Gabfix Portal`, slug `gabfix-portal`, scheme `gabfixportal`,
      Android `ug.gabfix.portal`, iOS `ug.gabfix.portal`, light UI, portrait.
- [x] `npx expo config --type public` parses both app config and assets.
- [x] `npx tsc --noEmit` passes.
- [x] Expo CLI prompt crash fixed: `patches/prompts+2.4.2.patch` plus
      `postinstall: patch-package --error-on-fail`; terminal focus events no longer crash confirms.
- [~] Auth, role tabs, jobs, job detail, schedule, cash and profile were browser-verified against
      the local Supabase stack. None of those screens has had a native device pass.

---

## A. Branding and app configuration

- [ ] Final `version` and Android `versionCode` chosen. EAS currently uses
      `appVersionSource: "remote"`, so confirm the remote values before the first store build.
- [ ] Final app display name and role/tab wording approved by the owner.
- [ ] Launcher icon checked after Android adaptive masking on a device (circle, squircle and
      rounded-square if the launcher exposes them).
- [ ] Splash checked cold-start on a physical Android device; no white flash before the brand screen.
- [ ] Web favicon and web title checked in the exported web build.
- [ ] Bundle identifiers confirmed as permanent: changing `ug.gabfix.portal` after release creates a
      new app identity.

## B. Authentication and access control

- [ ] Admin, manager, customer relations and technician each sign in on a native build.
- [ ] Session survives app restart; expired/revoked session returns to sign-in with a clear message.
- [ ] Deactivated account is blocked by the UI and by RLS.
- [ ] Every role sees only its allowed tabs and routes; direct/deep links to forbidden routes are
      rejected.
- [ ] Sign-out clears session, cached queries and any pending offline actions.
- [ ] Password reset and invite paths are either implemented or explicitly out of scope for v1.

## C. Staff workflows

- [ ] Overview/home KPIs match the database for each role.
- [ ] Bookings list, filters and booking detail render real rows and respect role scope.
- [ ] Job flow: on the way → in progress → complete, including billed hours and status history.
- [ ] Job photos: camera and library upload, retry after failure, private bucket access.
- [ ] Cash: record payment, handover, today's total, and duplicate-submit protection.
- [ ] Customers, notifications and profile screens have real empty, loading and error states.
- [ ] Alerts route is reachable from the bell and not exposed as a tab.
- [ ] Push notifications are either working (token registration + deep link) or explicitly disabled
      for the first release.

## D. Data, offline and failure behavior

- [ ] `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set for the build; no local
      loopback URL is baked into a device build.
- [ ] RLS verified for every role against the hosted/staging project, not only local Supabase.
- [ ] Offline banner, cached reads and queued actions replay correctly after reconnect.
- [ ] Failed RPCs show actionable messages; no silent failure and no raw Supabase error text.
- [ ] Slow network and Supabase timeout produce a retry path instead of a blank screen.
- [ ] No service-role key, test credential or seeded demo account ships in the app bundle.

## E. Quality gates

- [ ] `npx expo-doctor` passes.
- [ ] `npx tsc --noEmit` passes on the release commit.
- [ ] `npx eslint src` passes on the release commit.
- [ ] `npx expo export --platform web` succeeds if web output remains supported.
- [ ] No unresolved `TODO`, `FIXME`, placeholder copy or mock data on release screens.
- [ ] Accessibility pass: labels on icon-only buttons, 48dp touch targets, readable contrast,
      screen-reader order on the main flows.

## F. APK and device verification

- [~] EAS preview build attempted 2026-11-24. Project, remote credentials and keystore resolved,
      but the build was rejected because the free-plan Android build quota for the month is used
      (resets 2026-12-01). No APK was produced. The attempt incremented the remote Android
      `versionCode` from 4 to 5.
- [ ] `eas build --platform android --profile preview` produces an installable APK.
- [ ] APK installs on a clean device (no previous build, no Expo Go).
- [ ] Cold start reaches sign-in without a development menu or redbox.
- [ ] Launcher icon, splash, status bar and orientation behave as configured.
- [ ] Camera, photo library, network detection and any secure storage work on device.
- [ ] Back button, predictive back setting and Android keyboard insets behave correctly.
- [ ] Release build points at production/staging Supabase, never localhost.
- [ ] Build artifact and install result recorded in the release notes.

## G. Store/release hand-off

- [ ] Release keystore owned by the organization and backed up; EAS credentials access confirmed.
- [ ] Privacy policy, support contact and account-deletion path ready if the app is published.
- [ ] Version notes and known limitations written for the staff rollout.
- [ ] Rollback plan: previous APK retained and backend changes are backward compatible.

---

## Done when

The preview APK installs on a clean Android device, all four roles complete their primary workflow
against staging, `expo-doctor`/tsc/lint pass on the release commit, and no local-only configuration
or mock data remains in the bundle.

## Suggested order

1. A (freeze identity and version) and D (point at staging, verify RLS).
2. B and C native-device pass.
3. E quality gates.
4. F cloud APK build and clean-device install.
5. G credentials and hand-off.
