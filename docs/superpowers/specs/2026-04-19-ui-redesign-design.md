# Rules Manager — UI Redesign Design Spec

**Date:** 2026-04-19
**Branch:** `ui-redesign-2026-04`
**Source design:**
- Reference design (HTML/JSX prototype): Anthropic Design handoff bundle (Rules Manager, April 2026)
- Improvement report: `UI Improvement Report.html` from the same bundle

## Goal

Transform the Rules Manager frontend into a professional, Linear/Vercel-style SaaS app by adopting the reference design system end-to-end. The current UI is basic; the user wants it to look complete and production-quality.

This is a **frontend-only** effort. No backend changes, no schema changes, no new endpoints.

## Scope

### In scope (15 of the 18 items from the UI Improvement Report, plus `ClientContext` broken out as a separate row)

| # | Item | Primary files |
|---|---|---|
| 1 | Left sidebar layout replacing top-nav | `Layout.tsx`, new `Sidebar.tsx` |
| 2 | Full-page Rule Editor (replaces modal) | `App.tsx`, new `RuleEditorPage.tsx` |
| 3 | Rule Library table redesign (inline toggle, condition snippet, bulk bar, pagination) | `RuleLibrary.tsx`, `client.ts` |
| 4 | DRL syntax highlighter | `DrlPreview.tsx` |
| 5 | Condition builder UI (KV rows + datalist) in editor | `RuleEditorPage.tsx` |
| 6 | Unsaved-changes guard | `RuleEditorPage.tsx` |
| 7 | Skeleton loading rows | new `Skeleton.tsx` |
| 8 | Actionable empty states | new `EmptyState.tsx` |
| 9 | Bulk action bar on multi-select | `RuleLibrary.tsx` |
| 10 | Persistent `ClientContext` with switcher in sidebar footer | new `ClientContext.tsx` |
| 11 | Global `/deployments` route (client-side fan-out) | `Deployments.tsx` |
| 12 | Import DRL: per-rule checkbox + duplicate warning | `ImportDrl.tsx` |
| 13 | Admin: split into Users card + Access Matrix card | `AdminPage.tsx` |
| 14 | Overview / dashboard page at `/` | new `Overview.tsx` |
| 15 | Dark mode toggle (sun/moon in topbar) | `theme.css`, `Topbar.tsx` |
| 16 | ⌘K command palette via `cmdk` | new `CommandPalette.tsx` |

### Explicitly out of scope

- **Priority chips (P1–P4).** Commit `1bb4012` removed the `priority` field from the Rule model, schemas, API, and UI. Reintroducing it would reverse a deliberate product decision.
- **Drag-to-reorder salience.** Requires new `sequence` column on `rules` table + `PATCH /api/rules/reorder` endpoint. Backend work not in scope.
- **Deployment diff column (added / removed / modified counts).** Requires backend computed column or new endpoint.
- **Dedicated `/api/rules/preview-drl` endpoint.** Not building a new backend endpoint; per-rule DRL preview (already available) is sufficient.
- **Tweaks panel customizations.** No accent color picker, no font family picker, no density picker. Theme toggle is light/dark only.

## Decisions

- **Branch:** `ui-redesign-2026-04` (branched from `drl-function-import-tracking`)
- **CSS migration strategy (A2):** `theme.css` co-exists with `index.css` only during the transition. Each step migrates one page fully to the new theme. The final step deletes `index.css` entirely. End state is one clean design system with no legacy CSS.
- **Tests (C):** Delete current `.test.tsx` files and rewrite against the new DOM. Existing tests assert on old structure (class names, nav labels) — patching them would be more work than rewriting.
- **New dependency:** `cmdk` for the ⌘K command palette. ~5KB gzipped; industry-standard (Linear, Vercel).
- **No push to remote, no PR** until explicitly requested.
- **Review cadence:** user confirms after each numbered step in the implementation plan before the next begins.

## Design system

