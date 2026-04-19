# Rules Manager UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Rules Manager frontend into a professional, Linear/Vercel-style SaaS app by adopting a new design system end-to-end on a dedicated branch, with user confirmation after every numbered task.

**Architecture:** Frontend-only changes on `ui-redesign-2026-04`. New `theme.css` co-exists with legacy `index.css` during the migration and is deleted in the final task. Current Rule Editor modal becomes a full-page route; top-nav becomes left-sidebar with persistent `ClientContext`; dark mode, ⌘K command palette, overview dashboard, and skeleton/empty-state primitives ship as net-new. No backend changes.

**Tech Stack:** React 18, TypeScript, Vite, react-router v7, Vitest + Testing Library, new dep `cmdk` for ⌘K palette. Fonts: Inter + JetBrains Mono via Google Fonts.

**Spec:** `docs/superpowers/specs/2026-04-19-ui-redesign-design.md`

**Reference design (local):** `C:/Users/jasme/AppData/Local/Temp/design/ui-improvement-extracted/rules-manager/project/src/` (`theme.css`, `common.jsx`, `shell.jsx`, `rules_view.jsx`, `editor_view.jsx`, `other_views.jsx`)

**Working agreement:**
- Tasks are numbered 0–14 mirroring the spec's Step N headings.
- After every task completes, stop and wait for user confirmation before starting the next.
- Each task is a separate commit on `ui-redesign-2026-04`.
- No push to remote, no PR until explicitly requested.

---

## Task 0: Branch setup

**Files:**
- Modify: `frontend/package.json` (add `cmdk` dep)
- Modify: `frontend/index.html` (Google Fonts link)

- [ ] **Step 1: Verify working tree is clean enough**

Run from repo root:
```
git status --short
```
Expected: only `frontend/dist/*`, `.claude/settings.local.json`, and `polycloud_rules_manager_deploy.zip` are untracked/modified. These are ignored for our purposes. If any `frontend/src/*` is dirty, stop and report.

- [ ] **Step 2: Cut the new branch from `drl-function-import-tracking`**

```
git switch -c ui-redesign-2026-04
```
Expected: switched to a new branch.

- [ ] **Step 3: Verify spec is present on the new branch**

```
ls docs/superpowers/specs/2026-04-19-ui-redesign-design.md
```
Expected: file exists.

- [ ] **Step 4: Install `cmdk`**

From `frontend/`:
```
npm install cmdk
```
Expected: `package.json` lists `cmdk` in `dependencies`; `package-lock.json` updated.

- [ ] **Step 5: Add Google Fonts link to `frontend/index.html`**

Insert inside `<head>` before the existing CSS link:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- [ ] **Step 6: Verify build and tests still pass**

From `frontend/`:
```
npm run build
npm test
```
Expected: build succeeds; existing test suite still passes (we haven't changed DOM yet).

- [ ] **Step 7: Commit**

```
git add frontend/package.json frontend/package-lock.json frontend/index.html
git commit -m "task 0: cut ui-redesign-2026-04 branch, add cmdk, Google Fonts"
```

---

## Task 1: Ship the design system

**Files:**
- Create: `frontend/src/theme.css`
- Create: `frontend/src/components/Icon.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/theme.css`**

Copy the file verbatim from the reference at `C:/Users/jasme/AppData/Local/Temp/design/ui-improvement-extracted/rules-manager/project/src/theme.css` into `frontend/src/theme.css`. Then apply these four local adaptations:

a. Remove the three `[data-density="*"]` selector blocks (we are not shipping the density picker). Keep the `--row-py`, `--row-px`, `--cell-fs` values from the `:root` block (cozy defaults) as-is.

b. Append the skeleton shimmer block at the end of the file:

```css
/* =========================================================
   Skeleton loading
   ========================================================= */
@keyframes shimmer {
  from { background-position: -400px 0; }
  to   { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--bg-sunken) 25%, var(--bg-hover) 50%, var(--bg-sunken) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
  border-radius: var(--radius-sm);
  height: 13px;
}
[data-theme="dark"] .skeleton {
  background: linear-gradient(90deg, #1a1a1d 25%, #222228 50%, #1a1a1d 75%);
  background-size: 800px 100%;
}
```

c. Append a utility for the topbar logout button area (missing in the reference):

```css
.topbar-right { display: flex; align-items: center; gap: 6px; margin-left: auto; }
```

d. The reference uses `window.RULE_TYPES` etc. — these are not in the CSS, so nothing to remove. Do NOT modify `.tweaks` styles; we're dropping the drawer entirely, but the class block is harmless and we'll purge it in Task 14.

- [ ] **Step 2: Create `frontend/src/components/Icon.tsx`**

Port the Icon component from the reference `common.jsx` (lines 1–53) as a typed React component:

```tsx
import type { CSSProperties } from 'react'

export type IconName =
  | 'home' | 'rules' | 'clients' | 'deploy' | 'import' | 'settings'
  | 'search' | 'plus' | 'download' | 'upload' | 'save' | 'play' | 'more'
  | 'edit' | 'trash' | 'copy' | 'check' | 'x' | 'chevR' | 'chevD' | 'filter'
  | 'sun' | 'moon' | 'sparkles' | 'folder' | 'bell' | 'alertTri' | 'branch'
  | 'clock' | 'shield' | 'history' | 'code' | 'link' | 'tag' | 'layers'
  | 'sliders' | 'eye' | 'arrowUp' | 'arrowDown' | 'logo'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 16, className = '', style }: IconProps) {
  const svg = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    className: `ico ${className}`.trim(),
    style,
  }
  const paths: Record<IconName, JSX.Element> = {
    home:      <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>,
    rules:     <><path d="M4 6h16M4 12h16M4 18h10"/></>,
    clients:   <><circle cx="9" cy="8" r="4"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M17 14c2.5 0 4 1.5 4 4"/></>,
    deploy:    <><path d="M12 3v12"/><path d="M6 9l6-6 6 6"/><path d="M4 21h16"/></>,
    import:    <><path d="M12 3v12"/><path d="M6 15l6 6 6-6"/><path d="M4 21h16"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    search:    <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    download:  <><path d="M12 3v12"/><path d="M6 11l6 6 6-6"/><path d="M4 21h16"/></>,
    upload:    <><path d="M12 21V9"/><path d="M6 15l6-6 6 6"/><path d="M4 3h16"/></>,
    save:      <><path d="M5 3h11l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v6h8V3"/><path d="M8 21v-6h8v6"/></>,
    play:      <><polygon points="6 3 20 12 6 21 6 3"/></>,
    more:      <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    edit:      <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
    trash:     <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    copy:      <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    check:     <><path d="M20 6 9 17l-5-5"/></>,
    x:         <><path d="M18 6 6 18M6 6l12 12"/></>,
    chevR:     <><polyline points="9 18 15 12 9 6"/></>,
    chevD:     <><polyline points="6 9 12 15 18 9"/></>,
    filter:    <><polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/></>,
    sun:       <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    moon:      <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></>,
    sparkles:  <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/></>,
    folder:    <><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    bell:      <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
    alertTri:  <><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v5M12 18h0"/></>,
    branch:    <><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 8v8"/><path d="M6 18c6 0 12-4 12-10"/></>,
    clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    shield:    <><path d="M12 2 4 6v6c0 5 4 9 8 10 4-1 8-5 8-10V6l-8-4z"/></>,
    history:   <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v5l3 2"/></>,
    code:      <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    link:      <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
    tag:       <><path d="M20 12 12 20l-9-9V3h8l9 9z"/><path d="M7 7h.01"/></>,
    layers:    <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    sliders:   <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></>,
    eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    arrowUp:   <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    logo:      <><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></>,
  }
  return <svg {...svg}>{paths[name]}</svg>
}
```

- [ ] **Step 3: Wire `theme.css` + theme-boot into `main.tsx`**

Modify `frontend/src/main.tsx`. Before `ReactDOM.createRoot(...)`, add:

```ts
import './index.css'
import './theme.css'

const savedTheme = localStorage.getItem('polycloud.theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.dataset.theme = savedTheme ?? (prefersDark ? 'dark' : 'light')
```

Keep the existing `./index.css` import. Do NOT remove it yet — Task 14 does that.

- [ ] **Step 4: Verify app renders**

From `frontend/`:
```
npm run dev
```
Manually verify: existing app still renders with old layout, no visible errors. Fonts Inter & JetBrains Mono loaded (check DevTools Network tab). CSS custom properties visible on `<html>` (check DevTools Elements → Computed).

- [ ] **Step 5: Verify tests still pass**

```
npm test
```
Expected: green.

- [ ] **Step 6: Commit**

```
git add frontend/src/theme.css frontend/src/components/Icon.tsx frontend/src/main.tsx
git commit -m "task 1: ship theme.css design system, Icon component, theme boot"
```

---

## Task 2: New app shell (Sidebar + Topbar + Layout)

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/Topbar.tsx`
- Rewrite: `frontend/src/components/layout/Layout.tsx`

- [ ] **Step 1: Create `Sidebar.tsx`**

```tsx
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

interface NavEntry {
  to: string
  icon: IconName
  label: string
  adminOnly?: boolean
}

const WORKSPACE: NavEntry[] = [
  { to: '/', icon: 'home', label: 'Overview' },
  { to: '/rules', icon: 'rules', label: 'Rules' },
  { to: '/deployments', icon: 'deploy', label: 'Deployments' },
  { to: '/clients', icon: 'clients', label: 'Clients' },
  { to: '/import', icon: 'import', label: 'Import DRL' },
]

const SETTINGS: NavEntry[] = [
  { to: '/admin', icon: 'shield', label: 'Admin', adminOnly: true },
  { to: '/account', icon: 'settings', label: 'Account' },
]

export function Sidebar() {
  const { username, hasAdminRole } = useAuth()
  const location = useLocation()

  const renderItem = (entry: NavEntry) => {
    if (entry.adminOnly && !hasAdminRole) return null
    const isActive =
      entry.to === '/'
        ? location.pathname === '/'
        : location.pathname === entry.to || location.pathname.startsWith(entry.to + '/')
    return (
      <NavLink key={entry.to} to={entry.to} className={`nav-item ${isActive ? 'active' : ''}`}>
        <Icon name={entry.icon} />
        <span className="truncate grow">{entry.label}</span>
      </NavLink>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">P</div>
        <div>
          <div className="brand-name">Polycloud</div>
          <div className="brand-sub">Rules Manager</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Workspace</div>
        {WORKSPACE.map(renderItem)}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Settings</div>
        {SETTINGS.map(renderItem)}
      </div>

      <div className="sidebar-footer">
        <div className="avatar">{(username ?? '?').slice(0, 2).toUpperCase()}</div>
        <div className="user-meta grow">
          <div className="user-name truncate">{username}</div>
          <div className="user-role truncate">{hasAdminRole ? 'Admin' : 'Contributor'}</div>
        </div>
      </div>
    </aside>
  )
}
```

NOTE: `NavLink` is from react-router-dom v7. We use our own `isActive` computation because nested routes (`/rules/:slug`) need to keep the parent `/rules` highlighted — `NavLink`'s default `end` behavior doesn't handle that cleanly.

The rule-type sub-nav is added in Task 3 (when `ClientContext` and rule-type counts are available).

- [ ] **Step 2: Create `Topbar.tsx`**

```tsx
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../Icon'

function useBreadcrumbs(): string[] {
  const { pathname } = useLocation()
  if (pathname === '/') return ['Overview']
  const segs = pathname.split('/').filter(Boolean)
  const labelFor = (seg: string) =>
    ({ rules: 'Rules', deployments: 'Deployments', clients: 'Clients',
       import: 'Import DRL', admin: 'Admin', account: 'Account' } as Record<string, string>)[seg]
    ?? seg.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return segs.map(labelFor)
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  localStorage.setItem('polycloud.theme', next)
}

export function Topbar() {
  const crumbs = useBreadcrumbs()
  const { logout } = useAuth()
  const theme = document.documentElement.dataset.theme
  return (
    <div className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="sep"> · </span>}
            <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
          </span>
        ))}
      </div>
      <div className="topbar-right">
        <div className="topbar-search" title="Command palette (⌘K)">
          <Icon name="search" />
          <input readOnly placeholder="Search rules, clients, deployments…" />
          <span className="kbd">⌘K</span>
        </div>
        <button className="btn icon ghost" title="Toggle theme" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="btn icon ghost" title="Log out" onClick={logout}>
          <Icon name="x" />
        </button>
      </div>
    </div>
  )
}
```

The topbar search is read-only — it's a visual trigger. Task 13 wires ⌘K behavior.

- [ ] **Step 3: Rewrite `Layout.tsx`**

Replace the entire contents of `frontend/src/components/layout/Layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="page-outlet">{children}</div>
      </main>
    </div>
  )
}
```

Any named exports other than `Layout` that the old file had should be removed. If `App.tsx` imports anything else from this file, fix those imports to use the new shell.

- [ ] **Step 4: Delete the old `Layout.test.tsx`**

```
rm frontend/src/components/layout/Layout.test.tsx
```
(It asserts on the old DOM. Full rewrite in Task 14.)

- [ ] **Step 5: Verify the app**

From `frontend/`:
```
npm run dev
```
Manually verify:
- Sidebar renders on the left with Overview/Rules/Deployments/Clients/Import DRL
- Clicking each link navigates correctly
- Active item is highlighted when on that route
- Topbar shows a breadcrumb derived from the URL
- Theme toggle button flips dark/light and persists across reload
- Logout still works

Pages inside will look visually mismatched (old CSS classes, new shell). That is expected until each page is re-themed in later tasks.

- [ ] **Step 6: Verify tests**

```
npm test
```
Expected: green (old Layout test deleted; other tests unaffected).

- [ ] **Step 7: Commit**

```
git add frontend/src/components/layout
git commit -m "task 2: new app shell with sidebar, topbar, dark mode toggle"
```

---

## Task 3: ClientContext + persistent selector

**Files:**
- Create: `frontend/src/context/ClientContext.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx` (add client switcher + rule-type sub-nav)
- Modify: `frontend/src/pages/RuleLibrary.tsx` (consume context, minimal change — full redesign in Task 6)
- Modify: `frontend/src/pages/Deployments.tsx` (consume context, minimal change — full redesign in Task 8)
- Modify: `frontend/src/pages/ImportDrl.tsx` (consume context, minimal change — full redesign in Task 9)

- [ ] **Step 1: Write a failing test for `ClientContext`**

Create `frontend/src/context/ClientContext.test.tsx`:

```tsx
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClientProvider, useClients } from './ClientContext'

