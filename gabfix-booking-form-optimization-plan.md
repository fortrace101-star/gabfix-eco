# Gabfix Booking Form Builder — Optimization Plan

Rebuild the admin **Booking forms** page around a centred phone preview and a step-by-step editing flow.

Target files: `admin-web/src/pages/Forms.tsx` (347 lines), `admin-web/src/components/FormBuilder.tsx` (831 lines, includes `FormPreview`), `admin-web/src/lib/forms.ts`, `admin-web/src/components/Topbar.tsx`, `admin-web/src/App.tsx`, `admin-web/src/styles/theme.css` (forms block, ~L1836–2000), `admin-web/src/styles.css` (L3663–4000).
Shared contract: `client-app/src/lib/form-schema.ts`, imported by admin as `@mobile/lib/form-schema`.
Client consumers: `client-app/src/app/book/[slug]/scope.tsx`, `components/booking/dynamic-form.tsx`, `components/booking/stepper-header.tsx`.

> Scope note: written from reading the code, not from running the app. Phase 0 captures baseline screenshots to confirm each finding. Theme values come from `gabfix-admin-ui-optimization-plan.md` (tokens already shipped in `src/styles/tokens.css`).

---

## 1. What the goal means

| You asked for | Becomes |
|---|---|
| Preview in the centre | Three-pane workspace: **Steps rail (left) · Phone preview (centre) · Inspector (right)**. The phone is the main thing on screen. |
| Laid out as for a phone | A 390 × 844 device frame with the real client chrome: top bar, 6-stage stepper, sticky bottom action bar, bottom-sheet radius, client fonts and tokens. |
| Creating steps | A **step** is one form section. Add, rename, reorder, duplicate and delete steps from the rail. |
| Moving back and forth for edits | Back / Next inside the phone, plus click-to-jump in the rail and the phone's stepper. The draft survives every move; nothing is saved until Publish. |

---

## 2. Current state (findings)

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| 1 | **The preview ignores unsaved edits.** `Forms.tsx` renders `<FormPreview schema={schema} />` where `schema` is the *published* definition. The working copy (`draft`) lives inside `FormBuilder` and is never passed up. | `Forms.tsx` L272 vs `FormBuilder.tsx` L103 | The preview only changes after Publish. Centring it is pointless until draft state is lifted. **Root fix, Phase 1.** |
| 2 | Preview is a 300px sticky card on the **right**, below the builder column, with a plain rounded box (`.preview-phone`, `max-height: 640`, radius 16). | `styles.css` L3684–3695, L3933 | Reads as a thumbnail, not a phone. |
| 3 | Preview label is hard-coded **"Step 2 of 4 · Job details"**. | `FormPreview` | Wrong: the client stepper has 6 stages (Details, Job scope, Schedule, Address, Summary, Payment) and Job scope is stage 2 of 6. |
| 4 | Preview shows **every section stacked in one scroll**, with no Back/Next. | `FormPreview` maps `schema.sections` | No way to walk the form the way a customer does. |
| 5 | Preview is **static**: skeleton boxes only. No required errors, no conditional fields appearing, no duration or quote result. Builder notes ("Shown when x is y") are printed inside the customer view. | `PreviewControl` | Rules cannot be tested without publishing. |
| 6 | Editor is one **long column**: Form basics → every section card → every field accordion. Only one field open at a time (`openField`). Five sections × twelve fields is a very long page. | `FormBuilder` | Moving between parts of the form means scrolling, and the editor and preview are never in view together. |
| 7 | Sections cannot be duplicated or moved between steps; fields can only be reordered inside their section. | `moveSection`, per-field arrows | Restructuring means delete and recreate. |
| 8 | **Real customers see all sections on one screen.** `dynamic-form.tsx` maps `schema.sections` inside a single Job scope screen. | `dynamic-form.tsx` L46–52, `scope.tsx` | "Steps" is not a client concept yet. The preview must not claim paging the app does not do. See section 4. |
| 9 | `validateSchema` requires 1–12 fields per section, max 5 sections, max 40 fields, and every `showIf` must point at an **earlier** field. | `form-schema.ts` L159–222 | Adding an empty step or moving a step can make the draft invalid. The UI must show *which step* is broken, not just `errors[0]`. |
| 10 | Page chrome above the editor (4 KPI cards, hero-sized header) pushes the workspace down. | `Forms.tsx` L113–178 | At 1440×900 the phone would start below the fold. |
| 11 | Leaving the page, switching category/service, or navigating away with edits loses the draft silently. | no dirty guard in `Forms.tsx` | Fatal for a step-by-step flow where people jump around. |
| 12 | Version history sits below the fold and restore is the only action. | `Forms.tsx` L228–271 | Fine to keep, but should move into a drawer. |