### Tokens (CSS custom properties at `:root`)

- **Surfaces:** `--bg`, `--bg-elev`, `--bg-sunken`, `--bg-hover`, `--panel`
- **Borders:** `--border`, `--border-strong`
- **Text:** `--ink`, `--ink-2`, `--muted`, `--muted-2`
- **Accent:** `--accent` (`#5b6cff`), `--accent-soft`, `--accent-strong`, `--accent-ink`
- **Semantic:** `--ok`, `--warn`, `--danger`, `--info` (each with a `-soft` variant)
- **Shadows:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Radii:** `--radius-sm` (6px), `--radius` (8px), `--radius-lg` (12px), `--radius-xl` (16px)
- **Density (fixed at "cozy"):** `--row-py: 10px`, `--row-px: 14px`, `--cell-fs: 13px`
- **Fonts:** `--font-sans` (Inter), `--font-mono` (JetBrains Mono)

### Dark mode

Single `[data-theme="dark"]` block overrides all surface / border / text / semantic tokens. Theme attribute on `<html>`. Toggle in topbar. Persisted via `localStorage.theme`; restored before React mounts to avoid FOUC.

### Shipped component classes (in `theme.css`)

- Layout: `.app`, `.sidebar`, `.topbar`, `.page`, `.page-head`
- Nav: `.nav-item`, `.nav-sub`, `.sidebar-section`, `.sidebar-footer`
- Buttons: `.btn` with modifiers `.primary`, `.accent`, `.ghost`, `.danger-ghost`, `.sm`, `.icon`
- Forms: `.field`, `.select`, `.tb-input`, `.kv-row`, `.builder`, `.cbx`, `.switch`
- Tables: `.table-wrap`, `table.rules`, `.col-*`, `.cell-*`, `.pager`
- Badges: `.badge`, `.tool-badge`, `.prio` (retained for future; inexpensive)
- Cards: `.card`, `.divider`, `.kbd`, `.stat`
- Code: `.code-head`, `.code-tabs`, `.code-body`, `.code-pre`, `.code-ln`, `.code-src`, `.tok-*`
- State: `.empty`, `.empty-title`, `.skeleton` (with `@keyframes shimmer`)
- Utilities: `.hstack`, `.vstack`, `.grow`, `.truncate`, `.muted`, `.small`, `.mono`

### Fonts

Inter (400/500/600/700) and JetBrains Mono (400/500) loaded via Google Fonts `<link>` in `frontend/index.html`. System fallback fonts configured in CSS variables.

### Icons

Custom inline-SVG `Icon` component with ~40 glyphs (home, rules, clients, deploy, import, settings, search, plus, download, upload, save, play, more, edit, trash, copy, check, x, chevR, chevD, filter, sun, moon, sparkles, folder, bell, alertTri, branch, clock, shield, history, code, link, tag, layers, sliders, eye, arrowUp, arrowDown, logo). No icon library dependency.

## Application shell

### `ClientContext`

```ts
type ClientContextValue = {
  selectedClientId: number | null;
  setSelectedClientId: (id: number | null) => void;
  clients: Client[];
  loading: boolean;
};
```

Fetches `GET /api/clients` once; persists `selectedClientId` to `localStorage.polycloud.selectedClientId`. `RuleLibrary`, `Deployments`, `ImportDrl` all consume this context instead of keeping local state.

### `Sidebar`

Two-level navigation:

- **Workspace section:** Overview, Rules (expands to rule-types sub-nav when active), Deployments, Clients, Import DRL
- **Settings section (admin only):** Admin, Account
- **Footer:** user avatar + name + role + client switcher popover

Rule-types sub-nav loads `GET /api/rule-types` once; counts computed client-side from a single `getRules({ client_id })` call (no new backend needed).

### `Topbar`

56px sticky top bar:

- Breadcrumb (derived from route)
- Search input (trigger for ⌘K palette — no inline search behavior)
- Theme toggle (sun/moon)
- Logout button

