# Gabfix Admin Web — UI Optimization Plan

Aligning `admin-web/` with the `client-app/` theme and layout, adapted for desktop.

Source of truth for values: `client-app/src/theme/tokens.ts` and `styles.ts`.
Target files: `admin-web/src/styles.css` (4,711 lines), `components/ui.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Login.tsx`, `pages/*`.

> Scope note: this audit is from reading the code, not from running the app. Phase 0 captures baseline screenshots to confirm each finding visually. Pages not read in detail: Catalogue, Forms/FormBuilder, Quotes, Support, Reports.

---

## 1. Current state

### Already aligned
- Palette core: green 500/700/900, yellow 500, bg `#F6F8F6`, border `#DDE5DF`, text `#16221A`, muted `#5F6F65`.
- Poppins headings, Inter body; h1/h2/h3 = 26/20/17px.
- Card radius 20px, card shadow `0 4px 16px rgba(26,94,47,.08)`.
- Sidebar active item = yellow pill with dark-green content (desktop version of the client tab bar).
- Overview hero band: green gradient, white type, yellow CTA.

### Drift found

| # | Finding | Evidence | Client standard |
|---|---|---|---|
| 1 | Type too small | ~150 declarations at 8–11px (`10px` x40, `11px` x27, `9.5px` x22, `10.5px` x22, `9px` x14, `8px` x2). Table headers 10.5px. | Caption 12px, body 14px. Nothing smaller. |
| 2 | Radius sprawl | 19 distinct values (4,5,6,7,8,9,10,11,12,13,14,15,16,18,20,24,28,999). | 12 / 14 / 16 / 20 / 28 / 40 / pill |
| 3 | Colour drift | ~40 raw hex outside `:root`. Info `#276b9e` (client `#1976D2`). Neutral chip `#eef2ef` (client `#E3E8E4`). Warning text `#806910` (client yellow800 `#8A6D00`). `--green-600 #0e7a3b` has no client equivalent. | One token file |
| 4 | Tokens incomplete | `:root` has ~28 vars. Spacing, sizes, durations, z-index hard-coded. | Full token set |
| 5 | Hero only on Overview | Other pages use plain `.page-head`. | Green hero is the signature |
| 6 | Mobile code in desktop app | Breakpoints 840px, 620px; drawer sidebar; `.mobile-menu`; `.sidebar-scrim`; `mobileOpen` state. | Not needed |
| 7 | Tables | `min-width: 690px`, 10.5px headers, 12px padding, no sticky header. | Airy, readable |
| 8 | Modal is the only detail pattern | Booking details, payments, assign cleaner open centred modals. | Bottom sheet → desktop right drawer |
| 9 | Fake UI facts | Cash nav badge hard-coded `3`. Footer always "All systems operational / Last checked 2 min ago". | Real data (`live` status exists in `App.tsx`) |
| 10 | Inline styles | 11 `style={{}}` in `AssignCleanerDialog`; a few in Overview/Reports/Promos/Catalogue. | No local values |
| 11 | Icons | Custom SVG set (`Icon.tsx`). | `lucide-react-native` |

---

## 2. Design tokens (create `src/styles/tokens.css`)

### 2.1 Colours

