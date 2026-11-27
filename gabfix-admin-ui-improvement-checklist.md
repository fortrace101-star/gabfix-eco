# Gabfix admin console — improvement checklist

Follow-up work for `admin-web` after the theme in `gabfix-admin-ui-optimization-plan.md` was applied
and the sidebar/catalogue nits were fixed. Every measurement below comes from headless Chrome against
the local stack (`admin@gabfix.ug`, seeded data) at 1440×900, 1280×900 and 1024×900 on 2026-11-26.

Rules that stay in force: no font size below 12px, radii only 12/14/16/20/28/999, colours only through
tokens, 248px sidebar / 64px topbar / 1440px frame, 1024px minimum width with the larger-screen notice
below it.

**Priority:** P0 = visible defect now · P1 = next polish pass · P2 = hardening / nice to have.

## A. Tables that still scroll sideways

The page frame never overflows (document width equals the viewport on all 16 pages at all three
widths), but the table cards inside it clip. `scrollWidth / clientWidth` of `.table-scroll`:

| Page | 1024 (`854`) | 1280 (`918`) | 1440 (`1078`) |
| --- | --- | --- | --- |
| Bookings | fits (854 / 854) | fits (918 / 918) | fits (1078 / 1078) |
| Payments | fits (854 / 854) | fits (918 / 918) | fits (1078 / 1078) |
| Overview — Live bookings | fits (854 / 854) | fits (918 / 918) | fits (734 / 734) |
| Job costs | fits (854 / 854) | fits (918 / 918) | fits (1078 / 1078) |
| Cash collections | fits (854 / 854) | fits (918 / 918) | fits (1078 / 1078) |
| Customers | fits (854 / 854) | fits (918 / 918) | fits (1078 / 1078) |
| Catalogue | fits (854 / 854) | fits (918 / 918) | fits (770 / 770) |

Re-measured 2026-11-26 after the narrow-width pass: every `.table-scroll` reports
`scrollWidth === clientWidth` at 1024, 1280 and 1440, and the document width never
exceeds the viewport.

- [x] **P0 — Payments at 1440.** Fixed by folding the booking reference under the transaction id
      (9 columns → 8), so the table reads 1078 / 1078 at 1440. It still clips below 1440 (`994` against
      918 at 1280 and 854 at 1024) — see the P1 below.
- [x] **P0 — Overview "Live bookings" at 1440 and 1280.** Fixed by moving the time into the booking
      sub-line (Booking · area · time); the action rail then keeps its place beside the charts from 1280
      up. Reads 734 / 734 at 1440, 660 / 660 at 1366, 654 / 654 at 1360, 918 / 918 at 1280 (stacked
      rail, collapsed sidebar) and 854 / 854 at 1024.
      The dashboard briefly stacked its rail between 1280 and 1360; that is gone, because it made the
      same build look like two different products six pixels apart and it no longer was needed. Between
      1280 and 1335 the live table's columns bottom out at 640px, so it scrolls inside its named region
      by up to 64px there instead of the layout flipping shape.
- [x] **P1 — Payments below 1440.** Closed by the narrow-width pass: gutters 12 → 7px below 1440 and
      → 5px below 1100, headers may wrap, and the 36-character transaction reference may wrap
      (`.cell-ref`) instead of forcing a fixed width. 994 → fits 918 at 1280 and 854 at 1024.
- [x] **P1 — Bookings table.** Same pass: 1029 → 918 at 1280, 854 at 1024. The time also keeps its
      `nowrap` sub-line so a tightened column cannot split `12:00 pm` over two lines.
- [x] **P1 — Job costs at ≤1280.** Fits via the same gutter trim (932 → 918 / 854).
- [x] **P1 — Cash / Customers at 1024.** Both now fit (873 → 854).
- [x] **P1 — Catalogue at 1024–1279.** The stacked-rail band is now `max-width: 1429px`, so the rail
      sits above the table at 1024–1279 too: 750 in 546 → 854 in 854.