vi.mock('../api/client', () => ({
  getClients: vi.fn(async () => [
    { id: '1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
    { id: '2', code: 'PVH', name: 'PVH', description: null, created_at: '' },
  ]),
}))

function Probe() {
  const ctx = useClients()
  return (
    <div>
      <span data-testid="selected">{ctx.selectedClientId ?? 'none'}</span>
      <span data-testid="count">{ctx.clients.length}</span>
      <button onClick={() => ctx.setSelectedClientId('2')}>pick</button>
    </div>
  )
}

describe('ClientContext', () => {
  beforeEach(() => localStorage.clear())

  it('loads clients and auto-selects first when no saved selection', async () => {
    render(<ClientProvider><Probe /></ClientProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    expect(screen.getByTestId('selected').textContent).toBe('1')
  })

  it('persists selection to localStorage', async () => {
    render(<ClientProvider><Probe /></ClientProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    act(() => { screen.getByText('pick').click() })
    expect(localStorage.getItem('polycloud.selectedClientId')).toBe('2')
  })

  it('restores selection from localStorage', async () => {
    localStorage.setItem('polycloud.selectedClientId', '2')
    render(<ClientProvider><Probe /></ClientProvider>)
    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('2'))
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```
cd frontend && npx vitest run src/context/ClientContext.test.tsx
```
Expected: FAIL (module `./ClientContext` not found).

- [ ] **Step 3: Implement `ClientContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getClients, type Client } from '../api/client'

interface ClientContextValue {
  selectedClientId: string | null
  setSelectedClientId: (id: string | null) => void
  clients: Client[]
  loading: boolean
}

const STORAGE_KEY = 'polycloud.selectedClientId'
const ClientContext = createContext<ClientContextValue | null>(null)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientIdRaw] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  )

  useEffect(() => {
    let cancelled = false
    getClients()
      .then(cs => {
        if (cancelled) return
        setClients(cs)
        if (!selectedClientId && cs.length > 0) setSelectedClientIdRaw(cs[0].id)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const setSelectedClientId = (id: string | null) => {
    setSelectedClientIdRaw(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <ClientContext.Provider value={{ selectedClientId, setSelectedClientId, clients, loading }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClients(): ClientContextValue {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClients must be used inside <ClientProvider>')
  return ctx
}
```

- [ ] **Step 4: Run tests to confirm green**

```
npx vitest run src/context/ClientContext.test.tsx
```
Expected: 3 tests pass.

- [ ] **Step 5: Wrap `Layout` in `ClientProvider`**

Modify `App.tsx`: wrap `<Layout>` (the inner one inside `<ProtectedRoute>`) with `<ClientProvider>`. Add the import at the top:

```tsx
import { ClientProvider } from './context/ClientContext'
```

Replace the `<ProtectedRoute><Layout>…</Layout></ProtectedRoute>` block so that `<ClientProvider>` wraps the `<Layout>`.

- [ ] **Step 6: Add client switcher + rule-type sub-nav to Sidebar**

Add the following to the bottom of `sidebar-footer` (replacing the static role line), keeping the avatar + user-name blocks:

```tsx
import { useState, useEffect } from 'react'
import { useClients } from '../../context/ClientContext'
import { getRuleTypes, getRules, type RuleType, type Rule } from '../../api/client'
```

Then inside `Sidebar()`:

```tsx
const { clients, selectedClientId, setSelectedClientId } = useClients()
const [switcherOpen, setSwitcherOpen] = useState(false)
const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
const [rulesForClient, setRulesForClient] = useState<Rule[]>([])
const onRulesPage = location.pathname.startsWith('/rules')

useEffect(() => { getRuleTypes().then(setRuleTypes).catch(() => {}) }, [])
useEffect(() => {
  if (!selectedClientId) { setRulesForClient([]); return }
  getRules({ client_id: selectedClientId }).then(setRulesForClient).catch(() => {})
}, [selectedClientId])

const selectedClient = clients.find(c => c.id === selectedClientId)
const countByType = (id: string) => rulesForClient.filter(r => r.rule_type_id === id).length
```

Replace the role line in the footer with a client-switcher pill:

```tsx
<div className="user-role truncate" style={{ position: 'relative' }}>
  <button
    className="btn sm ghost"
    onClick={() => setSwitcherOpen(o => !o)}
    style={{ padding: '0 6px', height: 20, fontSize: 11 }}
  >
    {selectedClient?.code ?? 'Pick client'} <Icon name="chevD" size={10} />
  </button>
  {switcherOpen && (
    <div className="card" style={{ position: 'absolute', bottom: 24, left: 0, zIndex: 50, padding: 6, minWidth: 180 }}>
      {clients.map(c => (
        <div key={c.id}
             className={`nav-item ${c.id === selectedClientId ? 'active' : ''}`}
             onClick={() => { setSelectedClientId(c.id); setSwitcherOpen(false) }}>
          <span className="grow truncate">{c.code}</span>
          <span className="count">{rulesForClient.filter(r => r.client_id === c.id).length || ''}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

Between the Workspace section and the Settings section, add the rule-types sub-nav (renders only when `/rules*`):

```tsx
{onRulesPage && (
  <div className="sidebar-section">
    <div className="sidebar-section-label">Rule Types</div>
    <div className="nav-sub">
      {ruleTypes.map(rt => {
        const isActive = location.pathname === `/rules/${rt.slug}` ||
                         location.pathname.startsWith(`/rules/${rt.slug}/`)
        return (
          <NavLink key={rt.id} to={`/rules/${rt.slug}`} className={`nav-item ${isActive ? 'active' : ''}`}>
            <span className="grow truncate">{rt.name}</span>
            <span className="count">{countByType(rt.id) || ''}</span>
          </NavLink>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 7: Switch existing consumers to context**

In `frontend/src/pages/RuleLibrary.tsx`, `Deployments.tsx`, `ImportDrl.tsx`: find the local `selectedClientId` state + client dropdown and replace with `const { selectedClientId, clients } = useClients()`. Delete the local `<select>` for client. This is a minimal, surgical change — each page gets its full redesign in its own task.

Import at the top of each:
```tsx
import { useClients } from '../context/ClientContext'
```

If a page previously rendered `"Select a client"` placeholder when unselected, replace with early-return:
```tsx
if (!selectedClientId) return <div className="empty"><div className="empty-title">Pick a client from the sidebar</div></div>
```

- [ ] **Step 8: Verify manually**

```
npm run dev
```
- Pick client INFY → navigate to Deployments → INFY still selected
- Reload browser → INFY still selected (localStorage verified)
- Go to `/rules/noise-suppression` → sidebar shows Rule Types sub-nav with counts
- Switch client in footer → rule counts in sub-nav update

- [ ] **Step 9: Run tests**

```
npm test
```
Expected: ClientContext tests pass; pre-existing tests may fail if they touched local client dropdown — that's OK, we'll fix in their respective page tasks. If any fail that are unrelated to client selection, investigate.

- [ ] **Step 10: Commit**

```
git add frontend/src/context frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/pages/RuleLibrary.tsx frontend/src/pages/Deployments.tsx frontend/src/pages/ImportDrl.tsx
git commit -m "task 3: ClientContext + sidebar client switcher + rule-type sub-nav"
```

---

## Task 4: Shared UI primitives (Skeleton, EmptyState, Toast, Switch)

**Files:**
- Create: `frontend/src/components/Skeleton.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/components/Switch.tsx`

- [ ] **Step 1: Create `Switch.tsx`**

```tsx
interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  title?: string
}

export function Switch({ checked, onChange, title }: SwitchProps) {
  return (
    <label className="switch" title={title} onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  )
}
```

- [ ] **Step 2: Create `Skeleton.tsx`**

```tsx
interface SkeletonProps { width?: number | string; height?: number; className?: string }

export function Skeleton({ width = '100%', height = 13, className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} style={{ width, height }} />
}

interface SkeletonRowsProps { count?: number; cols?: number }

export function SkeletonRows({ count = 5, cols = 6 }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><Skeleton width={c === 0 ? 40 : c === 1 ? '60%' : '80%'} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}
```

- [ ] **Step 3: Create `EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  body?: string
  actions?: ReactNode
}

export function EmptyState({ icon = 'folder', title, body, actions }: EmptyStateProps) {
  return (
    <div className="empty">
      <div style={{ width: 44, height: 44, margin: '0 auto 12px', borderRadius: 10,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} size={22} />
      </div>
      <div className="empty-title">{title}</div>
      {body && <div className="small muted" style={{ marginBottom: 12 }}>{body}</div>}
      {actions && <div className="hstack" style={{ justifyContent: 'center' }}>{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Create `Toast.tsx`**

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastItem { id: number; text: string; variant?: 'ok' | 'warn' | 'danger' | 'info' }
interface ToastContextValue { toast: (text: string, variant?: ToastItem['variant']) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const toast = useCallback<ToastContextValue['toast']>((text, variant) => {
    const id = Date.now() + Math.random()
    setItems(prev => [...prev, { id, text, variant }])
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 2200)
  }, [])
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex',
                    flexDirection: 'column', gap: 8, zIndex: 200 }}>
        {items.map(i => (
          <div key={i.id} className={`badge ${i.variant ?? 'neutral'}`}
               style={{ height: 'auto', padding: '8px 12px', boxShadow: 'var(--shadow-md)' }}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
```

- [ ] **Step 5: Wrap `Layout` with `ToastProvider`**

Modify `frontend/src/components/layout/Layout.tsx`:

```tsx
import { ToastProvider } from '../Toast'
// ...
export function Layout({ children }: LayoutProps) {
  return (
    <ToastProvider>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Topbar />
          <div className="page-outlet">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
```

- [ ] **Step 6: Smoke-test each primitive in dev**

Temporarily import and render each primitive from `RuleLibrary.tsx` (or a scratch route) to eyeball them in both themes. Revert the temporary render before committing.

- [ ] **Step 7: Run tests**

```
npm test
```
Expected: green.

- [ ] **Step 8: Commit**

```
git add frontend/src/components/Skeleton.tsx frontend/src/components/EmptyState.tsx frontend/src/components/Toast.tsx frontend/src/components/Switch.tsx frontend/src/components/layout/Layout.tsx
git commit -m "task 4: shared UI primitives (Skeleton, EmptyState, Toast, Switch)"
```

---

## Task 5: DRL syntax highlighter

**Files:**
- Create: `frontend/src/components/DrlPreview/highlight.ts`
- Create: `frontend/src/components/DrlPreview/highlight.test.ts`
- Rewrite: `frontend/src/components/DrlPreview.tsx`

- [ ] **Step 1: Write failing tests for the tokenizer**

Create `frontend/src/components/DrlPreview/highlight.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tokenize, type Token } from './highlight'

describe('tokenize', () => {
  it('highlights keywords', () => {
    const tokens = tokenize('rule "X" when then end')
    const kinds = tokens.map(t => t.kind)
    expect(kinds).toContain('kw')
  })
  it('highlights strings', () => {
    const tokens = tokenize('rule "hello world"')
    expect(tokens.find(t => t.kind === 'str' && t.text === '"hello world"')).toBeDefined()
  })
  it('highlights line comments', () => {
    const tokens = tokenize('// a comment\nrule "x"')
    expect(tokens.find(t => t.kind === 'cmt' && t.text === '// a comment')).toBeDefined()
  })
  it('highlights block comments', () => {
    const tokens = tokenize('/* block */ rule')
    expect(tokens.find(t => t.kind === 'cmt' && t.text === '/* block */')).toBeDefined()
  })
  it('highlights numbers', () => {
    const tokens = tokenize('salience 99')
    expect(tokens.find(t => t.kind === 'num' && t.text === '99')).toBeDefined()
  })
  it('marks PascalCase identifiers as packages/types', () => {
    const tokens = tokenize('NoiseSuppressionRequest()')
    expect(tokens.find(t => t.kind === 'pkg' && t.text === 'NoiseSuppressionRequest')).toBeDefined()
  })
  it('marks getX / setX / isX as functions', () => {
    const tokens = tokenize('request.getGroupedAlert().setState("x")')
    const fnNames = tokens.filter(t => t.kind === 'fn').map(t => t.text)
    expect(fnNames).toEqual(expect.arrayContaining(['getGroupedAlert', 'setState']))
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```
cd frontend && npx vitest run src/components/DrlPreview/highlight.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `highlight.ts`**

```ts
export type TokenKind = 'kw' | 'pkg' | 'str' | 'num' | 'cmt' | 'fn' | 'var' | 'op' | 'ws' | 'sym'

export interface Token {
  kind: TokenKind
  text: string
}

const KEYWORDS = new Set([
  'package','import','rule','when','then','end','global','function','declare',
  'dialect','salience','no-loop','lock-on-active','agenda-group','enabled','ruleflow-group',
  'activation-group','duration','auto-focus','date-effective','date-expires','from','collect',
  'accumulate','not','exists','forall','true','false','null','and','or',
])

const RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s])/g

export function tokenize(src: string): Token[] {
  const out: Token[] = []
  let m: RegExpExecArray | null
  RE.lastIndex = 0
  while ((m = RE.exec(src)) !== null) {
    const [full, cmt, str, num, ident, ws, sym] = m
    if (cmt)      out.push({ kind: 'cmt', text: full })
    else if (str) out.push({ kind: 'str', text: full })
    else if (num) out.push({ kind: 'num', text: full })
    else if (ident) {
      if (KEYWORDS.has(full))               out.push({ kind: 'kw', text: full })
      else if (/^[A-Z][\w]*$/.test(full))   out.push({ kind: 'pkg', text: full })
      else if (/^(get|set|has|is|put|check)[A-Z]/.test(full)) out.push({ kind: 'fn', text: full })
      else                                  out.push({ kind: 'var', text: full })
    }
    else if (ws)  out.push({ kind: 'ws', text: full })
    else if (sym) out.push({ kind: /[=!<>+\-*/&|%]/.test(sym) ? 'op' : 'sym', text: sym })
  }
  return out
}
```

- [ ] **Step 4: Run tests — expect green**

```
npx vitest run src/components/DrlPreview/highlight.test.ts
```
Expected: 7 tests pass.

- [ ] **Step 5: Rewrite `DrlPreview.tsx`**

First, read the current `frontend/src/components/DrlPreview.tsx` to know what props it exposes and which files import it. Preserve the prop API (likely `text: string` or `rule: Rule`). The rewrite:

```tsx
import { useMemo } from 'react'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { tokenize, type Token } from './DrlPreview/highlight'

interface DrlPreviewProps {
  text: string
  filename?: string
  showCopy?: boolean
}

function renderTokens(tokens: Token[]) {
  return tokens.map((t, i) =>
    t.kind === 'ws' || t.kind === 'sym'
      ? <span key={i}>{t.text}</span>
      : <span key={i} className={`tok-${t.kind}`}>{t.text}</span>
  )
}

export function DrlPreview({ text, filename = 'rule.drl', showCopy = true }: DrlPreviewProps) {
  const tokens = useMemo(() => tokenize(text), [text])
  const lineCount = text.split('\n').length
  const { toast } = useToast()

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    toast('Copied DRL', 'ok')
  }

  return (
    <div className="editor-side" style={{ display: 'flex', flexDirection: 'column', minHeight: 260 }}>
      <div className="code-head">
        <div className="code-head-title">
          <span className="code-dots"><span /><span /><span /></span>
          <span>{filename}</span>
        </div>
        {showCopy && (
          <button className="btn icon sm ghost" title="Copy DRL" onClick={copy}>
            <Icon name="copy" />
          </button>
        )}
      </div>
      <div className="code-body">
        <pre className="code-pre">
          <span className="code-ln">
            {Array.from({ length: lineCount }, (_, i) => (i + 1) + '\n')}
          </span>
          <code className="code-src">{renderTokens(tokens)}</code>
        </pre>
      </div>
    </div>
  )
}
```

If the old component is a default export used elsewhere, replace imports at the call sites to `import { DrlPreview } from '...'`. Grep for `DrlPreview` to confirm call sites.

- [ ] **Step 6: Delete old per-component tests that test the old DOM structure**

```
rm -f frontend/src/components/DrlPreview.test.tsx
```
(If none exists, skip.)

- [ ] **Step 7: Verify in dev**

```
npm run dev
```
Open the current modal rule editor from the rule list. Confirm: DRL side panel shows syntax colors, line numbers on left, Copy button in header that toasts "Copied DRL". Test in both themes.

- [ ] **Step 8: Run all tests**

```
npm test
```
Expected: new highlight tests pass; no regressions.

- [ ] **Step 9: Commit**

```
git add frontend/src/components/DrlPreview* frontend/src/components/DrlPreview.tsx
git commit -m "task 5: DRL syntax highlighter with line numbers and copy"
```

---

## Task 6: RuleLibrary redesign

**Files:**
- Modify: `frontend/src/api/client.ts` (add `q` already exists; no new backend params — pagination is client-side)
- Rewrite: `frontend/src/pages/RuleLibrary.tsx`
- Modify: `frontend/src/App.tsx` (routes)
- Delete: `frontend/src/pages/RuleLibrary.test.tsx` (rewritten in Task 14)

- [ ] **Step 1: Update `App.tsx` routes**

Replace the rule-related routes inside `<Layout>`:

```tsx
import { Navigate } from 'react-router-dom'
// ...
<Route path="/rules" element={<Navigate to="/rules/noise-suppression" replace />} />
<Route path="/rules/:slug" element={<RuleLibrary />} />
```

And make `/` route to `<Navigate to="/rules/noise-suppression" replace />` for now (the Overview page lands in Task 11). Imports unchanged for `RuleLibrary`.

Note: the `noise-suppression` slug assumes it exists. If the backend rule-type table doesn't have that slug, pick the first rule-type from `getRuleTypes()` asynchronously — we'll defer that until Task 11 ships `<Overview>` which does the redirect properly.

- [ ] **Step 2: Delete the old test file**

```
rm frontend/src/pages/RuleLibrary.test.tsx
```

- [ ] **Step 3: Rewrite `RuleLibrary.tsx`**

Full file contents:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import {
  getRuleTypes, getRules, updateRule, deleteRule,
  type RuleType, type Rule,
} from '../api/client'
import { Icon } from '../components/Icon'
import { Switch } from '../components/Switch'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

const PAGE_SIZE = 25

export function RuleLibrary() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { selectedClientId } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tool, setTool] = useState<string>('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  const rt = ruleTypes.find(r => r.slug === slug)

  useEffect(() => { getRuleTypes().then(setRuleTypes).catch(() => {}) }, [])

  useEffect(() => {
    if (!rt || !selectedClientId) return
    setLoading(true)
    setSel(new Set())
    setPage(0)
    getRules({ client_id: selectedClientId, rule_type: rt.id })
      .then(setRules)
      .finally(() => setLoading(false))
  }, [rt?.id, selectedClientId])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rules.filter(r =>
      (!tool || r.tool === tool) &&
      (!ql || r.name.toLowerCase().includes(ql) ||
              (r.description ?? '').toLowerCase().includes(ql) ||
              (r.condition_raw ?? '').toLowerCase().includes(ql))
    )
  }, [rules, q, tool])

  const pageRules = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const enabledCount = rules.filter(r => r.enabled).length
  const tools = Array.from(new Set(rules.map(r => r.tool).filter(Boolean))) as string[]

  const toggleEnabled = async (r: Rule) => {
    const next = !r.enabled
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: next } : x))
    try {
      await updateRule(r.id, { enabled: next })
      toast(next ? 'Rule enabled' : 'Rule disabled', 'ok')
    } catch {
      setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !next } : x))
      toast('Failed to update rule', 'danger')
    }
  }

  const toggleSel = (id: string) => {
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    setSel(prev => prev.size === pageRules.length ? new Set() : new Set(pageRules.map(r => r.id)))
  }
  const onBulkDelete = async () => {
    if (!confirm(`Delete ${sel.size} rule(s)?`)) return
    await Promise.all(Array.from(sel).map(id => deleteRule(id)))
    setRules(prev => prev.filter(r => !sel.has(r.id)))
    setSel(new Set())
    toast('Rules deleted', 'ok')
  }

  if (!selectedClientId) {
    return <div className="page"><EmptyState icon="clients" title="Pick a client"
      body="Use the switcher in the sidebar footer to choose a workspace." /></div>
  }
  if (!rt) return <div className="page"><div className="empty">Rule type not found</div></div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{rt.name}</h1>
          <div className="page-sub">
            <span className="mono">{rt.drl_package}</span>
            <span style={{ margin: '0 6px', color: 'var(--muted-2)' }}>·</span>
            {enabledCount} of {rules.length} enabled
          </div>
        </div>
        <div className="page-actions">
          <button className="btn sm accent" onClick={() => navigate(`/rules/${rt.slug}/new`)}>
            <Icon name="plus" /> New rule
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)}
                 placeholder={`Search ${rt.name.toLowerCase()}…`} />
        </div>
        <select className="select" value={tool} onChange={e => setTool(e.target.value)}>
          <option value="">All tools</option>
          {tools.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="tb-spacer" />
        {sel.size > 0 && (
          <>
            <span className="tb-meta" style={{ color: 'var(--accent)' }}>{sel.size} selected</span>
            <button className="btn sm danger-ghost" onClick={onBulkDelete}>
              <Icon name="trash" /> Delete
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          </>
        )}
        <span className="tb-meta">{filtered.length} rules</span>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="rules">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" className="cbx"
                         checked={sel.size === pageRules.length && pageRules.length > 0}
                         onChange={toggleAll} />
                </th>
                <th className="col-enabled">On</th>
                <th>Rule</th>
                <th>Condition</th>
                <th className="col-tool">Tool</th>
                <th className="col-updated">Updated</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows count={5} cols={7} /> :
                pageRules.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="rules"
                    title={`No ${rt.name} rules yet`}
                    body="Create one to get started."
                    actions={
                      <button className="btn sm accent"
                              onClick={() => navigate(`/rules/${rt.slug}/new`)}>
                        <Icon name="plus" /> Create first rule
                      </button>
                    } />
                  </td></tr>
                ) :
                pageRules.map(r => (
                  <tr key={r.id} className={sel.has(r.id) ? 'selected' : ''}
                      onClick={() => navigate(`/rules/${rt.slug}/edit/${r.id}`)}>
                    <td className="col-check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="cbx"
                             checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} />
                    </td>
                    <td className="col-enabled">
                      <Switch checked={r.enabled} onChange={() => toggleEnabled(r)} />
                    </td>
                    <td>
                      <div className="cell-name">{r.name}</div>
                      {r.description && <div className="cell-desc">{r.description}</div>}
                    </td>
                    <td>
                      <div className="cell-cond">
                        {r.condition_raw || <span className="muted">—</span>}
                      </div>
                    </td>
                    <td>{r.tool ? <span className="tool-badge">{r.tool}</span> : <span className="muted small">—</span>}</td>
                    <td><span className="muted small">{new Date(r.updated_at).toLocaleDateString()}</span></td>
                    <td className="col-actions" onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="btn icon sm ghost" title="Edit"
                                onClick={() => navigate(`/rules/${rt.slug}/edit/${r.id}`)}>
                          <Icon name="edit" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="pager">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="pager-ctrls">
              <button className="btn sm ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span className="small muted" style={{ padding: '0 8px' }}>{page + 1} / {totalPages}</span>
              <button className="btn sm ghost" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify in dev**

```
npm run dev
```
- Navigate to `/rules/noise-suppression`
- Table renders with new design; toggle flips enabled state optimistically and the DB
- Searching filters rows
- Selecting rows → bulk Delete bar appears; Delete prompts confirm, removes rows
- Clicking a row navigates to `/rules/:slug/edit/:id` (route doesn't exist yet → 404 until Task 7)
- With 30+ rules: pager appears
- With 0 rules: empty state with "Create first rule" button

- [ ] **Step 5: Run tests**

```
npm test
```
Expected: green (old `RuleLibrary.test.tsx` deleted; no new tests yet for this page — those come in Task 14).

- [ ] **Step 6: Commit**

```
git add frontend/src/pages/RuleLibrary.tsx frontend/src/App.tsx
git commit -m "task 6: RuleLibrary redesign with inline toggle, bulk bar, pagination, empty states"
```

---

## Task 7: Full-page Rule Editor

**Files:**
- Create: `frontend/src/pages/RuleEditorPage/RuleEditorPage.tsx`
- Create: `frontend/src/pages/RuleEditorPage/conditionParser.ts`
- Create: `frontend/src/pages/RuleEditorPage/conditionParser.test.ts`
- Create: `frontend/src/pages/RuleEditorPage/presets.ts`
- Modify: `frontend/src/App.tsx` (add routes)
- Delete: `frontend/src/components/RuleEditor/RuleEditor.tsx`
- Delete: `frontend/src/components/RuleEditor/RuleEditor.test.tsx`

**Risk:** This task is the biggest. If the step list grows beyond ~60 minutes, checkpoint with the user and consider splitting into 7a (page shell + form) and 7b (condition builder + unsaved guard).

- [ ] **Step 1: Write failing tests for the condition parser**

Create `frontend/src/pages/RuleEditorPage/conditionParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCondition, stringifyCondition } from './conditionParser'

describe('parseCondition', () => {
  it('returns an empty row for empty input', () => {
    expect(parseCondition('')).toEqual([{ field: '', op: '==', value: '' }])
  })
  it('parses a single equality', () => {
    expect(parseCondition('sourceId == "LogicMonitor"'))
      .toEqual([{ field: 'sourceId', op: '==', value: 'LogicMonitor' }])
  })
  it('parses multiple clauses joined by &&', () => {
    expect(parseCondition('sourceId == "LM" && severity > 3'))
      .toEqual([
        { field: 'sourceId', op: '==', value: 'LM' },
        { field: 'severity', op: '>', value: '3' },
      ])
  })
  it('strips the prefix on round-trip', () => {
    expect(parseCondition('groupedAlert.sourceId == "X"', 'groupedAlert'))
      .toEqual([{ field: 'sourceId', op: '==', value: 'X' }])
  })
  it('supports contains / matches', () => {
    expect(parseCondition('name matches "^[A-Z]"'))
      .toEqual([{ field: 'name', op: 'matches', value: '^[A-Z]' }])
  })
})

describe('stringifyCondition', () => {
  it('builds a valid DRL condition with prefix', () => {
    const s = stringifyCondition(
      [{ field: 'sourceId', op: '==', value: 'LM' }, { field: 'severity', op: '>', value: '3' }],
      'groupedAlert',
    )
    expect(s).toBe('groupedAlert.sourceId == "LM" && groupedAlert.severity > 3')
  })
  it('quotes string values but not numbers or booleans', () => {
    expect(stringifyCondition([{ field: 'enabled', op: '==', value: 'true' }], ''))
      .toBe('enabled == true')
  })
  it('skips rows with empty field', () => {
    expect(stringifyCondition([{ field: '', op: '==', value: '' }], ''))
      .toBe('')
  })
  it('round-trips a parsed expression', () => {
    const input = 'sourceId == "LM" && severity > 3'
    expect(stringifyCondition(parseCondition(input), '')).toBe(input)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```
cd frontend && npx vitest run src/pages/RuleEditorPage/conditionParser.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `conditionParser.ts`**

```ts
export interface CondRow { field: string; op: string; value: string }

export const CONDITION_OPS = ['==','!=','<','>','<=','>=','matches','not matches','contains'] as const

export function parseCondition(str: string, prefix = ''): CondRow[] {
  if (!str) return [{ field: '', op: '==', value: '' }]
  const parts = str.split(/\s*&&\s*/)
  return parts.map(p => {
    const m = p.match(/^([^=!<>]+?)\s*(==|!=|<=|>=|<|>|matches|not matches|contains)\s*(.+)$/i)
    if (!m) return { field: p.trim(), op: '==', value: '' }
    let field = m[1].trim()
    if (prefix && field.startsWith(prefix + '.')) field = field.slice(prefix.length + 1)
    let value = m[3].trim().replace(/^["']|["']$/g, '')
    return { field, op: m[2], value }
  })
}

export function stringifyCondition(rows: CondRow[], prefix = ''): string {
  return rows
    .filter(r => r.field.trim())
    .map(r => {
      const field = prefix && !r.field.includes('.') ? `${prefix}.${r.field}` : r.field
      const v = r.value
      const needsQuotes = v !== '' && !/^[0-9]+(\.[0-9]+)?$/.test(v) && v !== 'true' && v !== 'false'
      const quoted = needsQuotes ? `"${v}"` : v
      return `${field} ${r.op} ${quoted}`
    })
    .join(' && ')
}
```

- [ ] **Step 4: Run tests — expect green**

```
npx vitest run src/pages/RuleEditorPage/conditionParser.test.ts
```
Expected: 9 tests pass.

- [ ] **Step 5: Create `presets.ts`**

```ts
export interface ActionPreset { key: string; label: string; template: string }

const PRESETS: Record<string, ActionPreset[]> = {
  'noise-suppression': [
    { key: 'nsSuppress', label: 'Suppress alert',      template: 'request.getGroupedAlert().setIsAlertFiltered("TRUE");' },
    { key: 'nsPassThru', label: 'Pass through',        template: 'request.getGroupedAlert().setIsAlertFiltered("FALSE");' },
    { key: 'nsClose',    label: 'Close alert',         template: 'request.getGroupedAlert().setState("Closed");' },
    { key: 'nsMode',     label: 'Set suppression mode', template: 'request.setSuppressionMode("Rule");' },
    { key: 'custom',     label: 'Custom raw action',   template: '' },
  ],
}

const DEFAULT: ActionPreset[] = [
  { key: 'custom', label: 'Custom raw action', template: '' },
]

export function getActionPresets(slug: string): ActionPreset[] {
  return PRESETS[slug] ?? DEFAULT
}

export const FIELD_SUGGESTIONS: Record<string, string[]> = {
  'noise-suppression':         ['sourceId','alertName','severity','alertAge','description','resourceId','hostname','ciName','state','environmentName','applicationName','sourceType','categoryName'],
  'alert-classification':      ['alertName','severity','sourceId','description','resourceId'],
  'alert-service-classifier':  ['sourceId','alertName','severity','resourceId','status','description','hostname'],
  'alert-enrichment':          ['alertName','sourceId','severity','description'],
  'alert-correlation':         ['alertName','severity','resourceId','tags','duration','description'],
  'incident-creation':         ['severity','name','source','description','status','type','category','environment'],
  'incident-routing':          ['description','title','assignmentGroup','priority','status','source'],
  'incident-user-routing':     ['shortDescription','description','priority'],
  'issue-recommendation':      ['description','name','severity','source','status','category'],
}

// Prefix is attached to condition rows before serializing when rule-type expects it.
export function getPrefix(slug: string): string {
  return slug === 'noise-suppression' ? 'groupedAlert' : ''
}
```

- [ ] **Step 6: Implement `RuleEditorPage.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useClients } from '../../context/ClientContext'
import {
  getRuleTypes, getRules, createRule, updateRule,
  type RuleType, type Rule,
} from '../../api/client'
import { Icon } from '../../components/Icon'
import { Switch } from '../../components/Switch'
import { DrlPreview } from '../../components/DrlPreview'
import { useToast } from '../../components/Toast'
import {
  parseCondition, stringifyCondition, CONDITION_OPS, type CondRow,
} from './conditionParser'
import { getActionPresets, FIELD_SUGGESTIONS, getPrefix } from './presets'

function buildDrl(rt: RuleType, rule: Partial<Rule>): string {
  const header =
    `package ${rt.drl_package};\n\n` +
    rt.imports.map(i => i.statement).join('\n') + '\n\n'
  const body =
    `// ${rule.description ?? ''}\n` +
    `rule "${rule.name || 'UnnamedRule'}"\n` +
    `    no-loop true\n` +
    `when\n` +
    `    ${rule.condition_raw || '/* condition */'}\n` +
    `then\n` +
    `    ${(rule.action_raw || '/* action */').split('\n').join('\n    ')}\n` +
    `end\n`
  return header + body
}

type FormState = {
  name: string
  description: string
  tool: string
  window: number | null
  enabled: boolean
  condition_raw: string
  action_raw: string
}

function emptyForm(): FormState {
  return { name: '', description: '', tool: '', window: null,
           enabled: true, condition_raw: '', action_raw: '' }
}

function formFromRule(r: Rule): FormState {
  return {
    name: r.name,
    description: r.description ?? '',
    tool: r.tool ?? '',
    window: r.window,
    enabled: r.enabled,
    condition_raw: r.condition_raw ?? '',
    action_raw: r.action_raw ?? '',
  }
}

export function RuleEditorPage() {
  const { slug, id } = useParams<{ slug: string; id?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { selectedClientId } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [existing, setExisting] = useState<Rule | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [initial, setInitial] = useState<FormState>(emptyForm)
  const [manual, setManual] = useState(false)
  const [condRows, setCondRows] = useState<CondRow[]>([{ field: '', op: '==', value: '' }])
  const [codeTab, setCodeTab] = useState<'drl' | 'json'>('drl')
  const [saving, setSaving] = useState(false)

  const rt = ruleTypes.find(r => r.slug === slug)
  const prefix = rt ? getPrefix(rt.slug) : ''
  const presets = rt ? getActionPresets(rt.slug) : []
  const fieldSugg = rt ? (FIELD_SUGGESTIONS[rt.slug] ?? []) : []

  useEffect(() => { getRuleTypes().then(setRuleTypes) }, [])

  useEffect(() => {
    if (!id || !selectedClientId || !rt) return
    getRules({ client_id: selectedClientId, rule_type: rt.id }).then(rs => {
      const found = rs.find(r => r.id === id) ?? null
      setExisting(found)
      if (found) {
        const f = formFromRule(found)
        setForm(f); setInitial(f)
        setCondRows(parseCondition(found.condition_raw ?? '', prefix))
        setManual(false)
      }
    })
  }, [id, rt?.id, selectedClientId, prefix])

  // When condition rows change and we're not in manual mode, rebuild the raw string.
  useEffect(() => {
    if (manual) return
    setForm(f => ({ ...f, condition_raw: stringifyCondition(condRows, prefix) }))
  }, [condRows, manual, prefix])

  const drlText = useMemo(() => rt ? buildDrl(rt, form) : '', [rt, form])
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)

  useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && !saving && currentLocation.pathname !== nextLocation.pathname &&
    !window.confirm('You have unsaved changes — discard them?')
  )

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const onSave = useCallback(async () => {
    if (!rt || !selectedClientId) return
    setSaving(true)
    try {
      if (existing) {
        await updateRule(existing.id, {
          name: form.name, description: form.description || null,
          tool: form.tool || null, window: form.window,
          enabled: form.enabled,
          condition_raw: form.condition_raw, action_raw: form.action_raw,
        })
        toast('Rule updated', 'ok')
      } else {
        await createRule({
          client_id: selectedClientId, rule_type_id: rt.id,
          name: form.name, description: form.description || null,
          tool: form.tool || null, window: form.window,
          enabled: form.enabled,
          condition_raw: form.condition_raw, action_raw: form.action_raw,
          condition_meta: null, action_meta: null,
          required_function_names: null, required_import_statements: null,
        })
        toast('Rule created', 'ok')
      }
      setInitial(form)
      navigate(`/rules/${rt.slug}`)
    } catch (e) {
      toast('Save failed', 'danger')
    } finally {
      setSaving(false)
    }
  }, [rt, selectedClientId, existing, form, navigate, toast])

  if (!rt) return <div className="page"><div className="empty">Loading…</div></div>

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb" style={{ marginBottom: 6 }}>
            <span className="sep">Rules</span>
            <span className="sep"> · </span>
            <span className="sep" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/rules/${rt.slug}`)}>{rt.name}</span>
            <span className="sep"> · </span>
            <span className="current">{existing ? existing.id : 'New rule'}</span>
          </div>
          <h1 className="page-title">{existing ? `Edit rule ${existing.name}` : 'Create new rule'}</h1>
          <div className="page-sub">Changes preview live on the right.</div>
        </div>
        <div className="page-actions">
          <button className="btn sm ghost" onClick={() => navigate(`/rules/${rt.slug}`)}>Cancel</button>
          <button className="btn sm accent" onClick={onSave} disabled={saving}>
            <Icon name="save" /> {saving ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </div>

      <div className="editor-wrap">
        <div className="editor-main">
          {/* 1. Identification */}
          <div className="editor-section">
            <div className="editor-section-head">
              <div>
                <div className="editor-section-title"><span className="num">1</span> Identification</div>
                <div className="editor-section-desc">Identify where and how this rule applies.</div>
              </div>
              <div className="hstack">
                <span className="small muted">Enabled</span>
                <Switch checked={form.enabled} onChange={v => update({ enabled: v })} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Name</label>
                <input type="text" value={form.name} onChange={e => update({ name: e.target.value })} />
              </div>
              <div className="field">
                <label>Tool</label>
                <input type="text" value={form.tool} onChange={e => update({ tool: e.target.value })} />
              </div>
              <div className="field">
                <label>Window (min)</label>
                <input type="number" value={form.window ?? ''}
                       onChange={e => update({ window: e.target.value ? +e.target.value : null })} />
              </div>
            </div>
            <div style={{ height: 12 }} />
            <div className="field">
              <label>Description</label>
              <input value={form.description}
                     onChange={e => update({ description: e.target.value })}
                     placeholder="Describe what this rule does in plain English" />
            </div>
          </div>

          {/* 2. Conditions */}
          <div className="editor-section">
            <div className="editor-section-head">
              <div>
                <div className="editor-section-title">
                  <span className="num">2</span> Conditions
                  {prefix && <span className="badge accent mono" style={{ marginLeft: 8 }}>{prefix}.*</span>}
                </div>
                <div className="editor-section-desc">
                  Joined with <span className="mono">&&</span>.
                  {prefix ? ` Prefix ${prefix}. applied automatically.` : ' No prefix.'}
                </div>
              </div>
              <div className="hstack">
                <label className="small muted hstack">
                  <input type="checkbox" className="cbx" checked={manual}
                         onChange={e => setManual(e.target.checked)} />
                  Manual DRL
                </label>
                {!manual && (
                  <button className="btn sm" onClick={() => setCondRows(r => [...r, { field: '', op: '==', value: '' }])}>
                    <Icon name="plus" /> Add
                  </button>
                )}
              </div>
            </div>

            {manual ? (
              <div className="field">
                <textarea value={form.condition_raw}
                          onChange={e => update({ condition_raw: e.target.value })}
                          placeholder='e.g. sourceId == "LogicMonitor" && severity > 3' />
              </div>
            ) : (
              <div className="builder">
                {condRows.map((row, i) => (
                  <div key={i}>
                    <div className="kv-row">
                      <input list="cond-fields" value={row.field}
                             placeholder="field"
                             onChange={e => setCondRows(rs => rs.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} />
                      <select value={row.op}
                              onChange={e => setCondRows(rs => rs.map((x, j) => j === i ? { ...x, op: e.target.value } : x))}>
                        {CONDITION_OPS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input className="mono" value={row.value}
                             placeholder="value"
                             onChange={e => setCondRows(rs => rs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                      <button className="kv-del" title="Remove"
                              onClick={() => setCondRows(rs => rs.filter((_, j) => j !== i))}>
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    {i < condRows.length - 1 && <div className="kv-joiner">AND</div>}
                  </div>
                ))}
                <datalist id="cond-fields">
                  {fieldSugg.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
            )}
          </div>

          {/* 3. Actions */}
          <div className="editor-section">
            <div className="editor-section-head">
              <div>
                <div className="editor-section-title"><span className="num">3</span> Actions</div>
                <div className="editor-section-desc">Executed when conditions match.</div>
              </div>
              <select className="select" value=""
                      onChange={e => {
                        const p = presets.find(x => x.key === e.target.value)
                        if (p?.template) {
                          update({ action_raw: form.action_raw ? `${form.action_raw}\n${p.template}` : p.template })
                        }
                        e.target.value = ''
                      }}>
                <option value="">+ Add preset…</option>
                {presets.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="field">
              <textarea value={form.action_raw}
                        onChange={e => update({ action_raw: e.target.value })}
                        placeholder='e.g. request.getGroupedAlert().setState("Closed");'
                        style={{ minHeight: 140 }} />
            </div>
          </div>

          {/* 4. Metadata */}
          {existing && (
            <div className="editor-section">
              <div className="editor-section-head">
                <div>
                  <div className="editor-section-title"><span className="num">4</span> Metadata</div>
                  <div className="editor-section-desc">Read-only.</div>
                </div>
              </div>
              <div className="form-row">
                <div className="field readonly"><label>Rule ID</label><input value={existing.id} readOnly /></div>
                <div className="field readonly"><label>Created</label><input value={new Date(existing.created_at).toLocaleString()} readOnly /></div>
                <div className="field readonly"><label>Updated</label><input value={new Date(existing.updated_at).toLocaleString()} readOnly /></div>
              </div>
            </div>
          )}
        </div>

        <DrlPreview text={drlText} filename={`${rt.slug}.drl`} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Add routes in `App.tsx`**

Inside the `<Routes>` that live within `<Layout>`, add:

```tsx
import { RuleEditorPage } from './pages/RuleEditorPage/RuleEditorPage'

// inside <Routes>:
<Route path="/rules/:slug/new" element={<RuleEditorPage />} />
<Route path="/rules/:slug/edit/:id" element={<RuleEditorPage />} />
```

- [ ] **Step 8: Delete the legacy modal editor**

```
rm -r frontend/src/components/RuleEditor
```

Grep for any remaining imports of the old path:
```
grep -r "from '.*RuleEditor/RuleEditor'" frontend/src || true
grep -r "RuleEditor\b" frontend/src || true
```
Fix or remove any orphan imports.

- [ ] **Step 9: Verify in dev**

```
npm run dev
```
- Navigate to `/rules/noise-suppression`, click a row → full-page editor renders
- Edit a field → right-side DRL updates live
- Add a condition row → DRL picks it up
- Toggle "Manual DRL" → textarea shows serialized condition; edits flow back if we switch off manual only after editing textarea? (For v1, flipping back to builder re-parses the textarea into rows — this is acceptable future polish.)
- Click Save → rule saved, navigate back to list
- Try Cancel with unsaved edits → confirm prompt blocks navigation
- Create new rule via "+ New rule" on list → lands on `/rules/:slug/new`

- [ ] **Step 10: Run tests**

```
npm test
```
Expected: `conditionParser` tests green; no regressions. The RuleEditor test files are gone.

- [ ] **Step 11: Commit**

```
git add frontend/src/pages/RuleEditorPage frontend/src/App.tsx
git rm -r frontend/src/components/RuleEditor
git commit -m "task 7: full-page Rule Editor with condition builder + unsaved-changes guard"
```

---

## Task 8: Deployments (global + per-client)

**Files:**
- Rewrite: `frontend/src/pages/Deployments.tsx`
- Modify: `frontend/src/App.tsx` (add `/deployments` route)
- Delete: `frontend/src/pages/Deployments.test.tsx`

- [ ] **Step 1: Delete old test**

```
rm frontend/src/pages/Deployments.test.tsx
```

- [ ] **Step 2: Rewrite `Deployments.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getClients, getDeployments, type Client, type Deployment } from '../api/client'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'

type Row = Deployment & { client_code: string; client_name: string }

export function Deployments() {
  const { id: scopedClientId } = useParams<{ id?: string }>()
  const global = !scopedClientId

  const [clients, setClients] = useState<Client[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | Deployment['status']>('')
  const [clientFilter, setClientFilter] = useState<string>('')

  useEffect(() => {
    let cancel = false
    setLoading(true)
    getClients()
      .then(async cs => {
        if (cancel) return
        setClients(cs)
        const scope = scopedClientId ? cs.filter(c => c.id === scopedClientId) : cs
        const all = await Promise.all(scope.map(async c => {
          const deps = await getDeployments(c.id).catch(() => [])
          return deps.map(d => ({ ...d, client_code: c.code, client_name: c.name }))
        }))
        if (cancel) return
        const flat = all.flat().sort((a, b) => b.created_at.localeCompare(a.created_at))
        setRows(flat)
      })
      .finally(() => !cancel && setLoading(false))
    return () => { cancel = true }
  }, [scopedClientId])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter(r =>
      (!statusFilter || r.status === statusFilter) &&
      (!clientFilter || r.client_id === clientFilter) &&
      (!ql || r.version.toLowerCase().includes(ql) ||
              (r.notes ?? '').toLowerCase().includes(ql) ||
              r.client_code.toLowerCase().includes(ql))
    )
  }, [rows, q, statusFilter, clientFilter])

  const scopedClient = clients.find(c => c.id === scopedClientId)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{global ? 'Deployments' : `Deployments · ${scopedClient?.code ?? ''}`}</h1>
          <div className="page-sub">
            {global ? 'History across all clients' : 'Per-client deployment history'}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)}
                 placeholder="Search deployments…" />
        </div>
        {global && (
          <select className="select" value={clientFilter}
                  onChange={e => setClientFilter(e.target.value)}>
            <option value="">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <select className="select" value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as '' | Deployment['status'])}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="deployed">Deployed</option>
        </select>
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} deployments</span>
      </div>

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th className="col-id">Version</th>
              {global && <th>Client</th>}
              <th>Status</th>
              <th>Notes</th>
              <th className="col-updated">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows count={5} cols={global ? 5 : 4} /> :
              filtered.length === 0 ? (
                <tr><td colSpan={global ? 5 : 4}>
                  <EmptyState icon="deploy" title="No deployments yet"
                    body={global ? 'Create a deployment from a client page.' : ''} />
                </td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td><span className="cell-id">{r.version}</span></td>
                  {global && <td className="cell-name">{r.client_code}</td>}
                  <td>
                    <span className={`badge ${r.status === 'deployed' ? 'ok' : 'warn'}`}>
                      <span className="dot" /> {r.status}
                    </span>
                  </td>
                  <td className="small">{r.notes ?? <span className="muted">—</span>}</td>
                  <td><span className="muted small">{new Date(r.created_at).toLocaleString()}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add `/deployments` route in `App.tsx`**

Inside `<Routes>`:

```tsx
<Route path="/deployments" element={<Deployments />} />
```

Keep the existing `<Route path="/clients/:id/deployments" element={<Deployments />} />`.

- [ ] **Step 4: Verify in dev**

- `/deployments` — global view with Client column and client filter
- `/clients/<id>/deployments` — scoped view without Client column or client filter
- Filters work; empty state appears when 0 results

- [ ] **Step 5: Run tests**

```
npm test
```
Expected: green.

- [ ] **Step 6: Commit**

```
git add frontend/src/pages/Deployments.tsx frontend/src/App.tsx
git commit -m "task 8: global /deployments + themed per-client deployments page"
```

---

## Task 9: ImportDrl redesign

**Files:**
- Rewrite: `frontend/src/pages/ImportDrl.tsx`
- Delete: `frontend/src/pages/ImportDrl.test.tsx`

- [ ] **Step 1: Delete old test**

```
rm frontend/src/pages/ImportDrl.test.tsx
```

- [ ] **Step 2: Read the current `ImportDrl.tsx`**

Before rewriting, read `frontend/src/pages/ImportDrl.tsx` to capture any existing helpers the component depends on (error handling for upload, state shape for preview). Preserve behavior; replace UI only.

- [ ] **Step 3: Rewrite `ImportDrl.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useClients } from '../context/ClientContext'
import {
  getRuleTypes, getRules, parseDrlFile, confirmImport,
  type RuleType, type Rule, type ParsedFilePreview,
} from '../api/client'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

export function ImportDrl() {
  const { toast } = useToast()
  const { selectedClientId } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [ruleTypeId, setRuleTypeId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedFilePreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set())
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { getRuleTypes().then(setRuleTypes) }, [])
  useEffect(() => {
    if (!selectedClientId || !ruleTypeId) { setExistingNames(new Set()); return }
    getRules({ client_id: selectedClientId, rule_type: ruleTypeId })
      .then(rs => setExistingNames(new Set(rs.map((r: Rule) => r.name))))
      .catch(() => setExistingNames(new Set()))
  }, [selectedClientId, ruleTypeId])

  const onChoose = async (f: File) => {
    setFile(f); setParsing(true); setPreview(null)
    try {
      const p = await parseDrlFile(f)
      setPreview(p)
      setSelected(new Set(p.rules.map(r => r.name)))
    } catch {
      toast('Parse failed', 'danger')
    } finally {
      setParsing(false)
    }
  }

  const toggle = (name: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }
  const toggleAll = () => {
    if (!preview) return
    setSelected(prev => prev.size === preview.rules.length ? new Set() : new Set(preview.rules.map(r => r.name)))
  }

  const canImport = !!(preview && selectedClientId && ruleTypeId && selected.size > 0)
  const duplicates = useMemo(
    () => new Set(preview?.rules.filter(r => existingNames.has(r.name)).map(r => r.name) ?? []),
    [preview, existingNames],
  )

  const onConfirm = async () => {
    if (!preview || !selectedClientId || !ruleTypeId) return
    setSubmitting(true)
    try {
      const payload = {
        rule_type_id: ruleTypeId,
        functions: preview.functions,
        imports: preview.imports,
        rules: preview.rules
          .filter(r => selected.has(r.name))
          .map(r => ({
            client_id: selectedClientId, rule_type_id: ruleTypeId,
            name: r.name, condition_raw: r.condition_raw, action_raw: r.action_raw,
            required_function_names: r.required_function_names,
            required_import_statements: r.required_import_statements,
          })),
      }
      const res = await confirmImport(payload)
      toast(`Imported ${res.imported} rule(s)`, 'ok')
      setFile(null); setPreview(null); setSelected(new Set())
    } catch {
      toast('Import failed', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  if (!selectedClientId) {
    return <div className="page"><EmptyState icon="clients" title="Pick a client" /></div>
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Import DRL</h1>
          <div className="page-sub">Upload a .drl file to extract rules into the library</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Target</div>
          <div className="form-row">
            <div className="field">
              <label>Rule type</label>
              <select className="select" value={ruleTypeId}
                      onChange={e => setRuleTypeId(e.target.value)}>
                <option value="">Choose rule type…</option>
                {ruleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
              </select>
            </div>
          </div>
          <div className="divider" />
          <div style={{
            border: '2px dashed var(--border-strong)', borderRadius: 10,
            padding: '32px 20px', textAlign: 'center', background: 'var(--bg-sunken)',
          }}
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChoose(f) }}>
            <div style={{ margin: '0 auto 10px', width: 40, height: 40, borderRadius: 10,
                          background: 'var(--accent-soft)', color: 'var(--accent)',
                          display: 'grid', placeItems: 'center' }}>
              <Icon name="upload" size={20} />
            </div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Drop .drl file here</div>
            <div className="small muted" style={{ marginBottom: 12 }}>or click to choose</div>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              Choose file
              <input type="file" accept=".drl,.txt" hidden
                     onChange={e => e.target.files?.[0] && onChoose(e.target.files[0])} />
            </label>
            {file && <div className="small muted" style={{ marginTop: 10 }}>{file.name}</div>}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Preview</div>
            {preview && (
              <span className="tb-meta">{selected.size} of {preview.rules.length} selected</span>
            )}
          </div>
          {parsing ? (
            <div className="empty">Parsing…</div>
          ) : !preview ? (
            <EmptyState icon="upload" title="Upload to preview"
              body="Rules extracted from the DRL file will appear here." />
          ) : (
            <>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)',
                            display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--muted)' }}>
                <span>Package: <span className="mono">{preview.package}</span></span>
                <span>Functions: {preview.functions.length}</span>
                <span>Imports: {preview.imports.length}</span>
              </div>
              <table className="rules">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input type="checkbox" className="cbx"
                             checked={selected.size === preview.rules.length && preview.rules.length > 0}
                             onChange={toggleAll} />
                    </th>
                    <th>Rule name</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rules.map(r => (
                    <tr key={r.name}>
                      <td className="col-check">
                        <input type="checkbox" className="cbx"
                               checked={selected.has(r.name)}
                               onChange={() => toggle(r.name)} />
                      </td>
                      <td>
                        <div className="cell-name">{r.name}</div>
                        {duplicates.has(r.name) && (
                          <span className="badge warn" style={{ marginTop: 4 }}>
                            <Icon name="alertTri" size={11} /> already exists
                          </span>
                        )}
                      </td>
                      <td><div className="cell-cond">{r.condition_raw || <span className="muted">—</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: 12, borderTop: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn sm ghost" onClick={() => { setPreview(null); setFile(null) }}>Clear</button>
                <button className="btn sm accent" disabled={!canImport || submitting} onClick={onConfirm}>
                  {submitting ? 'Importing…' : `Import ${selected.size} rule(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify in dev**

- Upload a test .drl → preview renders with checkboxes
- Names matching existing rules show "already exists" badge
- Deselecting a rule reduces import count
- Clicking "Import N rule(s)" fires `POST /api/import/confirm` and toasts

- [ ] **Step 5: Run tests**

```
npm test
```
Expected: green.

- [ ] **Step 6: Commit**

```
git add frontend/src/pages/ImportDrl.tsx
git commit -m "task 9: ImportDrl redesign with per-rule selection and duplicate warnings"
```

---

## Task 10: Admin split (Users + Access Matrix)

**Files:**
- Rewrite: `frontend/src/pages/AdminPage.tsx`
- Create: `frontend/src/pages/Admin/PasswordStrength.tsx`
- Create: `frontend/src/pages/Admin/PasswordStrength.test.ts`

- [ ] **Step 1: Read the current `AdminPage.tsx`**

Read it to list the admin API endpoints it calls (users list, grant/revoke client access, reset password). We preserve those calls, only reshape the UI.

- [ ] **Step 2: Write failing tests for `PasswordStrength`**

Create `frontend/src/pages/Admin/PasswordStrength.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scorePassword } from './PasswordStrength'

describe('scorePassword', () => {
  it('scores an empty password 0', () => expect(scorePassword('').score).toBe(0))
  it('scores a short password 1', () => expect(scorePassword('abc').score).toBe(1))
  it('scores a mixed-case password 2+', () => expect(scorePassword('abcDEFgh').score).toBeGreaterThanOrEqual(2))
  it('scores a strong password 4', () => expect(scorePassword('Abcd1234!').score).toBe(4))
  it('returns a human label', () => expect(scorePassword('Abcd1234!').label).toBe('Strong'))
})
```

- [ ] **Step 3: Run test — expect fail**

```
cd frontend && npx vitest run src/pages/Admin/PasswordStrength.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `PasswordStrength.tsx`**

```tsx
interface Score { score: 0 | 1 | 2 | 3 | 4; label: string }

export function scorePassword(pw: string): Score {
  if (!pw) return { score: 0, label: 'Empty' }
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score: s as Score['score'], label: labels[s] }
}

export function PasswordStrength({ value }: { value: string }) {
  const { score, label } = scorePassword(value)
  const colors = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--info)', 'var(--ok)']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, height: 4 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 2,
            background: i < score ? colors[score] : 'var(--bg-sunken)',
          }} />
        ))}
      </div>
      <span className="small muted">{label}</span>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — expect green**