### Reusable as-is
- `visibleFields`, `validateAnswers`, `suggestedMinutes`, `requiresQuote`, `defaultSchema` are pure and already importable, so the preview can run the **real** client logic with no copy.
- `publishForm` (retire-then-insert, `version + 1`) and version history stay unchanged.
- The `schema` column is `jsonb`, so adding an optional key needs no migration.

---

## 3. Target layout (viewport ≥ 1280px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR 64px  Operations › Catalogue › Booking forms › Home cleaning       │
│   [🔍]  ● Live   ● Unsaved · 3 changes   [Discard] [Publish new version]  👤│
│ TOOLBAR 48px  [Home cleaning ▾]  v3 live  ·  [History]                    │
├───────────────┬───────────────────────────────────────┬──────────────────────┤
│ STEPS RAIL    │            PHONE PREVIEW              │ INSPECTOR            │
│ 280px         │            390 × 844 frame            │ 360px                │
│               │  ┌─────────────────────────────┐      │                      │
│ ◉ 1 Job size  │  │ ‹  Job scope           ✕    │      │ Step: Job size       │
│ ○ 2 Condition │  │ ①──②──③──④──⑤──⑥  stepper  │      │  Title  [         ]  │
│ ○ 3 Focus     │  │ ─────────────────────────   │      │  Duplicate · Delete  │
│ ○ 4 Photos    │  │ Step 1 of 3 · Job size      │      │ ───────────────────  │
│               │  │ Tell us about the job       │      │ Field: Bedrooms      │
│ + Add step    │  │ Bedrooms        [–] 2 [+]   │      │  Question  [      ]  │
│               │  │ Home type  (•)Flat ( )House │      │  Type  [Counter ▾]   │
│ FORM SETTINGS │  │ ...                         │      │  Required  ▣         │
│  Heading      │  │                             │      │  Show only when …    │
│  Layout       │  ├─────────────────────────────┤      │                      │
│  Photos       │  │ [ Back ]        [ Next › ]  │      │ ✓ Valid · 7 fields   │
│               │  └─────────────────────────────┘      │                      │
│ Owner list ⌄  │   ◂ Step 1 / 3 ▸   [Reset answers]    │                      │
└───────────────┴───────────────────────────────────────┴──────────────────────┘
```

### 3.1 Panes

| Pane | Width | Position | Content |
|---|---|---|---|
| Workspace toolbar | full | sticky `top: var(--topbar)`, height 48, z 10 | Owner picker (category/service combo), version chip, History. Replaces the page header and the 4 KPI cards (move the counts into the owner picker menu). **Draft status, Discard and Publish live in the top bar** (section 3.4). |
| Steps rail | 280px | `position: sticky; top: calc(var(--topbar) + 72px)`, height `calc(100vh − topbar − 72px)`, own scroll | Step list, Add step, Form settings group, collapsible owner list. |
| Phone preview | `minmax(420px, 1fr)`, content centred | centre column; `justify-self: center` | Device frame, 390 × 844 at 100%; scales with CSS `zoom`/`transform: scale()` to fit the column height (min 70%). Sits on a `--bg` stage with a subtle dot grid. |
| Inspector | 360px | sticky like the rail, own scroll | Contextual editor for the selected step or field. Replaces the inline accordion. |

Responsive: 1280–1439 shrink rail to 240 and inspector to 320. 1024–1279: inspector becomes a right **drawer** that opens on selection (the app already has `Drawer`). Below 1024 the existing "use a larger screen" notice applies.

### 3.2 Phone frame spec

| Part | Spec |
|---|---|
| Device | 390 × 844, radius 44, 10px bezel `--green-900`, `--shadow-popover`, 28px status-bar strip (time, signal; static) |
| Screen | bg `--bg` (`#F6F8F6`), radius 34, overflow hidden, client tokens (Poppins/Inter, radius 12/16/20) |
| Top bar | 56px: back chevron, title "Job scope", close icon, mirrors `TopBar` |
| Stepper | The client's 6 stages, height 64: Details · **Job scope** · Schedule · Address · Summary · Payment. Job scope active, others dimmed and non-interactive ("Not editable here" tooltip). Mirrors `stepper-header.tsx` (28px circles, green connector). |
| Sub-step line | Under the stepper in Steps layout only: "Step 2 of 3 · Condition" + 3 dots |
| Body | Scrolls inside the screen; padding 16, section gap 16; real field controls (see 3.3) |
| Bottom bar | Sticky, 72px, white, top border: **Back** (secondary) + **Next** / **Continue to schedule** (primary). Mirrors `SummaryBar`. |
| Selection | Hover outlines a field (2px `--green-300`); click selects it (2px `--green-500`, `--green-50` fill) and opens it in the Inspector. Preview-only affordance; absent in "Customer mode". |
| Mode switch | Above the phone: **Edit** (selection outlines, drag handles) / **Customer** (clean, fully interactive, no builder chrome). |