- [x] **P1 — Catalogue rail density.** Category rows stay two lines at 288px; the name and meta line
      truncate with an ellipsis instead of wrapping to three lines. Full text stays in the drawer.
- [x] **P1 — Zebra rows.** Alternating rows now use `--row-alt` (#eef2ef) with `--row-hover` for the
      hover state, so a wide row can be followed across without losing the hover cue.
- [x] **P1 — Window scrollbar.** The document scrollbar is hidden (`html { scrollbar-width: none }`) and
      the sidebar nav track with it; the prefetch/scroll affordance is the existing bottom fade. Page
      and inner scrolling are unchanged.
- [ ] **P2 — Regression guard.** Commit the audit as `admin-web/scripts/table-audit.mjs` (CDP or
      Playwright) asserting `scrollWidth === clientWidth` on every `.table-scroll` at 1024/1280/1440,
      and run it in the pre-release checklist.

## B. Catalogue rail density

- [ ] **P1 — Category rows wrap at 288px.** "Upholstery and carpets" and the "n live" meta break onto
      two lines because the caret, drag grip, Live chip and gear leave the name ~124px. Move the Live
      chip and gear to a hover/focus action row, or reduce Live to a status dot with a tooltip. Done
      when every category row is one line at 288px.
- [ ] **P1 — Rail header copy** ("Drag a row to reorder it within its level; parents group the tree")
      runs to three lines at 288px. Shorten to one line and keep the full sentence in a `title`.
- [ ] **P2 — Nested levels.** With density fixed, check a three-deep tree: indentation currently eats
      the same width as the badges.

## C. CSS architecture

- [ ] **P1 — Consolidate the cascade.** `styles.css` (4,680 lines) + `theme.css` (2,468) override each
      other; 7,273 lines of CSS for one SPA. Merge duplicated selectors into one sectioned sheet (or
      split per feature) and delete overrides that now match the base rule.
- [ ] **P1 — Dead rules.** `.mobile-menu` and `.sidebar-scrim` have CSS but no JSX consumer (the mobile
      menu was removed); drop the 6 rules.
- [ ] **P2 — Raw hex left.** 27 in `styles.css`, 11 in `theme.css` (the catalogue mask gradient is
      intentional); move the rest onto tokens so a palette change stays one file.
- [ ] **P2 — Inline styles.** 5 `style={{ … }}` remain in components; move them to classes.
- [ ] **P2 — Style lint.** Add a check for the three plan rules (font-size ≥ 12px, allowed radii, no raw
      hex outside `tokens.css`) so the theme cannot drift.
- [ ] **P2 — Legacy aliases.** `tokens.css` keeps old variable names for compatibility; once no selector
      uses them, remove or document them.

## D. Accessibility

- [x] **P0 — Scrollable tables are keyboard-only reachable.** All 17 `.table-scroll` regions now carry
      `role="region"`, an `aria-label` matching their table, and `tabIndex={0}`, with a 2px green focus
      ring (`.table-scroll:focus`) so the scroll position is visible while tabbing.
- [x] **P0 — No skip link.** `.skip-link` in `App.tsx` is the first tab stop; it focuses
      `main#main-content` without changing the hash (the router owns `location.hash`), and stays hidden
      off-screen until focused.
- [ ] **P1 — Table names.** All tables rely on `aria-label`; 0 `<caption>` elements. Either add a
      visually hidden `<caption>` or keep `aria-label` consistently — not both styles mixed.
- [ ] **P1 — Focus inside scrollers.** Check focus rings on nav items and table rows are not clipped by
      the scroll container (the sidebar fade mask can cut a ring at the bottom edge).
- [ ] **P1 — Reduced motion.** Only one `prefers-reduced-motion` rule exists; cover page transitions,
      hero bands, drawer slide-in and the realtime pill pulse.
- [ ] **P1 — Contrast.** Measure `--text-muted` on `--bg`/`--surface` and the yellow tokens on white;
      document ratios in `tokens.css` and fix anything under 4.5:1 for body text.
- [ ] **P2 — Live regions.** 13 `aria-live`/`role="status"` uses; confirm toasts share one polite region
      so screen readers do not queue duplicates.
- [ ] **P2 — Icon-only controls.** The rail's gear button and the topbar bell need explicit
      `aria-label`s; audit every icon-only button.

## E. States and data volume

- [ ] **P1 — No pagination anywhere.** `pageSize`/paging does not exist in the app; 21 catalogue rows
      and 9 bookings are fine, a few hundred are not. Add a page size (or windowing) to the long tables.
- [ ] **P1 — No skeletons.** Initial loads show a text spinner (`page-loading`); add table/list
      skeletons with reserved height so the hero and KPI row do not jump.
- [ ] **P1 — Error states.** Audit each page for a shared error card with Retry, matching the login and
      data-load messages, instead of per-page strings.
- [ ] **P2 — Empty vs filtered-empty.** Confirm every list distinguishes "nothing yet" from "no matches"
      (Catalogue does; check Customers, Cleaners, Promos, Support).
- [ ] **P2 — Long content.** Agree one truncation rule for names/addresses (`.cell-main` wraps, others
      ellipsis) and apply it to every table.

## F. Performance

- [ ] **P1 — One 672 kB JS chunk.** All 16 pages load up front (no `React.lazy` anywhere). Route-level
      lazy loading should bring the entry chunk under the 500 kB warning and speed up sign-in.
- [ ] **P2 — Fonts.** `--font-display`/`--font-body` name Poppins and Inter but nothing loads them (no
      `@font-face`), so rendering depends on what the machine has installed. Either self-host with
      `preload` or drop to the system stack so every desk looks the same.
- [ ] **P2 — CSS weight.** 90 kB of CSS (16 kB gzip) with dead selectors; measure after C1 and consider
      scoping page CSS.
- [ ] **P2 — Realtime refetch.** `liveTick` reloads the active page on any change; check a burst (bulk
      assignment) does not fire repeated full re-reads.
- [ ] **P2 — Catalogue thumbnails.** 34px images are fetched at full object size; request the resized
      variant and add width/height plus `loading="lazy"`.

## G. Consistency and polish

- [ ] **P1 — Number format.** "UGX 70,000" and "UGX 45,000/hr" are consistent, but decimals/rounding in
      KPIs (`UGX 2.5m`) and tables should share one formatter; audit for `UGX` suffix variants.
- [ ] **P1 — Dates.** Tables mix "20 Nov 2026", "Today", and short times; fix one format per context
      (table cell vs KPI caption) in a shared helper.
- [ ] **P2 — Metric meaning.** Catalogue reads "Services live 19/21" while the table shows 21 rows;
      add a tooltip or sub-label making clear what the 2 excluded rows are.
- [ ] **P2 — Drawer height.** Verify booking, payment and assign drawers at 900 and 768 heights with the
      longest seeded booking, so the footer actions stay reachable.
- [ ] **P2 — Print.** Reports have no print stylesheet; if the desk prints reports, add `@media print`
      for the hero, sidebar and table.

## H. Verification

- [x] **P1 — Smoke tests added (2026-11-27).** `admin-web/tests/admin-smoke.spec.ts` now has 6
      Playwright smoke tests: sign-in shell, all 16 nav pages, table row count, drawer open/Esc,
      1023/1024 notice boundary, and Overview layout order/65-35 chart ratio/full-width live table/three
      equal queue cards. Run with `cd admin-web && npx playwright test` (Chrome channel, dev server). Still
      missing: broader coverage, visual baselines in CI.
- [ ] **P2 — Visual baselines.** Keep the 1440/1280/1024 screenshots of Overview, Bookings, Payments,
      Costs, Reports and Catalogue as the review set for future theme changes.
- [ ] **P2 — Do not deploy until the API is redeployed.** `paidTotal`/`cashPaid`/`cashPaidAt` exist in
      the admin build but not in the deployed function, so a deploy today would ship money fields that
      stay empty.