| Token | Hex | Use |
|---|---|---|
| `--green-50` | `#E8F6EE` | Row hover, selected fill, success chip bg, stat tile bg |
| `--green-100` | `#C5E8D3` | Avatar bg, hover border on secondary buttons |
| `--green-300` | `#5BBF86` | Charts secondary series, progress |
| `--green-500` | `#118E45` | Primary button, links, focus border, hero start |
| `--green-700` | `#1A5E2F` | Primary hover, hero end, eyebrow text, success chip text |
| `--green-900` | `#1C411E` | Sidebar bg, text on yellow |
| `--yellow-50` | `#FFFCE0` | Warning chip bg |
| `--yellow-200` | `#F5EE5E` | Yellow hover, eyebrow on hero, text selection |
| `--yellow-500` | `#F7EB15` | Active nav pill, CTA on green, brand mark |
| `--yellow-600` | `#E7BE1F` | Warning dot |
| `--yellow-800` | `#8A6D00` | Warning chip text (replaces `#806910`) |
| `--bg` | `#F6F8F6` | Page background |
| `--surface` | `#FFFFFF` | Cards, inputs, topbar |
| `--border` | `#DDE5DF` | Card, input and divider borders |
| `--disabled-bg` | `#E3E8E4` | Disabled controls, neutral chip bg |
| `--disabled-text` | `#9AA79F` | Disabled text, placeholder |
| `--text` | `#16221A` | Body text |
| `--text-muted` | `#5F6F65` | Captions, table headers |
| `--success` / `--success-bg` | `#118E45` / `#E8F6EE` | |
| `--warning` / `--warning-bg` | `#E7A500` / `#FFF4D6` | Fills, icons, dots only (see 7) |
| `--error` / `--error-bg` | `#D32F2F` / `#FDECEC` | Destructive, error chip |
| `--info` / `--info-bg` | `#1976D2` / `#E8F1FB` | Info chip |
| `--focus-ring` | `rgba(17,142,69,.18)` | 3px focus halo |
| `--scrim` | `rgba(22,34,26,.40)` | Modal/drawer backdrop |
| `--on-green-muted` | `rgba(255,255,255,.85)` | Secondary text on hero/sidebar |
| `--glass` | `rgba(255,255,255,.14)` | Hero stat tiles, ghost buttons on green |

Remove: `--green-600`, `--blue-500`, `--surface-soft`, `--muted-soft` (fold into `--text-muted` / `--disabled-text`).

### 2.2 Typography

| Token | Font | Weight | Size / line | Extra | Use |
|---|---|---|---|---|---|
| `display` | Poppins | 700 | 32 / 40 | | Login headline, hero numbers |
| `h1` | Poppins | 700 | 26 / 34 | | Page title |
| `h2` | Poppins | 600 | 20 / 28 | | Card, drawer, modal titles |
| `h3` | Poppins | 600 | 17 / 24 | | Section labels, empty-state title |
| `body` | Inter | 400 | 14 / 20 | | Default, table cells |
| `bodyM` | Inter | 500 | 14 / 20 | | Nav items, labels |
| `bodySemi` | Inter | 600 | 14 / 20 | | Buttons, emphasis |
| `caption` | Inter | 500 | 12 / 16 | | Meta, helper, chips |
| `th` | Inter | 600 | 12 / 16 | uppercase, 0.04em | Table headers |
| `eyebrow` | Inter | 600 | 12 / 16 | uppercase, 0.08em | Above page title |
| `kpi` | Poppins | 600 | 28 / 36 | tabular-nums, -0.02em | KPI value |
| `price` | Poppins | 700 | 20 / 24 | tabular-nums | Money in cards |

Rule: **no font-size below 12px**. All money and counts use `font-variant-numeric: tabular-nums`. Letter-spacing on headings: normal.

### 2.3 Spacing (4pt)

`--space-1 4` · `2 8` · `3 12` · `4 16` · `5 20` · `6 24` · `8 32` · `10 40` · `12 48` · `16 64`

### 2.4 Shapes (radius)

| Token | px | Use |
|---|---|---|
| `--r-input` | 12 | Inputs, selects, icon buttons, small buttons, search, inner table chips |
| `--r-button` | 14 | Buttons (40px high) |
| `--r-tile` | 16 | Stat tiles, inner blocks, hero stat tiles, popovers |
| `--r-card` | 20 | Cards, modals, drawer inner cards |
| `--r-sheet` | 28 | Hero band bottom corners, drawer top-left/bottom-left corners |
| `--r-hero` | 40 | Login brand panel corner |
| `--r-pill` | 999 | Chips, nav badges, avatars, toggles |

Mapping for existing values: 4–11 → `--r-input`; 13–15 → `--r-button`; 16–18 → `--r-tile`; 20–24 → `--r-card`; 28 → `--r-sheet`.

### 2.5 Shadows

| Token | Value | Use |
|---|---|---|
| `--shadow-card` | `0 4px 16px rgba(26,94,47,.08)` | Cards (keep) |
| `--shadow-popover` | `0 12px 32px rgba(28,65,30,.16)` | Menus, search/notification popovers |
| `--shadow-drawer` | `-12px 0 32px rgba(28,65,30,.14)` | Right drawer |
| `--shadow-modal` | `0 18px 50px rgba(22,34,26,.18)` | Confirm dialog |