### 3.3 Live, interactive preview

The preview renders from the **draft** and runs the real shared logic.

| Behaviour | Source |
|---|---|
| Fields appear/disappear as the tester answers | `visibleFields(draft, answers)` |
| Inline required / min / max errors after pressing Next | `validateAnswers(draft, answers, mediaCount)` |
| Duration chip ("About 2 h 30 min") | `suggestedMinutes` |
| "We will confirm the price" banner when a flagged option is chosen | `requiresQuote` |
| Photo block honours `mediaRequired`, `mediaHint`, `maxMedia` | schema |
| Sample answers persist while moving between steps; **Reset answers** clears them | local preview state |
| Controls | real-looking radio cards (≤ 6 options), chips (> 6, per client rule), counter (– n +), measurement (value + m²/m/ft), toggle, textarea |

Builder-only notes ("Shown when…", field ids, quote tags) render only in Edit mode and only as small removable badges, never as customer text.

### 3.4 Top bar optimizations

Scope: the admin console top bar (`components/Topbar.tsx`, `.topbar` in `styles/theme.css`, 64px, sticky, z 20). The phone's own top bar is specified in 3.2.

**Findings**

| # | Finding | Evidence | Consequence on this page |
|---|---|---|---|
| T1 | Breadcrumb is two static levels, "Operations › Booking forms". It carries no owner, step or draft context. | `Topbar.tsx` `pageLabel` map, `.crumb` | Nothing in the chrome says *which* form or step is being edited. |
| T2 | The **Date range** select (Today / 7 / 30 days) is always rendered and is meaningless on Booking forms (and on other non-report pages). | `Topbar.tsx` `date-range` | Dead control next to the actions that matter; wastes about 140px. |
| T3 | The top bar has no slot for page actions. Publish / Discard live in the page header 64px below it. | page header in `Forms.tsx` | Two stacked bars (64 + about 72) eat 136px of a workspace that needs the full height for an 844px phone. |
| T4 | Global search only matches bookings, customers and cleaners from in-memory arrays, and **Enter navigates to the page, not the record**. | `results`, `onNavigate(results[0].page)` | Cannot jump to a booking form or service. Search for "Home cleaning" finds nothing. |
| T5 | Search is a fixed `min(420px, 34vw)` field, so at 1280px it squeezes the breadcrumb and the right cluster. | `.global-search` | Collides with the action cluster once Draft + Publish are added. |
| T6 | Search popover uses `role="listbox"` but arrow keys do nothing; only the first result is ever selected, and `⌘K` is the only shortcut. | `aria-selected={index === 0}` | Keyboard users cannot reach results 2–7. |
| T7 | Notifications popover lists every item with no cap, and unread dot has no 99+ cap. | `notifications.map` | Long list can run past the viewport. |
| T8 | The live pill says "Live / Connecting / Manual refresh" but not whether the *form draft* is safe, and "Manual refresh" gives no button. | `live-pill` | Authors cannot tell if realtime or their draft is the issue. |