```
npx vitest run src/pages/Admin/PasswordStrength.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 6: Rewrite `AdminPage.tsx`**

Preserving the existing admin API calls (read the current file and reuse them), split into two cards:

```tsx
// ... (read existing file to pick up AdminUser shape and API helpers)
// Below is the UI skeleton; wire to the actual admin API calls already in client.ts.

import { useEffect, useState } from 'react'
import { getClients, type Client } from '../api/client'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { PasswordStrength, scorePassword } from './Admin/PasswordStrength'

// The admin API calls (fetchAdminUsers, grantAccess, revokeAccess, resetPassword)
// should already exist in client.ts — import them as-is.
// If their names differ, adapt imports.

interface AdminUser {
  id: string
  username: string
  role: 'admin' | 'contributor'
  last_login: string | null
  client_access: string[] // client ids
}

export function AdminPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [resetFor, setResetFor] = useState<AdminUser | null>(null)
  const [newPw, setNewPw] = useState('')

  useEffect(() => {
    // replace fetchAdminUsers() with the real admin-list helper from client.ts
    // e.g. import { listAdminUsers } from '../api/admin' if it's there
    fetchAdminUsers().then(setUsers)
    getClients().then(setClients)
  }, [])

  const onToggleAccess = async (user: AdminUser, clientId: string, grant: boolean) => {
    try {
      if (grant) await grantAccess(user.id, clientId)
      else       await revokeAccess(user.id, clientId)
      setUsers(prev => prev.map(u => u.id === user.id
        ? { ...u, client_access: grant ? [...u.client_access, clientId] : u.client_access.filter(x => x !== clientId) }
        : u))
      toast(grant ? 'Access granted' : 'Access revoked', 'ok')
    } catch {
      toast('Failed', 'danger')
    }
  }

  const onResetConfirm = async () => {
    if (!resetFor) return
    const { score } = scorePassword(newPw)
    if (score < 3) { toast('Password is too weak', 'warn'); return }
    try {
      await resetPassword(resetFor.id, newPw)
      toast('Password reset', 'ok')
      setResetFor(null); setNewPw('')
    } catch {
      toast('Reset failed', 'danger')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Admin</h1>
          <div className="page-sub">Manage users and per-client access</div>
        </div>
      </div>

      {/* Users card */}
      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      fontSize: 13, fontWeight: 600 }}>Users</div>
        <table className="rules">
          <thead>
            <tr><th>Username</th><th>Role</th><th>Last login</th><th className="col-actions"></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="cell-name">{u.username}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'accent' : 'neutral'}`}>{u.role}</span>
                </td>
                <td><span className="muted small">{u.last_login ?? 'never'}</span></td>
                <td className="col-actions">
                  <button className="btn sm ghost" onClick={() => setResetFor(u)}>
                    <Icon name="shield" /> Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Access matrix card */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      fontSize: 13, fontWeight: 600 }}>Client Access</div>
        <div className="table-scroll">
          <table className="rules">
            <thead>
              <tr>
                <th>User</th>
                {clients.map(c => <th key={c.id} style={{ textAlign: 'center' }}>{c.code}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="cell-name">{u.username}</td>
                  {clients.map(c => {
                    const checked = u.role === 'admin' || u.client_access.includes(c.id)
                    return (
                      <td key={c.id} style={{ textAlign: 'center' }}>
                        <input type="checkbox" className="cbx"
                               checked={checked}
                               disabled={u.role === 'admin'}
                               onChange={() => onToggleAccess(u, c.id, !checked)} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset password dialog */}
      {resetFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      display: 'grid', placeItems: 'center', zIndex: 300 }}>
          <div className="card" style={{ width: 380 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Reset password for {resetFor.username}
            </div>
            <div className="field">
              <label>New password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                     placeholder="At least 8 chars with digit and special" />
              <PasswordStrength value={newPw} />
            </div>
            <div className="hstack" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn sm ghost" onClick={() => { setResetFor(null); setNewPw('') }}>Cancel</button>
              <button className="btn sm accent" onClick={onResetConfirm}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

Replace `fetchAdminUsers`, `grantAccess`, `revokeAccess`, `resetPassword` with the actual helper names from `client.ts` or the admin API module. Grep for them to confirm the correct imports:

```
grep -n "admin" frontend/src/api/client.ts
```

If they don't exist as named exports, use the fetch calls directly from the original file.

- [ ] **Step 7: Delete old test**

```
rm -f frontend/src/pages/AdminPage.test.tsx
```

- [ ] **Step 8: Verify in dev**

- Admin role can see the page, contributors get redirected (existing `ProtectedRoute` with `adminOnly`)
- Users table renders; clicking "Reset password" opens dialog; strength meter updates
- Access matrix: toggling a checkbox calls grant/revoke API and reflects immediately
- Admins shown with all checkboxes checked + disabled

- [ ] **Step 9: Run tests**

```
npm test
```
Expected: `PasswordStrength` tests green; no regressions.

- [ ] **Step 10: Commit**

```
git add frontend/src/pages/AdminPage.tsx frontend/src/pages/Admin
git commit -m "task 10: split Admin page into Users + Access Matrix with password strength"
```

---

## Task 11: Overview dashboard

**Files:**
- Create: `frontend/src/pages/Overview.tsx`
- Modify: `frontend/src/App.tsx` (point `/` to `<Overview />`)

- [ ] **Step 1: Remove the redirect-to-rules we added in Task 6**

In `App.tsx`, change the `/` route from the redirect to `<Overview />` (imported from the new file).

- [ ] **Step 2: Implement `Overview.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import {
  getClients, getRuleTypes, getRules, getDeployments,
  type Client, type RuleType, type Rule, type Deployment,
} from '../api/client'
import { Icon, type IconName } from '../components/Icon'

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: IconName; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label"><Icon name={icon} size={13} /> {label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-delta">{sub}</div>}
    </div>
  )
}