### 2.6 Sizes, motion, layers

| Token | Value |
|---|---|
| Button | 40px (small 32px) |
| Input / select | 40px |
| Icon button | 40px (small 32px) |
| Table row | 52px (compact 44px) |
| Table header row | 40px |
| Topbar | 64px |
| Sidebar | 248px (rail 72px) |
| Avatar | sm 28 · md 36 · lg 48 |
| Icon | 20px default, 16px inline in buttons, 24px in empty states |
| Motion | press 100ms · fast 180ms · base 250ms · slow 300ms (keep reduced-motion block) |
| z-index | base 0 · sticky 10 · header 20 · drawer 30 · toast 40 · modal 50 |

---

## 3. Pattern mapping: client (mobile) → admin (desktop)

| Client app | Admin web |
|---|---|
| Bottom tab bar, yellow pill | Left sidebar, yellow pill (keep) |
| Green hero + overlapping card (`marginTop:-40`) | Compact page hero, KPI row overlapping its bottom edge by 40px |
| Bottom sheet (radius 28) | Right drawer, 480/640px |
| Confirm sheet | Centred confirm dialog, 440px |
| Sticky summary bar (72px) | Sticky drawer footer 72px; bulk-action bar above tables |
| Selectable card (2px green border, green50 fill) | Same, in choosers |
| Segmented control / filter chips | Tabs + filter chips in one toolbar row |
| Stat tile | KPI card / stat tile |
| Settings list | Settings page with left sub-nav |
| Empty / error / offline / skeleton | Same set, built once |
| 16px gutters, single column | 32px gutters, 12-column grid, max 1440px |

---

## 4. Layout and positioning

### 4.1 App shell (viewport ≥ 1280px)

```
┌───────────────┬────────────────────────────────────────────────────┐
│ SIDEBAR       │ TOPBAR  (sticky top:0, height 64, z 20)            │
│ fixed left    ├────────────────────────────────────────────────────┤
│ 248 x 100vh   │ PAGE FRAME  max-width 1440, margin 0 auto          │
│ bg #1C411E    │ padding 24px 32px 48px                             │
│ z 20          │   Page hero / header                               │
│               │   Content grid (12 cols, gap 24)                   │
└───────────────┴────────────────────────────────────────────────────┘
```

- `.app`: `display:grid; grid-template-columns: 248px minmax(0,1fr)`.
- 1024–1279px: columns `72px minmax(0,1fr)`, sidebar shows icons only with tooltips.
- Below 1024px: full-screen notice "Use a larger screen". Delete the 840/620 rules, drawer sidebar, `.mobile-menu`, `.sidebar-scrim`, `mobileOpen`.

### 4.2 Sidebar (position: sticky, top 0, height 100vh)

| Element | Spec |
|---|---|
| Container | bg `--green-900`, padding `24px 16px 16px`, flex column, gap 16 |
| Brand row | 44px high; mark 38x38, radius 12, bg `--yellow-500`, "G" Poppins 700 23px `--green-900`; "Gabfix" Poppins 700 18px white; "OPERATIONS" Inter 600 12px, 0.14em, `rgba(255,255,255,.55)` |
| Group label | Inter 600 12px, uppercase 0.1em, `rgba(255,255,255,.45)`, padding `0 12px 6px` |
| Nav item | height 44, padding `0 12px`, radius `--r-input` (12), gap 12, icon 20px, label Inter 500 14px `rgba(255,255,255,.78)` |
| Hover | bg `rgba(255,255,255,.08)`, text white |
| Active | bg `--yellow-500`, text and icon `--green-900`, weight 600 |
| Badge | min-width 20, height 20, radius pill, 12px/700, bg `--yellow-500` text `--green-900` (inverted when item active); value from real data |
| User block | Above footer: avatar 36, name Inter 600 14px white, role 12px `rgba(255,255,255,.6)`; sign-out moves into topbar identity menu |
| Footer | border-top `rgba(255,255,255,.1)`, 8px dot (`#66E39A` live / `--yellow-600` connecting / `--error` offline), text 12px, shows real `live` status |
| Collapse toggle | 32x32 icon button at the bottom-right edge, persists choice |