### Routing

```
/                              → Overview
/rules                         → redirect to /rules/<first-type>
/rules/:slug                   → RuleLibrary
/rules/:slug/new               → RuleEditorPage
/rules/:slug/edit/:id          → RuleEditorPage
/deployments                   → Deployments (global; client-side fan-out)
/clients                       → Clients
/clients/:id/deployments       → Deployments (scoped; existing deep link preserved)
/import                        → ImportDrl
/admin                         → AdminPage (admin only)
/account                       → AccountPage
/login, /register              → existing (retemed only)
```

## Pages

### Rule Library (`/rules/:slug`)

Columns: checkbox | ID | toggle | Name+desc | Condition snippet | Tool | Updated | actions (⋮).

- Inline `Switch` calls `PATCH /api/rules/:id` optimistically
- Row click → `/rules/:slug/edit/:id` (full-page editor; no more modal)
- Bulk action bar appears when `selectedIds.size > 0` (Duplicate, Export, Delete)
- Skeleton rows while loading
- Empty state when 0 rules: "No rules for this client — Create first rule | Import DRL"
- Pagination: `getRules({ client_id, rule_type_id, limit, offset, q })` with prev/next. Backend params already supported; client-side fallback if not.

### Rule Editor (`/rules/:slug/new`, `/rules/:slug/edit/:id`)

Full-page, 2-column grid (1fr | 42%):

- **Left:** 4 numbered sections
  1. Identification (rule type, client, tool, window, name [readonly], desc, enabled toggle)
  2. Conditions (KV-row builder with `<datalist>` field suggestions per rule type; "manual override" toggle for raw textarea)
  3. Actions (preset dropdown per rule type + custom rows)
  4. Metadata (author, created, last edited, version — all readonly)
- **Right:** live-updating DRL preview panel
  - Mac-style header with filename
  - Tabs: `rule.drl`, `rule.json`, `diff` (diff is a placeholder — no backend diff support)
  - Syntax-highlighted code with line numbers

Unsaved-changes guard via react-router v7 `useBlocker` + `beforeunload` listener. Builder ↔ raw-DRL sync via `parseCondition()` (ported from reference `editor_view.jsx`).

### DRL Preview component

Ports `highlightDRL()` regex tokenizer from reference `common.jsx`. Token classes: `tok-kw`, `tok-str`, `tok-num`, `tok-cmt`, `tok-fn`, `tok-var`, `tok-op`. Line numbers column via CSS Grid. Copy button with toast.

### Overview (`/`)

- 4 stat cards with mini sparklines (inline SVG): Total rules, Active clients, Deployments (30d), Last deploy
- Rules-by-type horizontal bar chart (pure CSS, derived from `getRules()`)
- Recent activity feed (last 10 events from `updated_at` on rules + deployments)
- Top clients strip

No new backend endpoints. Recent-activity feed is best-effort; noted as a future backend item if it reads thin.

### Deployments

Accepts optional `clientId` URL param. When null, fans out `getDeployments(clientId)` across all clients client-side, merges and sorts by `created_at desc`. Columns: ID, Client (global mode only), Environment badge, Rules count from snapshot, Status, When, By. Filters: client (global only), environment, status, search.

### Import DRL

Two-column card grid:

- Upload card: drag-drop + file picker + recent-imports list
- Paste card: textarea with "Parse & import"

Preview table gets a checkbox column per rule. After parse, cross-reference `preview.rules[].name` against existing rules (single `getRules({ client_id, rule_type_id })` call); mark duplicates with `⚠ already exists` badge.

### Admin

Split into two cards:

- **Users:** username, role, last login, reset password action (opens confirmation dialog with strength indicator — min 8 chars, has digit, has special char)
- **Access Control:** matrix (rows = contributors, columns = clients, cells = checkbox). Changing a checkbox calls existing `POST`/`DELETE /api/admin/user-client-access/...`. Admins shown with all cells checked + disabled.