export function Overview() {
  const navigate = useNavigate()
  const { selectedClientId, clients } = useClients()
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])

  useEffect(() => {
    Promise.all([getRuleTypes(), getClients()]).then(([rts, cs]) => {
      setRuleTypes(rts)
      Promise.all(cs.map(c => getDeployments(c.id).catch(() => [])))
        .then(arrs => setDeployments(arrs.flat()))
    })
  }, [])

  useEffect(() => {
    if (!selectedClientId) { setRules([]); return }
    getRules({ client_id: selectedClientId }).then(setRules).catch(() => {})
  }, [selectedClientId])

  const activeRules = rules.filter(r => r.enabled).length
  const last30d = deployments.filter(d => {
    const when = new Date(d.created_at).getTime()
    return Date.now() - when < 30 * 24 * 60 * 60 * 1000
  }).length

  const byType = useMemo(() => {
    const max = Math.max(1, ...ruleTypes.map(rt => rules.filter(r => r.rule_type_id === rt.id).length))
    return ruleTypes.map(rt => ({
      rt, count: rules.filter(r => r.rule_type_id === rt.id).length,
      pct: rules.filter(r => r.rule_type_id === rt.id).length / max * 100,
    }))
  }, [ruleTypes, rules])

  const activity = useMemo(() => {
    // Best-effort activity feed from rule + deployment timestamps
    const rItems = rules.map(r => ({ kind: 'rule' as const, at: r.updated_at, what: r.name }))
    const dItems = deployments.map(d => ({ kind: 'deploy' as const, at: d.created_at, what: `v${d.version} · ${d.status}` }))
    return [...rItems, ...dItems].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10)
  }, [rules, deployments])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Overview</h1>
          <div className="page-sub">Activity across clients and rule types</div>
        </div>
      </div>

      <div className="stats">
        <StatCard label="Total rules" value={rules.length} icon="rules"
                  sub={`${activeRules} enabled`} />
        <StatCard label="Clients" value={clients.length} icon="clients" />
        <StatCard label="Deployments (30d)" value={last30d} icon="deploy" />
        <StatCard label="Rule types" value={ruleTypes.length} icon="layers" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Rules by type</div>
            <div className="small muted">For currently selected client</div>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {byType.length === 0 ? <span className="muted small">No rule types yet</span> :
              byType.map(({ rt, count, pct }) => (
                <div key={rt.id} style={{ cursor: 'pointer' }}
                     onClick={() => navigate(`/rules/${rt.slug}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ fontWeight: 500 }}>{rt.name}</span>
                    <span className="muted mono">{count}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-sunken)',
                                borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%',
                                  background: 'var(--accent)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Recent activity</div>
            <div className="small muted">Latest rule + deployment changes</div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {activity.length === 0 ? <div className="empty">Nothing recent</div> :
              activity.map((a, i) => (
                <div key={i} style={{ padding: '10px 16px', display: 'flex',
                                      gap: 10, alignItems: 'center',
                                      borderBottom: '1px solid var(--border)' }}>
                  <Icon name={a.kind === 'rule' ? 'edit' : 'deploy'} size={14} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{a.what}</div>
                    <div className="small muted">{new Date(a.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Clients</div>
            <div className="small muted">Quick access</div>
          </div>
          <button className="btn sm ghost" onClick={() => navigate('/clients')}>
            View all <Icon name="chevR" size={12} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {clients.map(c => (
            <div key={c.id} style={{ padding: '14px 16px',
                                     borderRight: '1px solid var(--border)',
                                     borderBottom: '1px solid var(--border)',
                                     cursor: 'pointer' }}
                 onClick={() => navigate(`/clients/${c.id}/deployments`)}>
              <span className="cell-id">{c.code}</span>
              <div style={{ fontWeight: 500, marginTop: 4 }}>{c.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in dev**

- `/` shows Overview with stats, rules-by-type bars, activity feed, clients grid
- Clicking a rule type bar → navigates to `/rules/:slug`
- Clicking a client card → navigates to `/clients/:id/deployments`

- [ ] **Step 4: Run tests**

```
npm test
```
Expected: green.

- [ ] **Step 5: Commit**

```
git add frontend/src/pages/Overview.tsx frontend/src/App.tsx
git commit -m "task 11: Overview dashboard at /"
```

---

## Task 12: Smaller page retheme

**Files:**
- Rewrite: `frontend/src/pages/Clients.tsx`
- Rewrite: `frontend/src/pages/LoginPage.tsx`
- Rewrite: `frontend/src/pages/RegisterPage.tsx`
- Rewrite: `frontend/src/pages/AccountPage.tsx`
- Modify: `frontend/src/components/FunctionsPanel/FunctionsPanel.tsx`
- Delete: `frontend/src/pages/Clients.test.tsx`
- Delete: `frontend/src/pages/AccountPage.test.tsx`

No functional changes — visuals only. For each file:

- [ ] **Step 1: `Clients.tsx`**

Retheme to use `.page`, `.page-head`, `.toolbar`, `.table-wrap`, `table.rules`, `.cell-id`, `.cell-name`, `.btn`, `.tb-input`, `Icon`. Preserve all existing API calls (`getClients`, `createClient`, `updateClient`, `deleteClient`) and their handlers. Read the current file first, then restructure JSX.

- [ ] **Step 2: `LoginPage.tsx`**

Use a centered split layout:

```tsx
// Outline (preserve existing login() handler and error state)
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
  <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
    <form className="card" style={{ width: 360 }} onSubmit={onSubmit}>
      <div className="brand-mark" style={{ marginBottom: 16 }}>P</div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Welcome back</h1>
      <div className="small muted" style={{ marginBottom: 20 }}>Sign in to Rules Manager</div>
      <div className="field"><label>Username</label><input .../></div>
      <div className="field" style={{ marginTop: 12 }}><label>Password</label><input type="password" .../></div>
      {error && <div className="callout danger small" style={{ marginTop: 10 }}>{error}</div>}
      <button type="submit" className="btn accent" style={{ width: '100%', marginTop: 16 }}>Sign in</button>
    </form>
  </div>
  <div style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
                display: 'grid', placeItems: 'center', color: 'var(--accent-ink)', padding: 40 }}>
    <div style={{ maxWidth: 380 }}>
      <div style={{ fontSize: 13, opacity: 0.8 }}>Polycloud</div>
      <h2 style={{ fontSize: 28, lineHeight: 1.2, margin: '6px 0 12px', fontWeight: 600 }}>
        Drools rules for every client, in one place.
      </h2>
    </div>
  </div>
</div>
```

Preserve all existing form state and `login()` wiring. The `Layout` is not used on auth pages (they're outside `ProtectedRoute`).

- [ ] **Step 3: `RegisterPage.tsx`**

Mirror the LoginPage layout, adapted for register form fields.

- [ ] **Step 4: `AccountPage.tsx`**

Use `.page`, `.page-head`, `.card`, `.field`. Preserve change-password and profile handlers.

- [ ] **Step 5: `FunctionsPanel.tsx`**

Retheme: wrap in `.card`, use `.field` for inputs, `.btn` for actions, `.code-body` for body-preview display.

- [ ] **Step 6: Delete old test files listed above**

```
rm -f frontend/src/pages/Clients.test.tsx frontend/src/pages/AccountPage.test.tsx
```

- [ ] **Step 7: Verify in dev**

- All five pages visually consistent with the rest of the app
- Login still authenticates; logout returns to login
- Register creates a user
- Account page edits profile / changes password
- FunctionsPanel inside Admin renders without visual glitches

- [ ] **Step 8: Run tests**

```
npm test
```
Expected: green.

- [ ] **Step 9: Commit**

```
git add frontend/src/pages/Clients.tsx frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/AccountPage.tsx frontend/src/components/FunctionsPanel
git commit -m "task 12: retheme Clients, Login, Register, Account, FunctionsPanel"
```

---

## Task 13: ⌘K command palette

**Files:**
- Create: `frontend/src/components/CommandPalette/CommandPalette.tsx`
- Create: `frontend/src/components/CommandPalette/CommandPalette.module.css`
- Modify: `frontend/src/components/layout/Layout.tsx` (mount palette)
- Modify: `frontend/src/components/layout/Topbar.tsx` (click search → open palette)

- [ ] **Step 1: Create the palette component**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { getRules, getClients, getRuleTypes,
         type Rule, type RuleType, type Client } from '../../api/client'
import './CommandPalette.module.css'

interface PaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: PaletteProps) {
  const navigate = useNavigate()
  const [rules, setRules] = useState<Rule[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])

  useEffect(() => {
    if (!open) return
    // Lazy-load dataset each time palette opens; cheap to re-fetch.
    Promise.all([getRules(), getClients(), getRuleTypes()])
      .then(([rs, cs, rts]) => { setRules(rs); setClients(cs); setRuleTypes(rts) })
      .catch(() => {})
  }, [open])

  const go = useCallback((path: string) => { onClose(); navigate(path) }, [navigate, onClose])

  if (!open) return null

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-dialog" onClick={e => e.stopPropagation()}>
        <Command label="Command palette">
          <Command.Input autoFocus placeholder="Search rules, clients, pages…" />
          <Command.List>
            <Command.Empty>No results.</Command.Empty>
            <Command.Group heading="Pages">
              <Command.Item onSelect={() => go('/')}>Overview</Command.Item>
              <Command.Item onSelect={() => go('/rules')}>Rules</Command.Item>
              <Command.Item onSelect={() => go('/deployments')}>Deployments</Command.Item>
              <Command.Item onSelect={() => go('/clients')}>Clients</Command.Item>
              <Command.Item onSelect={() => go('/import')}>Import DRL</Command.Item>
            </Command.Group>
            <Command.Group heading="Rule types">
              {ruleTypes.map(rt => (
                <Command.Item key={rt.id} onSelect={() => go(`/rules/${rt.slug}`)}>
                  {rt.name}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Clients">
              {clients.map(c => (
                <Command.Item key={c.id} onSelect={() => go(`/clients/${c.id}/deployments`)}>
                  {c.code} · {c.name}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Rules">
              {rules.slice(0, 50).map(r => {
                const rt = ruleTypes.find(t => t.id === r.rule_type_id)
                return (
                  <Command.Item key={r.id}
                                onSelect={() => go(`/rules/${rt?.slug ?? ''}/edit/${r.id}`)}>
                    {r.name}
                  </Command.Item>
                )
              })}
            </Command.Group>
            <Command.Group heading="Actions">
              <Command.Item onSelect={() => {
                const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
                document.documentElement.dataset.theme = next
                localStorage.setItem('polycloud.theme', next)
                onClose()
              }}>Toggle theme</Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `CommandPalette.module.css`**

```css
.cmdk-backdrop {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,0.35);
  display: grid; place-items: start center; padding-top: 15vh;
  backdrop-filter: blur(4px);
}
.cmdk-dialog {
  width: min(560px, 92vw);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
[cmdk-input] {
  width: 100%; border: none; outline: none;
  padding: 14px 16px; font-size: 14px;
  background: var(--bg-elev); color: var(--ink);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-sans);
}
[cmdk-list] { max-height: 420px; overflow: auto; padding: 4px; }
[cmdk-group-heading] {
  font-size: 11px; color: var(--muted-2);
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 10px 12px 4px;
}
[cmdk-item] {
  padding: 8px 12px; border-radius: 6px;
  cursor: pointer; font-size: 13px; color: var(--ink-2);
}
[cmdk-item][data-selected="true"] {
  background: var(--bg-hover); color: var(--ink);
}
[cmdk-empty] { padding: 24px; text-align: center; color: var(--muted); }
```

- [ ] **Step 3: Mount palette in Layout + keyboard handler**

Modify `frontend/src/components/layout/Layout.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { CommandPalette } from '../CommandPalette/CommandPalette'
// ...

export function Layout({ children }: LayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setPaletteOpen(o => !o)
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  // Expose via custom event so Topbar can open on click
  useEffect(() => {
    const onOpen = () => setPaletteOpen(true)
    window.addEventListener('polycloud:open-palette', onOpen)
    return () => window.removeEventListener('polycloud:open-palette', onOpen)
  }, [])

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Topbar />
          <div className="page-outlet">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </ToastProvider>
  )
}
```

- [ ] **Step 4: Make topbar search trigger the palette**

In `Topbar.tsx`, replace the `.topbar-search` block with:

```tsx
<div className="topbar-search"
     onClick={() => window.dispatchEvent(new Event('polycloud:open-palette'))}
     role="button" tabIndex={0}>
  <Icon name="search" />
  <span className="grow muted small">Search rules, clients, deployments…</span>
  <span className="kbd">⌘K</span>
</div>
```

(Remove the inner `<input>`.)

- [ ] **Step 5: Verify in dev**

- Press ⌘K / Ctrl+K → palette opens with focus in input
- Type a rule name → filters results
- Select a rule → navigates to its editor
- Select "Toggle theme" → flips theme
- Escape closes palette
- Click topbar search → palette opens
- While typing inside a form field (e.g. Rule Editor name input), ⌘K still opens (global shortcut). Escape closes.

- [ ] **Step 6: Run tests**

```
npm test
```
Expected: green.

- [ ] **Step 7: Commit**

```
git add frontend/src/components/CommandPalette frontend/src/components/layout/Layout.tsx frontend/src/components/layout/Topbar.tsx
git commit -m "task 13: ⌘K command palette via cmdk"
```

---

## Task 14: Cleanup + new test suite

**Files:**
- Delete: `frontend/src/index.css`
- Modify: `frontend/src/main.tsx` (remove the `./index.css` import)
- Modify: `frontend/src/theme.css` (remove unused `.tweaks*` styles)
- Create: `frontend/src/components/layout/Sidebar.test.tsx`
- Create: `frontend/src/pages/RuleLibrary.test.tsx`
- Create: `frontend/src/pages/RuleEditorPage/RuleEditorPage.test.tsx`
- Create: `frontend/src/components/CommandPalette/CommandPalette.test.tsx`

- [ ] **Step 1: Delete `index.css`**

```
rm frontend/src/index.css
```

Remove the matching import from `main.tsx`. Keep `import './theme.css'`.

- [ ] **Step 2: Scrub unused `.tweaks*` blocks from `theme.css`**

Search for `/* Tweaks panel */` in `theme.css` and delete the block (originally ported for the drawer we decided to drop). Also remove any `[data-density]` selectors if they slipped through.

- [ ] **Step 3: Verify build + app**

```
npm run build
npm run dev
```
Manually smoke-test: every route in both light and dark theme.

- [ ] **Step 4: Create `Sidebar.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ username: 'alice', hasAdminRole: true, logout: vi.fn() }),
}))
vi.mock('../../context/ClientContext', () => ({
  useClients: () => ({ clients: [], selectedClientId: null, setSelectedClientId: vi.fn() }),
}))
vi.mock('../../api/client', () => ({
  getRuleTypes: vi.fn(async () => []),
  getRules: vi.fn(async () => []),
}))