### 4.3 Topbar (sticky top 0, z 20)

- Height 64, padding `0 32px`, bg `rgba(255,255,255,.94)` + `backdrop-filter: blur(14px)`, border-bottom 1px `--border`.
- Left to right: global search (width `min(420px, 34vw)`, height 40, radius 12, border 1px `--border`, bg `--surface`, placeholder 14px `--disabled-text`, `⌘K` hint 12px), flexible space, date range select (40px, radius 12), notification icon button 40px with badge (18px circle, `--error`, 12px/700 white, offset top -4 right -4, 2px white ring), identity block (avatar 36, name 14px/600, role 12px muted, 1px left divider, opens menu with Sign out).
- Search popover: top `calc(100% + 8px)`, width = input, radius 16, `--shadow-popover`, result rows 48px.
- Notification popover: right-aligned, width 380px, radius 16, rows 64px, `--shadow-popover`.

### 4.4 Page frame and grid

- `.page-wrap`: max-width 1440, padding `24px 32px 48px`.
- `.page`: grid, row gap 24.
- 12-column grid, gap 24. Standard splits: **main 9 + rail 3** (rail ≈ 320px) for Overview/Pricing/Settings; **list 5 + detail 7** for master-detail; **4 + 4 + 4** for cards.
- KPI row: 4 columns at ≥1280, 2 at 1024–1279. Gap 24.

### 4.5 Page hero (variant `hero`)

| Property | Value |
|---|---|
| Position | Top of page frame, full content width |
| Height | ~120px content + 40px overlap zone for the KPI row |
| Padding | `24px 32px 56px` when KPIs overlap, else `24px 32px` |
| Background | `linear-gradient(135deg, #118E45 0%, #1A5E2F 100%)` |
| Radius | `--r-sheet` (28) on all corners (desktop floating band) |
| Decoration | 240px circle, `rgba(255,255,255,.08)`, top -90 right -60 |
| Eyebrow | 12px/600 uppercase, `--yellow-200` |
| Title | Poppins 700 26/34 white |
| Subtitle | Inter 400 14/20 `rgba(255,255,255,.85)`, max-width 640 |
| Actions | Right-aligned, gap 12; primary = yellow `#F7EB15` / text `#1C411E`; secondary = `rgba(255,255,255,.14)` bg, 1px `rgba(255,255,255,.35)` border, white text |
| Overlapping KPI row | `margin-top: -40px`, `position: relative; z-index: 10` |

Variant `plain`: no background; eyebrow `--green-700`, title `--text`, subtitle `--text-muted`, actions right, padding `0 0 8px`.

Use `hero` on Overview, Bookings, Payments, Costs, Reports. Use `plain` on Catalogue, Services, Forms, Promos, Settings, Support, Customers, Cleaners, Approvals, Quotes, Cash. Hero must not push the first table below the fold (≤ 160px + overlap).

---

## 5. Component specs

### 5.1 Buttons

| Variant | bg | text | border | Hover |
|---|---|---|---|---|
| Primary | `#118E45` | white | none | bg `#1A5E2F` |
| Secondary | white | `#118E45` | 1.5px `#118E45` | bg `#E8F6EE` |
| Ghost | transparent | `#118E45` | none | bg `#E8F6EE` |
| Destructive | `#D32F2F` | white | none | darker 8% |
| On-green | `#F7EB15` | `#1C411E` | none | `#F5EE5E` |
| Disabled | `#E3E8E4` | `#9AA79F` | none | none |

Height 40 (small 32), radius 14 (small 12), padding `0 20px` (small `0 14px`), Inter 600 14px, gap 8, icon 16px. Focus: `0 0 0 3px rgba(17,142,69,.18)` plus 1px green outline. Active: `translateY(1px)`. Remove the old green drop shadow on primary.

### 5.2 Inputs