### Minor page retheme

`Clients.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `AccountPage.tsx`, `FunctionsPanel.tsx` — ported to new tokens/classes. No functional changes.

### Command Palette

`cmdk` mounted globally inside `Layout`. Opens via `⌘K` / `Ctrl+K` or clicking topbar search input. Commands:

- Jump to rule (search by name / id across all rules)
- Jump to client
- Jump to page
- Toggle theme
- New rule (per rule type)

Keyboard shortcuts:

| Shortcut | Action | Context |
|----------|--------|---------|
| `⌘K` / `Ctrl+K` | Open palette | Global |
| `N` | New rule | Rule Library (not when input focused) |
| `E` | Edit selected | Rule Library |
| `/` | Focus search | Rule Library |
| `⌘S` | Save form | Rule Editor |
| `Escape` | Cancel / close | Rule Editor, palette |

## Implementation steps

14 numbered steps. Each leaves the app in a working state. User confirms after each.

### Step 0 — Branch setup (prep)

- This spec is committed on `drl-function-import-tracking` before the new branch is cut; cutting from `drl-function-import-tracking` inherits the spec commit
- Create branch `ui-redesign-2026-04` from `drl-function-import-tracking`
- `npm install cmdk` in `frontend/`
- Add Google Fonts `<link>` to `frontend/index.html`

**Verify:** branch exists; spec file is present on the new branch; `npm run build` passes; `npm test` still passes.

### Step 1 — Ship design system

- New `frontend/src/theme.css` (~970 lines, ported from reference)
- New `frontend/src/components/Icon.tsx`
- `main.tsx`: import `theme.css` after `index.css`; boot theme from `localStorage` before React mounts

**Verify:** app still renders with old layout; theme tokens visible in DevTools.

### Step 2 — New app shell (Sidebar + Topbar + Layout)

- New `components/layout/Sidebar.tsx`, `Topbar.tsx`
- Rewrite `components/layout/Layout.tsx` using `.app` grid
- Dark/light toggle wired into topbar (no ⌘K behavior yet)

**Verify:** all existing routes still navigate; sidebar links work; dark mode flips & persists. Pages inside look visually mismatched — expected until each gets ported.

### Step 3 — ClientContext + persistent selector

- New `context/ClientContext.tsx`
- Client switcher popover in sidebar footer
- `RuleLibrary`, `Deployments`, `ImportDrl` consume context instead of local state
- Persist to `localStorage.polycloud.selectedClientId`

**Verify:** select client in one page, navigate, client persists across reloads.

### Step 4 — Shared UI primitives

- New `components/Skeleton.tsx`
- New `components/EmptyState.tsx`
- New `components/Toast.tsx` + `useToast()` hook
- New `components/Switch.tsx`

**Verify:** each renders correctly in both themes.

### Step 5 — DRL syntax highlighter

- Rewrite `components/DrlPreview.tsx`: port `highlightDRL()` tokenizer, add line numbers and Copy button with toast

**Verify:** DRL preview now has syntax colors; copy works.

### Step 6 — RuleLibrary redesign

- Rewrite `pages/RuleLibrary.tsx` against new classes
- Read rule type from URL `/rules/:slug`
- Inline `Switch` with optimistic `updateRule()`
- Remove expand-row logic
- Bulk action bar when `selectedIds.size > 0`
- Skeleton rows on load; empty state when 0 rules
- Pagination in `client.ts` + `Pager` component
- `App.tsx`: `/` redirect to `/rules/<first-type>`; add `/rules/:slug`

**Verify:** table matches reference; inline toggle works without opening editor; bulk bar appears on selection; pagination works.

### Step 7 — Full-page Rule Editor

- New `pages/RuleEditorPage.tsx`
- Port condition builder (`FIELD_SUGGESTIONS`) and action presets (`ACTION_PRESETS`)
- `useBlocker` for unsaved-changes guard + `beforeunload`
- Manual-override toggle for raw DRL
- Delete `components/RuleEditor/RuleEditor.tsx` and its `createPortal` wrapper
- Add routes `/rules/:slug/new` and `/rules/:slug/edit/:id`
- `RuleLibrary` row click + edit button → navigate to full-page editor

**Verify:** edit + create work; unsaved-changes prompt fires on navigate; builder ↔ raw DRL stays in sync.

**Risk:** if step 7 sprawls, split into 7a (page shell + form) and 7b (condition builder + unsaved guard).

### Step 8 — Deployments (global + per-client)

- Rewrite `pages/Deployments.tsx` against new classes
- Accept optional `clientId` URL param; when null, fan-out across all clients via `Promise.all`
- Add `/deployments` route; keep `/clients/:id/deployments` as deep link

**Verify:** `/deployments` shows all; `/clients/1/deployments` shows one; filters work.

### Step 9 — ImportDrl redesign

- Rewrite `pages/ImportDrl.tsx`: two-column card layout
- Per-rule checkbox column in preview table
- Duplicate-name detection via cross-reference with `getRules()`

**Verify:** drag-drop + paste still work; deselecting excludes from import; duplicate warnings render.

### Step 10 — Admin split

- Rewrite `pages/AdminPage.tsx` into Users card + Access Matrix card
- Password reset: confirmation dialog + strength indicator

**Verify:** access matrix persists; strength meter updates on typing; confirm dialog blocks accidental resets.

### Step 11 — Overview dashboard

- New `pages/Overview.tsx`
- 4 stat cards with mini sparklines
- Rules-by-type bar chart
- Recent-activity feed
- Top-clients strip
- `/` route → `<Overview />`

**Verify:** dashboard loads; numbers match DB; each card links correctly.

### Step 12 — Smaller page retheme

- Port `Clients.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `AccountPage.tsx`, `FunctionsPanel.tsx` to new tokens/classes
- No functional changes