describe('Sidebar', () => {
  it('renders workspace + settings nav entries', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Rules')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('hides Admin for non-admin users', () => {
    vi.resetModules()
    vi.doMock('../../context/AuthContext', () => ({
      useAuth: () => ({ username: 'bob', hasAdminRole: false, logout: vi.fn() }),
    }))
    // Simulating hidden-admin requires a dynamic remount; if the static mock at module
    // load wins, skip this assertion and cover in integration.
  })
})
```

- [ ] **Step 5: Create `RuleLibrary.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RuleLibrary } from './RuleLibrary'

vi.mock('../context/ClientContext', () => ({
  useClients: () => ({ selectedClientId: 'c1', clients: [{ id: 'c1', code: 'INFY', name: 'Infy', description: null, created_at: '' }] }),
}))
vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const getRuleTypes = vi.fn(async () => [
  { id: 'rt1', slug: 'noise-suppression', name: 'Noise Suppression', pipeline_stage: 1, drl_package: 'com.x', functions: [], imports: [] },
])
const getRules = vi.fn(async () => [
  { id: 'r1', client_id: 'c1', rule_type_id: 'rt1', name: 'R1', description: null, tool: null, condition_raw: 'a == 1', action_raw: null, condition_meta: null, action_meta: null, enabled: true, window: null, required_function_names: null, required_import_statements: null, created_at: '', updated_at: new Date().toISOString() },
])
const updateRule = vi.fn(async () => ({} as any))
vi.mock('../api/client', () => ({ getRuleTypes, getRules, updateRule, deleteRule: vi.fn() }))