- Height 40, radius 12, border 1.5px `--border`, bg white, padding `0 14px`, text Inter 400 14px.
- Placeholder `#9AA79F`. Focus: border `#118E45` + `0 0 0 3px rgba(17,142,69,.18)`. Error: border `#D32F2F`, message 12px `#D32F2F`. Disabled: bg `#E3E8E4`.
- Label above: Inter 500 14px, margin-bottom 6. Helper below: 12px `--text-muted`, margin-top 6.
- Textarea min-height 120, padding `12px 14px`.
- Toggle: 40x24, pill, off `#DDE5DF`, on `#118E45`, knob 20px white.

### 5.3 Status chip

Height 26, padding `0 10px`, radius pill, Inter 600 12px, optional 6px dot.

| Tone | bg | text |
|---|---|---|
| success | `#E8F6EE` | `#1A5E2F` |
| info | `#E8F1FB` | `#1976D2` |
| warning | `#FFFCE0` | `#8A6D00` |
| danger | `#FDECEC` | `#D32F2F` |
| neutral | `#E3E8E4` | `#5F6F65` |

Keep the existing label-to-tone lookup in `ui.tsx`.

### 5.4 Card

bg white, border 1px `rgba(221,229,223,.8)`, radius 20, `--shadow-card`, padding 24 (compact 16). Header: h2 20/28 left, action right, meta 12px muted below, divider 1px `--border` when body is a table. Tones: `muted` bg `#F6F8F6`; `success` bg `#E8F6EE`; `warning` bg `#FFF4D6`. Selectable: border 1.5px `--border`, selected 2px `#118E45` + bg `#E8F6EE`.

### 5.5 KPI card / stat tile

- Card: padding 20, min-height 132, radius 20.
- Top row: icon box 40x40 radius 12 (bg green50 / yellow50 / info-bg / error-bg; icon 20px), trend pill right (height 24, radius pill, 12px/700).
- Label 12px/600 `--text-muted` (uppercase optional). Value Poppins 600 28/36 tabular. Detail 12px muted at bottom.
- Stat tile (compact): bg `#E8F6EE`, radius 12, padding 12, min-height 72, label 12px/600 uppercase 0.04em `#1A5E2F`, value Poppins 600 24/32.

### 5.6 Data table

| Part | Spec |
|---|---|
| Wrapper | Card, no padding; table fills width; horizontal scroll only inside wrapper |
| Header row | height 40, sticky `top: 64px` (under topbar), bg `#FBFCFB`, border-bottom 1px `--border`, `th` text 12px/600 uppercase 0.04em `--text-muted`, padding `0 16px` |
| Body row | height 52 (compact 44), padding `0 16px`, text 14px, border-bottom 1px `#EDF1EE`, last row none |
| Hover | bg `rgba(232,246,238,.6)` |
| Selected | bg `#E8F6EE` + 3px left bar `#118E45` |
| Alignment | text left; money, counts right with tabular-nums; actions right |
| Primary cell | name 14px/600 over 12px muted sub-line; avatar 36 left, gap 12 |
| Row actions | Icon buttons 32px, appear at 100% opacity (not hover-only) |
| Footer | 56px, pager right, "Showing x–y of z" 12px muted left |
| Bulk bar | Appears above the header when rows are checked: height 48, bg `#1C411E`, white text, radius 14 |
| States | Skeleton rows (8) while loading; EmptyState and ErrorState inside the card |

Remove `min-width: 690px` and the `-18px` margin hack.

### 5.7 Toolbar (above tables)

Height 48, row: tabs left, search (width 280, height 40) + filter chips + export button right, gap 12.
- Tab: height 40, padding `0 16px`, radius 12, Inter 600 14px; inactive `--text-muted`; active bg `#E8F6EE` text `#1A5E2F` with count pill (20px, radius pill, 12px/700).
- Filter chip: height 32, padding `0 12px`, radius pill, border 1.5px `--border`, 12px/600; selected bg `#118E45` text white.

### 5.8 Drawer (replaces most modals)

| Property | Value |
|---|---|
| Position | `position: fixed; top: 0; right: 0; bottom: 0` |
| Width | 480 default, 640 wide, `max-width: calc(100vw - 72px)` |
| Radius | `28px 0 0 28px` |
| bg / shadow | white / `--shadow-drawer` |
| Backdrop | `--scrim`, no blur |
| Header | height 72, padding `0 24px`, h2 20/28, subtitle 12px muted, 40px close button right, border-bottom 1px |
| Body | padding 24, scroll, sections gap 24 |
| Footer | sticky bottom, height 72, padding `0 24px`, bg white, border-top 1px, actions right-aligned (primary right-most) |
| Motion | slide from right 250ms ease-out; focus trapped; Esc closes; focus returns to opening row |
| Z | 30 |