**Verify:** all pages consistent; login still logs in; register still works.

### Step 13 — ⌘K command palette

- New `components/CommandPalette.tsx` using `cmdk`
- Mounted globally in `Layout`; opens on `⌘K` / `Ctrl+K` / topbar search click
- Commands and shortcuts as listed above

**Verify:** palette opens/closes; filters across rules + pages; shortcuts work per context; doesn't fire when inputs are focused.

### Step 14 — Cleanup + new test suite

- Delete `frontend/src/index.css`
- Delete all current `.test.tsx` files
- Write new tests (Vitest + Testing Library) against new DOM:
  - `Sidebar.test.tsx`
  - `RuleLibrary.test.tsx`
  - `RuleEditorPage.test.tsx`
  - `CommandPalette.test.tsx`
  - `ClientContext.test.tsx`
  - Target: same test count as before
- Run `npm run build`, `npm run lint`, `npm test`

**Verify:** full test suite green; production build succeeds; manual smoke test of every route in both themes.

## Risks and caveats

1. **Step 7 is the biggest.** If it sprawls beyond one sitting, split into 7a (page shell + form fields) and 7b (condition builder + unsaved-changes guard).
2. **Step 14 may surface regressions.** If rewritten tests catch bugs from earlier steps, patch before merging.
3. **`cmdk` ships its own styles.** Override to match design tokens. Straightforward but adds CSS bulk.
4. **Recent-activity feed** is derived client-side from `updated_at`; it is not a true audit log. If it looks thin in practice, note as a future backend task.
5. **Pagination:** if the backend's `getRules` doesn't accept `limit`/`offset`, fall back to client-side pagination for step 6 and note as a future backend task.

## Working agreement

- User confirms after each numbered step before the next begins
- Each step is a separate commit on `ui-redesign-2026-04`
- No push to remote, no PR until explicitly asked
- If a step goes longer than expected, checkpoint with the user rather than barrel through