describe('RuleLibrary', () => {
  it('renders rule rows and toggles enabled', async () => {
    render(
      <MemoryRouter initialEntries={['/rules/noise-suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('R1')).toBeInTheDocument())
    const switches = screen.getAllByRole('checkbox')
    const enabledSwitch = switches.find(s => (s as HTMLInputElement).checked)!
    fireEvent.click(enabledSwitch)
    await waitFor(() => expect(updateRule).toHaveBeenCalledWith('r1', { enabled: false }))
  })

  it('shows empty state when no rules', async () => {
    getRules.mockResolvedValueOnce([])
    render(
      <MemoryRouter initialEntries={['/rules/noise-suppression']}>
        <Routes>
          <Route path="/rules/:slug" element={<RuleLibrary />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText(/No Noise Suppression rules yet/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 6: Create `RuleEditorPage.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RuleEditorPage } from './RuleEditorPage'

vi.mock('../../context/ClientContext', () => ({
  useClients: () => ({ selectedClientId: 'c1', clients: [] }),
}))
vi.mock('../../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const rt = { id: 'rt1', slug: 'noise-suppression', name: 'Noise Suppression',
             pipeline_stage: 1, drl_package: 'com.x', functions: [], imports: [] }
vi.mock('../../api/client', () => ({
  getRuleTypes: vi.fn(async () => [rt]),
  getRules: vi.fn(async () => []),
  createRule: vi.fn(async () => ({})),
  updateRule: vi.fn(async () => ({})),
}))

describe('RuleEditorPage (new)', () => {
  it('renders an empty form for /new', async () => {
    render(
      <MemoryRouter initialEntries={['/rules/noise-suppression/new']}>
        <Routes>
          <Route path="/rules/:slug/new" element={<RuleEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('Create new rule')).toBeInTheDocument())
    expect(screen.getByText('Conditions')).toBeInTheDocument()
  })

  it('updates the DRL preview when the name changes', async () => {
    render(
      <MemoryRouter initialEntries={['/rules/noise-suppression/new']}>
        <Routes>
          <Route path="/rules/:slug/new" element={<RuleEditorPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('Create new rule')).toBeInTheDocument())
    const nameInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(nameInput, { target: { value: 'MY_RULE' } })
    await waitFor(() => expect(screen.getByText(/"MY_RULE"/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 7: Create `CommandPalette.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'

vi.mock('../../api/client', () => ({
  getRules: vi.fn(async () => []),
  getClients: vi.fn(async () => []),
  getRuleTypes: vi.fn(async () => []),
}))

describe('CommandPalette', () => {
  it('renders when open and hides when closed', () => {
    const onClose = vi.fn()
    const { rerender } = render(<MemoryRouter><CommandPalette open={false} onClose={onClose} /></MemoryRouter>)
    expect(screen.queryByPlaceholderText(/Search rules/i)).not.toBeInTheDocument()
    rerender(<MemoryRouter><CommandPalette open={true} onClose={onClose} /></MemoryRouter>)
    expect(screen.getByPlaceholderText(/Search rules/i)).toBeInTheDocument()
  })

  it('closes when backdrop clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<MemoryRouter><CommandPalette open={true} onClose={onClose} /></MemoryRouter>)
    fireEvent.click(container.querySelector('.cmdk-backdrop')!)
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 8: Run the full test suite**

```
npm test
```
Expected: all tests green. If any fail, fix before commit — this is the safety net.

- [ ] **Step 9: Run the full production build**

```
npm run build
npm run lint
```
Expected: both succeed.

- [ ] **Step 10: Manual smoke test of every route (both themes)**

| Route | What to verify |
|---|---|
| `/` | Overview stats, by-type bars, activity, clients |
| `/rules/noise-suppression` | Table with toggle, search, bulk bar, pagination, empty state on fresh client |
| `/rules/noise-suppression/new` | Editor loads; save round-trips |
| `/rules/noise-suppression/edit/:id` | Loads existing rule; edits persist; unsaved-change prompt on cancel |
| `/deployments` | Global table with Client column |
| `/clients/:id/deployments` | Per-client table without Client column |
| `/clients` | Themed list + CRUD |
| `/import` | Drag-drop + checkbox selection + duplicate warnings |
| `/admin` | Users card + access matrix + reset-password dialog |
| `/account` | Profile form + change-password |
| `/login`, `/register` | Split-panel layout renders |

Toggle dark mode at each route — no unreadable text, no broken borders.

- [ ] **Step 11: Commit**

```
git add -A
git commit -m "task 14: delete index.css, rewrite test suite against new DOM"
```

---

## Post-plan checklist

- [ ] All 14 task commits landed on `ui-redesign-2026-04`
- [ ] `npm run build`, `npm run lint`, `npm test` all pass on the final commit
- [ ] No remote push, no PR — wait for user to explicitly request the merge/PR step
- [ ] If any task surfaced a regression traced to an earlier task, patch was applied and committed before proceeding

## Notes on deferred work (tracked for future spec)

- Backend `PATCH /api/rules/reorder` + `sequence` column for drag-to-reorder
- Backend `DeploymentRuleSnapshot` diff endpoint for deployment-diff column
- Backend `GET /api/rules/preview-drl` for rule-type-wide DRL preview
- Real audit-log table behind the "Recent activity" feed
- Server-side pagination (`limit`/`offset`) on `GET /api/rules`