Convert first: `BookingDetailsDialog`, `BookingPaymentsDialog`, `AssignCleanerDialog`.

### 5.9 Confirm dialog (only remaining modal)

Centred, width 440, radius 20, padding 24, `--shadow-modal`, scrim backdrop, z 50. Title h2, body 14px, actions right (secondary then primary or destructive).

### 5.10 State components

| Component | Spec |
|---|---|
| EmptyState | Centred, padding 48; 56px circle bg `#E8F6EE` with 24px green icon; h3 17/24; body 14px muted, max-width 360; optional primary button |
| ErrorState | Same layout, circle bg `#FDECEC`, icon `#D32F2F`, "Try again" secondary button |
| InlineBanner | Height auto, padding `12px 16px`, radius 14, 1px border, tone bg (success/warning/error/info), icon 20px left |
| Skeleton | bg `#E3E8E4`, radius 8, shimmer 1200ms, respects reduced motion |
| OfflineBanner | Full-width under topbar, 40px, bg `#FFF4D6`, text `#8A6D00` |
| Toast | Bottom-centre, offset 24, radius 14, padding `12px 16px`, bg `#1C411E`, white 14px, 4s, z 40 |

### 5.11 Avatars and icons

Avatar: circle, bg `#C5E8D3`, text `#1C411E` Inter 700 (sm 12, md 14, lg 16). Icons: stroke 2, 20px default. Recommended: switch to `lucide-react`, keeping the `IconName` API.

---

## 6. Page layouts