**Target**

```
Default pages:
│ Operations › Bookings        [🔍 Search… ⌘K]       ● Live  [Today ▾]  🔔  👤 │

Booking forms (workspace page):
│ Operations › Catalogue › Booking forms › Home cleaning › Step 2   [🔍] ● Live  ● Unsaved · 3   [Discard] [Publish v4]  🔔 👤 │
```

| Change | Spec |
|---|---|
| **Top bar slot** | New `TopbarSlot` context. A page registers `{ crumbs, status, actions }` through `useTopbar({...})`; `Topbar` renders it and clears it on unmount. App-level default stays as today. Replaces the per-page header for workspace pages, so Forms drops about 72px. |
| **Deep breadcrumb** | Replace the static `pageLabel` crumb with an array of `{ label, onClick? }`. Forms: Operations › Catalogue › Booking forms › *owner* › *step title*. Each crumb clickable (owner crumb opens the owner picker, step crumb jumps). Truncate middle crumbs with an ellipsis menu below 1440px; current crumb 14px/600, others 14px muted. |
| **Draft status chip** | Next to the live pill: "Saved" (neutral), "Unsaved · n changes" (warning dot), "n errors" (danger, click jumps to the first broken step), "Publishing…" (spinner). Updates from `useFormDraft`. Has `aria-live="polite"`. |
| **Actions** | Secondary **Discard** and primary **Publish new version** (40px, existing Button specs). Publish disabled with the first error as tooltip. Mirrors the actions in the workspace; no duplicate buttons elsewhere. |
| **Hide irrelevant controls** | Date range renders only on pages that read it: Overview, Bookings, Payments, Costs, Reports. A `pagesWithDateRange` set replaces the always-on select. |
| **Search collapses** | At ≤1279px, and on slot pages with actions, search collapses to a 40px icon button that expands to a 420px overlay field on click or `⌘K`. Default pages keep the inline field. |
| **Search coverage** | Add results for **Booking forms** (categories and services, with version chip) and Catalogue items. Result click navigates to the page **and selects the record** (`onNavigate(page, { id })`), so Enter on "Home cleaning" opens that form in the workspace. |
| **Search keyboard** | Arrow Up/Down move `aria-selected` and scroll into view; Enter opens the active result; Esc closes; group headings per type. |
| **Notifications** | Cap list at 8 with "View all" to Settings; unread badge caps at `9+`; popover `max-height: calc(100vh - 96px)` with inner scroll. |
| **Live pill** | When `offline`, make it a button that runs the page reload; tooltip text unchanged. On the Forms page it never claims the draft is saved (that is the draft chip's job). |
| **Layout rules** | Left: crumbs (flex 1, min-width 0). Right cluster: gap 12, never wraps. Order: search, live pill, draft chip, actions, notifications, identity. Identity collapses to avatar only below 1440px (already hides `.identity-copy` at the existing breakpoint; keep). |
| **Z and height** | Stays 64px / z 20. Workspace toolbar (48px) sits at `top: var(--topbar)` z 10, so the rail and inspector offsets become `calc(var(--topbar) + 48px)`. |

Files: `Topbar.tsx` (crumb array, slot render, search upgrades, caps), new `src/lib/topbar-slot.tsx` (context + `useTopbar`), `App.tsx` (provider, `onNavigate(page, params)`, `pagesWithDateRange`), `Forms.tsx` (registers slot), `theme.css` (`.topbar` layout, `.draft-chip`, `.search-collapsed`), `types.ts` (navigation params).

---

## 4. Decision: what is a "step"?

The client currently shows **all** sections on one Job scope screen. Three options:

| Option | What changes | Pros | Cons |
|---|---|---|---|
| A. Builder-only steps | Preview pages through sections, app unchanged | No client work | Preview would mislead: customers still see one long screen |
| **B. Steps as a real, opt-in layout (recommended)** | New optional schema key `layout: 'single' \| 'steps'`. Builder preview honours it. Client pages sections only when `'steps'` | Preview is truthful; existing forms and shipped builds unchanged | Needs a small client change (Phase 4) |
| C. Always paged | Client always pages sections | Simplest rule | Changes every existing form |

**Plan uses B.** Details:

- `FormSchema` gains `layout?: 'single' | 'steps'` (absent = `'single'`). It is stored in the existing `schema jsonb`, so **no migration**. `validateSchema` accepts it. Older app builds ignore the unknown key and render all sections stacked, which is exactly today's behaviour.
- Form settings in the rail get a **Layout** control: *One screen* / *Step by step*. In One screen the phone scrolls through all sections with no Back/Next; in Step by step it pages. The rail still lists sections either way.
- Because the builder can publish a form that old builds show stacked, the Layout control shows a one-line note: "App versions before X show this as one screen." (fill X when Phase 4 ships).
- Step progress is local to the Job scope stage. It never changes the 6-stage client stepper or the booking draft contract.

> **Open question for you:** is B right, or do you want A (builder-only, quickest) or C? Phases 1–3 are identical for all three; only Phase 4 differs.

---

## 5. Step creation and navigation

### 5.1 Steps rail

| Element | Spec |
|---|---|
| Step row | 56px: drag handle, number badge, title, "n fields" caption, status icon (✓ valid, ⚠ error, • edited since publish) |
| Select | Click: preview jumps to that step; Inspector shows the step |
| Reorder | Drag handle, plus keyboard `Alt+↑/↓` and the existing arrow buttons (kept for accessibility) |
| Add step | Button under the list, disabled at 5 steps ("Max 5 steps"). New step starts with **one starter field** (short text, label "New question") so it is valid immediately |
| Step templates | Add-step menu: *Blank*, *Size & rooms*, *Condition*, *Access & notes*, *Photos*. Each inserts a ready section from a small `STEP_TEMPLATES` constant in `forms.ts` |
| Duplicate | Copies fields with fresh ids (`newId`) and remaps any `showIf` that pointed inside the copied step |
| Delete | Confirm dialog showing how many fields and how many `showIf` rules elsewhere depend on this step; offers "Delete and remove dependent rules" |
| Rename | Inline in the rail on double-click, or in the Inspector |

### 5.2 Moving back and forth

| Control | Behaviour |
|---|---|
| Phone **Back / Next** | Moves one step. Next validates the current step's visible fields in **Customer mode** only; in **Edit mode** it never blocks, so authors can move freely |
| Phone sub-step dots | Click to jump |
| Steps rail | Click to jump |
| Keyboard | `[` / `]` previous/next step, `Esc` clears selection (shown in a `?` shortcut popover) |
| Selection follows | Selecting a field in the phone selects its step in the rail; selecting a step scrolls the phone to the top of that step |
| Draft persistence | One `draft` object owned by the page (see 6.1). Moving steps, switching selection or opening History never resets it |
| Last step | Primary button reads "Continue to schedule" and does nothing (shows a toast "Next stage is not part of this form") |

### 5.3 Moving fields between steps

- Inspector, field view: **Move to step** select (lists all steps).
- Phone, Edit mode: drag a field handle onto another step in the rail.
- Guard: after the move, run `validateSchema`. If a `showIf` now points at a later field, show the affected field with a ⚠ badge and the message from the validator, and keep Publish disabled. Offer **Fix: move dependency up** when it can be done automatically.

---

## 6. Component plan

### 6.1 State (fixes finding 1)

Lift the draft out of `FormBuilder`:

```
FormsPage (owner, catalogue, saving)
 └─ FormWorkspace  ← new, keyed by owner + base definition id
      state: draft, selection {stepId, fieldId|null}, stepIndex, mode, answers
      derived: errors, dirty, errorsByStep
      ├─ StepsRail
      ├─ PhonePreview
      └─ Inspector
```

- `useFormDraft(schema)` hook (new, `src/lib/use-form-draft.ts`): holds `draft`, `dirty`, `errors`, `errorsByStep`, and typed mutators (`addStep`, `moveStep`, `duplicateStep`, `deleteStep`, `addField`, `moveField`, `moveFieldToStep`, `patchField`, `patchStep`, `patchSettings`). All the logic now inline in `FormBuilder` (`mapFields`, `moveSection`, id rewrite in `showIf`) moves here, unit-tested.
- `FormPage` passes `draft` to `PhonePreview`. `FormPreview` as it exists is deleted.
- `errorsByStep`: run `validateSchema` and map each message back to a section by field/section id so the rail can mark the right step.

### 6.2 New and changed files

| File | Change |
|---|---|
| `src/pages/Forms.tsx` | Slim to data loading, owner picker, publish/restore, history drawer. Renders `FormWorkspace`. Drops the four KPI cards and the stacked rail cards |
| `src/components/forms/FormWorkspace.tsx` | New. Grid of the three panes, keyboard shortcuts, dirty guard |
| `src/components/forms/StepsRail.tsx` | New. Step list, add/duplicate/delete, form settings, owner list |
| `src/components/forms/PhonePreview.tsx` | New. Device frame, mode switch, stepper, body, bottom bar. Replaces `FormPreview` |
| `src/components/forms/PreviewFields.tsx` | New. Interactive controls per field type (`PreviewControl` replacement) |
| `src/components/forms/Inspector.tsx` | New. Step view and field view. Field editing code moves here from `FormBuilder` (unchanged inputs, option editor, `showIf` editor) |
| `src/components/FormBuilder.tsx` | Removed after migration (its field editors become `Inspector` sections) |
| `src/lib/use-form-draft.ts` | New hook described above |
| `src/lib/topbar-slot.tsx`, `src/components/Topbar.tsx`, `src/App.tsx` | Top bar slot, deep breadcrumb, draft chip, search upgrades (section 3.4) |
| `src/lib/forms.ts` | Add `STEP_TEMPLATES`, `cloneSection`, `dependentsOf(schema, fieldId)` helpers |
| `src/styles/forms.css` | New, imported after `theme.css`. Moves the forms rules out of `styles.css` L3663–4000 and `theme.css` L1836–2000 and uses tokens only |
| `client-app/src/lib/form-schema.ts` | Phase 4: add `layout?` to `FormSchema`, accept it in `validateSchema` |
| `client-app/src/components/booking/dynamic-form.tsx`, `app/book/[slug]/scope.tsx` | Phase 4: render one section per step when `layout === 'steps'` |

### 6.3 Inspector contents

| Selection | Shows |
|---|---|
| Nothing / form settings | Heading (80 chars), media hint (140), photo requirement toggle, layout control, schema id (read-only), version info |
| Step | Title (60), step id (read-only after publish, since "never reused"), field count, Duplicate, Delete, Move up/down |
| Field | Tabs: **Question** (label, type, helper, placeholder, required) · **Options / Limits** (option editor with minutes and quote flag; min/max/unit/minutes-per-unit; max files) · **Logic** (show only when, with a value picker populated from the dependency's options instead of free text) · **Advanced** (field id, move to step, duplicate, delete) |

Improvements while moving the code:
- `showIf` value: when the dependency is a `select`/`multiselect`, show a dropdown of its option labels (stores the option id) instead of the current comma-separated id text box.
- Field id and section id edits warn when the form is already published ("Saved bookings keep the old id").
- Disable the type switch warning gap: changing a field to a type that drops `options` asks first.

---

## 7. Dirty state and safety

| Case | Behaviour |
|---|---|
| Unsaved edits, switch owner | Confirm dialog: Keep editing / Discard / Publish first |
| Unsaved edits, leave page or close tab | `beforeunload` plus the same dialog for in-app navigation |
| Publish | Confirm dialog summarising the diff: steps added/removed/renamed, fields added/removed/changed, with the "new bookings only; saved bookings keep their snapshot" line |
| Publish while errors exist | Button disabled; tooltip lists the first error and a "Show" link that jumps to the offending step |
| Autosave | Draft persisted to `sessionStorage` per owner (`gabfix.formDraft.<kind>:<id>`), restored with a banner "Restored unsaved changes". Cleared on publish/discard. Wrap in try/catch |
| Concurrent edit | Publish already re-reads the current row; if its version differs from the draft's base, block with "Someone published v4 while you were editing. Reload or publish on top of v4." |

---

## 8. Accessibility and quality

- Steps rail is a `role="tablist"` (vertical); the phone body is the `tabpanel`. Arrow keys move between steps.
- Phone preview region gets `aria-label="Customer preview, step 2 of 3"` and a live region announcing step changes.
- Selection outlines meet 3:1 contrast on `--bg`; focus rings use the existing `--focus-ring`.
- Respect `prefers-reduced-motion` for the step slide (180ms, `--motion-fast`).
- Minimum font size 12px everywhere except inside the phone, where the client's own sizes apply (caption 12, body 14+).
- Drag and drop always has a keyboard equivalent (arrow buttons or `Alt+↑/↓`).

---

## 9. Phases

| Phase | Deliverable | Files | Done when |
|---|---|---|---|
| **0. Baseline** | Screenshots of Forms at 1440 and 1280 for a category with 3 sections; list of current form versions in the dev DB | none | Findings table confirmed or corrected |
| **1. Lift draft + live preview** | `useFormDraft`; preview renders the draft; swap the old preview for the phone frame in place (still right-hand) | `use-form-draft.ts`, `PhonePreview.tsx`, `Forms.tsx` | Editing a label updates the phone immediately; typecheck + tests pass |
| **2. Three-pane layout** | `FormWorkspace`, `StepsRail`, `Inspector`; preview centred; header slimmed; inline accordion removed; **top bar slot with deep breadcrumb, draft chip, Discard/Publish, date range hidden** | `components/forms/*`, `forms.css`, `Topbar.tsx`, `topbar-slot.tsx`, `App.tsx` | Phone centred at 1440×900 with no vertical page scroll; all existing field editors reachable |
| **3. Steps** | Add/duplicate/delete/reorder/move-field; Back/Next; jump from rail, dots, keyboard; `errorsByStep`; templates | rail, hook, `forms.ts` | Build a 3-step form from blank, walk it forwards and backwards, change a field on step 1 while viewing step 3 |
| **4. Real step layout (option B)** | `layout` key, Layout control, client paging, version note | `form-schema.ts`, `dynamic-form.tsx`, `scope.tsx` | Same form shown identically in preview and in the app for both layouts |
| **5. Safety + polish** | Dirty guard, session draft, publish diff, stale-version guard, history drawer, **search coverage and keyboard navigation, notification caps, live-pill reload**, a11y pass | `Forms.tsx`, workspace | Section 7 and 8 checklists pass |

Phases 1 and 2 can ship alone and already deliver the centred phone preview.

---

## 10. Testing

| Layer | Tests |
|---|---|
| Unit (`use-form-draft`) | add/move/duplicate/delete step; move field across steps; id rename rewrites `showIf`; duplicate remaps internal `showIf`; deleting a dependency reports dependents; `errorsByStep` maps messages to the right step |
| Unit (`form-schema`) | `layout` accepted/absent; unchanged behaviour for existing schemas |
| Component | `PhonePreview` hides/shows a conditional field after an answer; Next in Customer mode blocks on a required field; in Edit mode it does not |
| Playwright (`tests/admin-smoke.spec.ts`) | open Booking forms → add step → add field → jump back to step 1 → rename a label → phone shows the new label without publishing → publish → `GET /services/:slug/form` returns v+1 |
| Top bar | Component: slot registers and clears on unmount; date range absent on Forms, present on Overview; draft chip shows "Unsaved · n" after an edit and "n errors" for an invalid step; search for a category name returns a form result and Enter selects it; Arrow keys move the active result. Playwright: edit a label → top bar chip flips to Unsaved → Publish from the top bar |
| Manual | Phase 0 screenshot set repeated per phase; 1280 and 1440 widths; keyboard-only run through all steps |

Repo checks per phase: `cd admin-web && npm run typecheck && npm run build`; client checks (`tsc --noEmit`, `expo lint`, store/form-schema tests) when Phase 4 touches `client-app`.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Preview drifts from the app | Preview calls the shared `form-schema.ts` logic; control styling mirrors `dynamic-form.tsx` tokens. Add a visual comparison task in Phase 4 |
| Published `layout: 'steps'` shown stacked in old app builds | Optional key, safe fallback, note in the Layout control |
| Moving steps breaks `showIf` ordering | Validate on every mutation, per-step error badges, auto-fix offer |
| Large forms (40 fields) make the phone slow | Preview memoises per step; only the current step's controls render |
| Page grows 3 panes on laptop widths | 1024–1279 uses Inspector-as-drawer; below that the existing notice |
| Slot context leaves stale actions after navigation | `useTopbar` cleans up in an effect; default slot restored on unmount; test covers page switch |
| Section ids are "never reused" but editable | Lock the id after the first publish; offer rename of the *title* instead |

---

## 12. Checklist

- [ ] P0 Baseline screenshots and DB form inventory
- [ ] P1 Lift `draft` into `useFormDraft`; preview reads the draft
- [ ] P1 `PhonePreview` frame with client top bar, 6-stage stepper and bottom action bar
- [ ] P1 Interactive controls using `visibleFields`, `validateAnswers`, `suggestedMinutes`, `requiresQuote`
- [ ] P2 `FormWorkspace` three-pane layout, preview centred
- [ ] P2 `Inspector` (step and field views) replaces accordion
- [ ] P2 Slim header; owner picker replaces rail cards and KPI row
- [ ] P2 Top bar slot: deep breadcrumb, draft chip, Discard / Publish in the bar, date range hidden off report pages
- [ ] P3 Add / duplicate / delete / reorder steps, templates
- [ ] P3 Back / Next, rail jump, dots, keyboard shortcuts
- [ ] P3 Move field between steps with dependency guard
- [ ] P3 `errorsByStep` badges
- [ ] P4 Decide A / B / C (section 4)
- [ ] P4 `layout` key in `form-schema.ts` and client paging
- [ ] P5 Dirty guard, session draft, publish diff, stale-version guard
- [ ] P5 Top bar search: form/catalogue results, select-record navigation, arrow-key navigation, search collapse at ≤1279px
- [ ] P5 Top bar notifications cap and live-pill reload
- [ ] P5 History moved to a drawer
- [ ] P5 A11y pass and Playwright flow