| Page | Header | Layout (12-col) | Notes |
|---|---|---|---|
| Overview | hero + 4 KPI cards overlapping | Main 9: chart card (revenue) over table card (today's bookings). Rail 3 (320px): action queue cards (unassigned, overdue balances, unconfirmed cash) | Rail sticky `top: 88px` |
| Bookings | hero + 3 KPI | Toolbar + DataTable full width; booking details in 640 drawer | Busiest page |
| Approvals | plain | Tabs (To confirm / Cancellations) + one DataTable | Replaces two stacked tables |
| Quotes | plain | Toolbar with pipeline tabs + DataTable; detail in 640 drawer | |
| Payments | hero + KPI | Two cards 8 + 4: payments table, reconciliation summary | Money right-aligned tabular |
| Cash | plain | KPI row (3 x 4) + DataTable; confirm handover = confirm dialog | Real badge count |
| Customers | plain | List 5 + profile panel 7 | Master-detail |
| Cleaners | plain | Card grid 3 columns (avatar 48, rating, status chip) + drawer profile | |
| Catalogue / Services | plain | Left category list 3 + editor 9; selectable cards for choosers | Split large files |
| Forms | plain | Field list 4 + preview 8; field cards radius 16 on tokens | |
| Promos | plain | DataTable + 480 drawer for create/edit | |
| Costs | hero + KPI | Three tables share one DataTable via tabs | |
| Support | plain | Two-pane inbox: thread list 4 (min 340px) + conversation 8 | Matches client messages/chat |
| Reports | hero | Chart cards 6 + 6, charts use green500/green300/yellow500, axis labels 12px | |
| Settings | plain | Left sub-nav 3 (selected = green50 fill) + grouped cards 9 | Matches client settings list |
| Login | none | Split screen 50/50. Left panel: gradient `#118E45`→`#1A5E2F`, radius `0 40px 40px 0`, brand mark and tagline white, `display` 32/40. Right: white, form card width 400 centred, inputs and green primary button (full width, height 48) | Remove demo-account shortcuts in production |

---

## 7. Deliberate deviations from the client

| Area | Client | Admin | Why |
|---|---|---|---|
| Control height | 52px | 40px (32 small) | Mouse input, density |
| Page gutters | 16px | 32px | Wider canvas |
| Warning text | `#E7A500` on `#FFF4D6` | `#8A6D00` on `#FFFCE0` | Client pair is likely under 4.5:1 for small text; verify, then keep the darker pair |
| Navigation | Bottom tab bar | Left sidebar | Same yellow pill |
| Details | Bottom sheets | Right drawers | Desktop form of the same pattern |
| Yellow | Fills only | Fills only | Never yellow text on white |
| Native-only | Haptics, safe areas, keyboard avoidance | Omitted | Not applicable |

---

## 8. Phased plan

Estimates are rough, one developer.

### Phase 0 — Baseline and guardrails (~0.5 day)
- Screenshots of all 16 pages, Login and every dialog at 1280, 1440, 1920px into `admin-web/docs/ui-baseline/`.
- Port `client-app/scripts/check-style.mjs` as `npm run check:style`. Fail on raw hex outside `tokens.css`, font-size < 12px, off-scale radius, colour/size inline styles.
- Record starting counts (150 / 19 / ~40).

### Phase 1 — Token layer (~1 day)
- Add `tokens.css` (section 2); import first in `main.tsx`.
- Alias the old `:root` vars to new tokens so nothing breaks.
- Mechanical pass on `styles.css`: map hex, collapse radii, lift sizes. Fix layouts that overflow at 12px (nav badges, trend pills, table headers) instead of shrinking type.
- Split into `base`, `layout`, `components`, `pages/*.css` as a pure move first.
- Exit: `check:style` clean; screenshot diff shows only intended text growth.

### Phase 2 — Shell and layout (~1–2 days)
- Sections 4.1–4.5: sidebar, topbar, page frame, hero variants, remove mobile code, rail collapse at 1024–1279px.
- Real Cash badge and live status in the footer.

### Phase 3 — Components (~2–3 days)
- Build section 5 components in `components/ui/`; add a dev-only `/#styleguide` page.
- Order: Button, Input, StatusChip, Card, DataTable, Tabs/Chips, Drawer, State components, KPI, Toast, Icons.

### Phase 4 — Page rollout (~4–6 days)
- Order: Overview, Bookings, Approvals + Quotes, Payments + Cash, Customers + Cleaners, Catalogue/Services/Forms/Promos, Costs/Support/Reports, Settings, Login.
- Split `Catalogue.tsx` (42 KB), `FormBuilder.tsx` (35 KB), `Quotes.tsx` (29 KB) while migrating.

### Phase 5 — Polish and QA (~1–2 days)
- WCAG AA contrast on every chip and muted text pair.
- Keyboard: tab order, Esc closes drawers, focus returns, `⌘/Ctrl+K` opens search.
- Re-capture screenshots; delete dead CSS; remove `tsconfig.tsbuildinfo` from version control; clean `build` and `typecheck`.

---

## 9. Per-page definition of done

- Uses `PageHeader`, `DataTable`, drawer and state components; no local copies.
- No font size under 12px, no raw hex, no off-scale radius, no inline colour/size styles.
- Correct at 1024, 1280, 1440, 1920px with no horizontal page scroll.
- Loading, empty and error states present.
- Every number shown is real data.
- Keyboard and focus verified.

## 10. Success measures

| Measure | Today | Target |
|---|---|---|
| Declarations under 12px | ~150 | 0 |
| Distinct radii | 19 | 7 |
| Raw hex outside tokens | ~40 | 0 |
| Media queries | 11 | ≤ 3 |
| `styles.css` | 1 file, 4,711 lines | Split, none over ~600 lines |
| Pages on shared `DataTable` | 0 | All list pages |
| Pages using `PageHeader` | 1 hero | All 16 |

## 11. Risks and open questions

**Risks**
- 12px minimum will cause wrapping/overflow in dense spots; budget layout fixes in Phase 1.
- Large files are risky to restyle before splitting.
- Splitting CSS can change cascade order; move first, compare screenshots, then change values.

**Confirm**
1. Minimum supported width (plan assumes 1024px).
2. Switch to Lucide icons, or keep the custom set?
3. Hero on five dashboard pages only, or every page?
4. Dark mode (client has none; plan includes none).

## 12. Suggested first sprint

Phase 0, Phase 1, the Phase 2 shell, and the Phase 3 `Button`, `StatusChip`, `DataTable` and `Drawer`; then migrate Overview and Bookings as proof of the approach.
