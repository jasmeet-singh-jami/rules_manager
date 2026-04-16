# Polycloud Rules Manager — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete React + TypeScript frontend that replaces `rules_manager.html`, providing pages for managing rules, clients, deployments, and DRL imports.

**Architecture:** Single-page app with React Router v6. All data fetched from the FastAPI backend via a typed API client (`src/api/client.ts`). State is local component state (useState + useEffect) — no external state library. Styling matches the existing design in `rules_manager.html`: CSS variables, Segoe UI font, navy-blue header gradient. Vitest + @testing-library/react for tests.

**Tech Stack:** React 18, TypeScript, Vite 5, React Router v6, Vitest, @testing-library/react, jsdom

---

## File Map

```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx                       ← React entry point
│   ├── App.tsx                        ← Router + Routes
│   ├── index.css                      ← Global CSS variables + base styles
│   ├── test-setup.ts                  ← @testing-library/jest-dom setup
│   ├── api/
│   │   └── client.ts                  ← Typed API functions + all interfaces
│   ├── components/
│   │   ├── layout/
│   │   │   └── Layout.tsx             ← Top nav + page wrapper
│   │   ├── RuleEditor/
│   │   │   └── RuleEditor.tsx         ← Add/edit rule modal with DRL preview
│   │   └── DrlPreview.tsx             ← Formatted DRL code block (read-only)
│   └── pages/
│       ├── RuleLibrary.tsx            ← / — client selector + tabs + rules table
│       ├── Clients.tsx                ← /clients — CRUD list
│       ├── Deployments.tsx            ← /clients/:id/deployments
│       └── ImportDrl.tsx              ← /import — upload + preview + confirm
```

Backend is expected at `http://localhost:8000`. In dev, Vite proxies `/api` → `:8000`.

---

### Task 1: Vite Project Scaffold

**Files:**
- Create: `frontend/` (entire Vite project)

- [ ] **Step 1: Scaffold the Vite + React + TypeScript project**

```bash
cd D:/GenAI/rules-generator
npm create vite@5 frontend -- --template react-ts
cd frontend
npm install
```

Expected: `frontend/` directory created with `src/App.tsx`, `vite.config.ts`, `package.json`.

- [ ] **Step 2: Install runtime + test dependencies**

```bash
cd D:/GenAI/rules-generator/frontend
npm install react-router-dom
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Replace `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Create `frontend/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Update `frontend/tsconfig.json` — add vitest globals**

Open `tsconfig.json` and add `"types": ["vitest/globals"]` inside `compilerOptions`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 6: Verify tests run**

```bash
cd frontend && npx vitest run
```

Expected: `No test files found` (zero failures — Vitest finds nothing yet)

- [ ] **Step 7: Verify dev server starts**

```bash
cd frontend && npm run dev &
sleep 3
curl http://localhost:5173
kill %1
```

Expected: HTML response (React app shell).

- [ ] **Step 8: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/
git commit -m "feat: scaffold Vite + React + TypeScript frontend with Vitest"
```

---

### Task 2: Typed API Client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`

- [ ] **Step 1: Write failing test `frontend/src/api/client.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getClients, createClient, getRules, getRuleTypes } from './client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockOk(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as Response)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getClients', () => {
  it('calls GET /api/clients', async () => {
    mockOk([{ id: '1', code: 'X', name: 'X Corp', description: null, created_at: '' }])
    const result = await getClients()
    expect(mockFetch).toHaveBeenCalledWith('/api/clients', expect.any(Object))
    expect(result).toHaveLength(1)
  })
})

describe('createClient', () => {
  it('calls POST /api/clients with JSON body', async () => {
    mockOk({ id: '2', code: 'Y', name: 'Y Corp', description: null, created_at: '' }, 201)
    await createClient({ code: 'Y', name: 'Y Corp' })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/clients',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('getRuleTypes', () => {
  it('calls GET /api/rule-types', async () => {
    mockOk([])
    await getRuleTypes()
    expect(mockFetch).toHaveBeenCalledWith('/api/rule-types', expect.any(Object))
  })
})

describe('getRules', () => {
  it('calls GET /api/rules with no query string when no filters', async () => {
    mockOk([])
    await getRules()
    expect(mockFetch).toHaveBeenCalledWith('/api/rules', expect.any(Object))
  })

  it('appends client_id query param when provided', async () => {
    mockOk([])
    await getRules({ client_id: 'abc-123' })
    expect(mockFetch).toHaveBeenCalledWith('/api/rules?client_id=abc-123', expect.any(Object))
  })

  it('appends multiple filters', async () => {
    mockOk([])
    await getRules({ client_id: 'abc', tool: 'Tivoli' })
    const url = (mockFetch.mock.calls[0][0] as string)
    expect(url).toContain('client_id=abc')
    expect(url).toContain('tool=Tivoli')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/api/client.test.ts
```

Expected: `Cannot find module './client'`

- [ ] **Step 3: Create `frontend/src/api/client.ts`**

```typescript
const BASE = '/api'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  code: string
  name: string
  description: string | null
  created_at: string
}

export interface RuleType {
  id: string
  slug: string
  name: string
  pipeline_stage: number
  drl_package: string
  drl_imports: string
  drl_functions: string | null
}

export interface Rule {
  id: string
  client_id: string
  rule_type_id: string
  name: string
  description: string | null
  tool: string | null
  condition_raw: string | null
  action_raw: string | null
  condition_meta: unknown
  action_meta: unknown
  enabled: boolean
  priority: string | null
  window: number | null
  created_at: string
  updated_at: string
}

export interface Deployment {
  id: string
  client_id: string
  version: string
  status: 'draft' | 'deployed'
  notes: string | null
  created_at: string
}

export interface ParsedRulePreview {
  name: string
  condition_raw: string
  action_raw: string
}

export interface ParsedFilePreview {
  filename: string
  package: string
  rule_count: number
  rules: ParsedRulePreview[]
}

export interface ImportConfirmRule {
  client_id: string
  rule_type_id: string
  name: string
  description?: string
  tool?: string
  condition_raw: string
  action_raw: string
}

// ── Core request helper ───────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (init.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...init.headers } })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Clients ───────────────────────────────────────────────────────────────

export const getClients = () =>
  request<Client[]>('/clients')

export const createClient = (body: { code: string; name: string; description?: string }) =>
  request<Client>('/clients', { method: 'POST', body: JSON.stringify(body) })

export const updateClient = (id: string, body: { name?: string; description?: string }) =>
  request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteClient = (id: string) =>
  request<void>(`/clients/${id}`, { method: 'DELETE' })

// ── Rule Types ────────────────────────────────────────────────────────────

export const getRuleTypes = () =>
  request<RuleType[]>('/rule-types')

// ── Rules ─────────────────────────────────────────────────────────────────

export interface RuleFilters {
  client_id?: string
  rule_type?: string
  tool?: string
  search?: string
}

export const getRules = (filters: RuleFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.client_id) params.set('client_id', filters.client_id)
  if (filters.rule_type) params.set('rule_type', filters.rule_type)
  if (filters.tool) params.set('tool', filters.tool)
  if (filters.search) params.set('search', filters.search)
  const qs = params.toString()
  return request<Rule[]>(`/rules${qs ? `?${qs}` : ''}`)
}

export const createRule = (body: Omit<Rule, 'id' | 'created_at' | 'updated_at'>) =>
  request<Rule>('/rules', { method: 'POST', body: JSON.stringify(body) })

export const updateRule = (id: string, body: Partial<Omit<Rule, 'id' | 'created_at' | 'updated_at'>>) =>
  request<Rule>(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteRule = (id: string) =>
  request<void>(`/rules/${id}`, { method: 'DELETE' })

export const copyRule = (id: string, target_client_id: string) =>
  request<Rule>(`/rules/${id}/copy`, { method: 'POST', body: JSON.stringify({ target_client_id }) })

// ── Deployments ───────────────────────────────────────────────────────────

export const getDeployments = (client_id: string) =>
  request<Deployment[]>(`/clients/${client_id}/deployments`)

export const createDeployment = (body: { client_id: string; version: string; notes?: string }) =>
  request<Deployment>('/deployments', { method: 'POST', body: JSON.stringify(body) })

export const exportDeployment = (id: string): Promise<Response> =>
  fetch(`${BASE}/deployments/${id}/export`)

// ── Import ────────────────────────────────────────────────────────────────

export const parseDrlFile = async (file: File): Promise<ParsedFilePreview> => {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/import/parse`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<ParsedFilePreview>
}

export const confirmImport = (rules: ImportConfirmRule[]) =>
  request<{ imported: number; rule_ids: string[] }>('/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ rules }),
  })
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/api/client.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/src/api/
git commit -m "feat: add typed API client with fetch wrapper"
```

---

### Task 3: App Shell — Router, Layout, Global CSS

**Files:**
- Create: `frontend/src/index.css`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/layout/Layout.tsx`
- Create: `frontend/src/components/layout/Layout.test.tsx`

- [ ] **Step 1: Write failing test `frontend/src/components/layout/Layout.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Layout } from './Layout'

describe('Layout', () => {
  it('renders the app title', () => {
    render(
      <MemoryRouter>
        <Layout><div>content</div></Layout>
      </MemoryRouter>
    )
    expect(screen.getByText('Polycloud Rules Manager')).toBeInTheDocument()
  })

  it('renders nav links', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /rule library/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clients/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /import/i })).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <MemoryRouter>
        <Layout><p>hello world</p></Layout>
      </MemoryRouter>
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/components/layout/Layout.test.tsx
```

Expected: `Cannot find module './Layout'`

- [ ] **Step 3: Create `frontend/src/index.css`**

```css
:root {
  --bg: #eef3f9;
  --panel: #ffffff;
  --ink: #0f1d31;
  --muted: #5c6c85;
  --line: #dce4ef;
  --accent: #0b5cab;
  --ok: #1b7f47;
  --warn: #a25d00;
  --danger: #b42318;
  --radius: 10px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: var(--ink);
  background: var(--bg);
  font-size: 14px;
}

button {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font: 600 13px "Segoe UI", sans-serif;
  cursor: pointer;
  transition: opacity 0.15s;
}
button:hover { opacity: 0.85; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary { background: var(--accent); color: #fff; }
.btn-outline { background: #fff; border: 1px solid var(--accent); color: var(--accent); }
.btn-danger  { background: #fee2e2; color: var(--danger); }
.btn-sm      { padding: 5px 9px; font-size: 12px; }

input, select, textarea {
  font: 14px "Segoe UI", sans-serif;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 10px;
  color: var(--ink);
  background: #fff;
  width: 100%;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}
textarea { resize: vertical; font-family: "Consolas", monospace; font-size: 13px; }

label { font-weight: 600; font-size: 13px; display: block; margin-bottom: 4px; }

table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 12px; color: var(--muted); font-weight: 600;
     border-bottom: 2px solid var(--line); padding: 8px 10px; }
td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
tr:hover td { background: #f7f9fd; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}
.badge-ok   { background: #daf4e3; color: var(--ok); }
.badge-muted{ background: #e8edf4; color: var(--muted); }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff;
  border-radius: var(--radius);
  padding: 24px;
  width: 900px; max-width: 95vw; max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.modal h2 { margin: 0 0 20px; font-size: 1.1rem; }

.form-row { margin-bottom: 14px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

.page-wrap { max-width: 1400px; margin: 0 auto; padding: 20px; }

.error-msg { color: var(--danger); font-size: 13px; margin: 8px 0; }
.muted { color: var(--muted); }
```

- [ ] **Step 4: Create `frontend/src/components/layout/Layout.tsx`**

```tsx
import { Link, useLocation } from 'react-router-dom'

interface Props { children: React.ReactNode }

export function Layout({ children }: Props) {
  const { pathname } = useLocation()

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      style={{
        color: '#fff',
        textDecoration: 'none',
        padding: '6px 14px',
        borderRadius: 7,
        fontWeight: 600,
        fontSize: 13,
        background: pathname === to ? 'rgba(255,255,255,0.18)' : 'transparent',
      }}
    >
      {label}
    </Link>
  )

  return (
    <>
      <header style={{
        background: 'linear-gradient(135deg, #0c3a70, #0f6fb3)',
        color: '#fff',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        <h1 style={{ margin: 0, fontSize: '1.15rem', whiteSpace: 'nowrap' }}>
          Polycloud Rules Manager
        </h1>
        <nav style={{ display: 'flex', gap: 4 }}>
          {navLink('/', 'Rule Library')}
          {navLink('/clients', 'Clients')}
          {navLink('/import', 'Import DRL')}
        </nav>
      </header>
      <main className="page-wrap">{children}</main>
    </>
  )
}
```

- [ ] **Step 5: Replace `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RuleLibrary } from './pages/RuleLibrary'
import { Clients } from './pages/Clients'
import { Deployments } from './pages/Deployments'
import { ImportDrl } from './pages/ImportDrl'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<RuleLibrary />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id/deployments" element={<Deployments />} />
          <Route path="/import" element={<ImportDrl />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Replace `frontend/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Create stub pages so App.tsx imports don't fail**

Create `frontend/src/pages/RuleLibrary.tsx`:
```tsx
export function RuleLibrary() { return <p>Rule Library</p> }
```

Create `frontend/src/pages/Clients.tsx`:
```tsx
export function Clients() { return <p>Clients</p> }
```

Create `frontend/src/pages/Deployments.tsx`:
```tsx
export function Deployments() { return <p>Deployments</p> }
```

Create `frontend/src/pages/ImportDrl.tsx`:
```tsx
export function ImportDrl() { return <p>Import DRL</p> }
```

- [ ] **Step 8: Run Layout tests — expect PASS**

```bash
cd frontend && npx vitest run src/components/layout/Layout.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 9: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/src/
git commit -m "feat: add app shell with router, layout, and global CSS"
```

---

### Task 4: Clients Page

**Files:**
- Modify: `frontend/src/pages/Clients.tsx`
- Create: `frontend/src/pages/Clients.test.tsx`

- [ ] **Step 1: Write failing test `frontend/src/pages/Clients.test.tsx`**

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Clients } from './Clients'
import * as api from '../api/client'

vi.mock('../api/client')

const mockClients = [
  { id: '1', code: 'INFY', name: 'Infosys', description: 'Main client', created_at: '2024-01-01T00:00:00Z' },
]

describe('Clients page', () => {
  beforeEach(() => {
    vi.mocked(api.getClients).mockResolvedValue(mockClients)
    vi.mocked(api.createClient).mockResolvedValue({ ...mockClients[0], id: '2', code: 'NEW' })
    vi.mocked(api.updateClient).mockResolvedValue(mockClients[0])
    vi.mocked(api.deleteClient).mockResolvedValue(undefined)
  })

  it('renders page heading', async () => {
    render(<MemoryRouter><Clients /></MemoryRouter>)
    expect(screen.getByText('Clients')).toBeInTheDocument()
  })

  it('lists clients after load', async () => {
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('INFY')).toBeInTheDocument())
    expect(screen.getByText('Infosys')).toBeInTheDocument()
  })

  it('opens new client modal on button click', async () => {
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await waitFor(() => screen.getByText('INFY'))
    fireEvent.click(screen.getByRole('button', { name: /new client/i }))
    expect(screen.getByLabelText(/client code/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/pages/Clients.test.tsx
```

Expected: FAIL (stub `Clients` has no content)

- [ ] **Step 3: Implement `frontend/src/pages/Clients.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Client, getClients, createClient, updateClient, deleteClient } from '../api/client'

interface FormState { code: string; name: string; description: string }
const empty: FormState = { code: '', name: '', description: '' }

export function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'new' | Client | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => setError('Failed to load clients'))
      .finally(() => setLoading(false))
  }, [])

  function openNew() { setForm(empty); setModal('new') }
  function openEdit(c: Client) {
    setForm({ code: c.code, name: c.name, description: c.description ?? '' })
    setModal(c)
  }
  function closeModal() { setModal(null); setError('') }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (modal === 'new') {
        const c = await createClient(form)
        setClients(prev => [...prev, c])
      } else if (modal) {
        const c = await updateClient((modal as Client).id, { name: form.name, description: form.description })
        setClients(prev => prev.map(x => x.id === c.id ? c : x))
      }
      closeModal()
    } catch {
      setError('Save failed — check that the client code is unique')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Client) {
    if (!confirm(`Delete client "${c.name}"? This removes all their rules.`)) return
    await deleteClient(c.id)
    setClients(prev => prev.filter(x => x.id !== c.id))
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Clients</h2>
        <button className="btn-primary" onClick={openNew}>+ New Client</button>
      </div>

      {loading && <p className="muted">Loading…</p>}

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Description</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>{c.name}</td>
                <td className="muted">{c.description ?? '—'}</td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/clients/${c.id}/deployments`}>
                      <button className="btn-outline btn-sm">Deployments</button>
                    </Link>
                    <button className="btn-outline btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(c)}>Delete</button>
                  </span>
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                No clients yet. Click "+ New Client" to add one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'New Client' : `Edit: ${(modal as Client).name}`}</h2>
            {error && <p className="error-msg">{error}</p>}
            <div className="form-row">
              <label htmlFor="client-code">Client Code</label>
              <input
                id="client-code"
                placeholder="e.g. INFY"
                value={form.code}
                disabled={modal !== 'new'}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-name">Name</label>
              <input
                id="client-name"
                placeholder="Display name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-desc">Description</label>
              <input
                id="client-desc"
                placeholder="Optional"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={closeModal}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/pages/Clients.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/src/pages/Clients.tsx frontend/src/pages/Clients.test.tsx
git commit -m "feat: add Clients page with CRUD modal"
```

---

### Task 5: Rule Library Page

**Files:**
- Modify: `frontend/src/pages/RuleLibrary.tsx`
- Create: `frontend/src/pages/RuleLibrary.test.tsx`

- [ ] **Step 1: Write failing test `frontend/src/pages/RuleLibrary.test.tsx`**

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RuleLibrary } from './RuleLibrary'
import * as api from '../api/client'

vi.mock('../api/client')
vi.mock('../components/RuleEditor/RuleEditor', () => ({
  RuleEditor: () => <div data-testid="rule-editor" />,
}))

const mockClients = [
  { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
]
const mockRuleTypes = [
  { id: 'rt1', slug: 'alert_classifier', name: 'Alert Classifier', pipeline_stage: 1, drl_package: '', drl_imports: '', drl_functions: null },
  { id: 'rt2', slug: 'noise_suppression', name: 'Noise Suppression', pipeline_stage: 2, drl_package: '', drl_imports: '', drl_functions: null },
]
const mockRules = [
  { id: 'r1', client_id: 'c1', rule_type_id: 'rt1', name: 'AlertRule_1', description: null,
    tool: 'LogicMonitor', condition_raw: 'x', action_raw: 'y', condition_meta: null,
    action_meta: null, enabled: true, priority: 'P1', window: null, created_at: '', updated_at: '' },
]

beforeEach(() => {
  vi.mocked(api.getClients).mockResolvedValue(mockClients)
  vi.mocked(api.getRuleTypes).mockResolvedValue(mockRuleTypes)
  vi.mocked(api.getRules).mockResolvedValue(mockRules)
  vi.mocked(api.deleteRule).mockResolvedValue(undefined)
})

describe('RuleLibrary', () => {
  it('renders the page heading', () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    expect(screen.getByText('Rule Library')).toBeInTheDocument()
  })

  it('shows client selector dropdown', async () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    await waitFor(() => screen.getByText('Infosys'))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows rule type tabs after client selected', async () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    await waitFor(() => screen.getByText('Alert Classifier'))
    expect(screen.getByText('Noise Suppression')).toBeInTheDocument()
  })

  it('shows rules in the table', async () => {
    render(<MemoryRouter><RuleLibrary /></MemoryRouter>)
    await waitFor(() => screen.getByText('AlertRule_1'))
    expect(screen.getByText('LogicMonitor')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/pages/RuleLibrary.test.tsx
```

Expected: FAIL (stub + missing RuleEditor import)

- [ ] **Step 3: Create stub RuleEditor (needed for import)**

Create `frontend/src/components/RuleEditor/RuleEditor.tsx`:
```tsx
import { Rule, RuleType, Client } from '../../api/client'

interface Props {
  rule: Partial<Rule> | null
  ruleTypes: RuleType[]
  clients: Client[]
  defaultClientId?: string
  defaultRuleTypeId?: string
  onSave: (rule: Rule) => void
  onClose: () => void
}

export function RuleEditor(_props: Props) {
  return <p>RuleEditor stub</p>
}
```

- [ ] **Step 4: Implement `frontend/src/pages/RuleLibrary.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Client, Rule, RuleType, getRules, getClients, getRuleTypes, deleteRule } from '../api/client'
import { RuleEditor } from '../components/RuleEditor/RuleEditor'

const TOOLS = ['Any', 'LogicMonitor', 'SCOM', 'Tivoli', 'Dynatrace', 'Solarwinds', 'Datadog']

export function RuleLibrary() {
  const [clients, setClients] = useState<Client[]>([])
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [activeTabIdx, setActiveTabIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [toolFilter, setToolFilter] = useState('')
  const [editingRule, setEditingRule] = useState<Partial<Rule> | null | 'new'>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([getClients(), getRuleTypes()]).then(([c, rt]) => {
      setClients(c)
      setRuleTypes(rt)
      if (c.length > 0) setSelectedClientId(c[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedClientId || ruleTypes.length === 0) return
    setLoading(true)
    const rt = ruleTypes[activeTabIdx]
    getRules({
      client_id: selectedClientId,
      rule_type: rt?.slug,
      tool: toolFilter || undefined,
      search: search || undefined,
    })
      .then(setRules)
      .finally(() => setLoading(false))
  }, [selectedClientId, activeTabIdx, toolFilter, search, ruleTypes])

  async function handleDelete(rule: Rule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return
    await deleteRule(rule.id)
    setRules(prev => prev.filter(r => r.id !== rule.id))
  }

  function handleSaved(rule: Rule) {
    setRules(prev => {
      const idx = prev.findIndex(r => r.id === rule.id)
      if (idx >= 0) return prev.map(r => r.id === rule.id ? rule : r)
      return [...prev, rule]
    })
    setEditingRule(null)
  }

  const activeRuleType = ruleTypes[activeTabIdx]

  return (
    <>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Rule Library</h2>
        <button
          className="btn-primary"
          disabled={!selectedClientId}
          onClick={() => setEditingRule('new')}
        >
          + Add Rule
        </button>
      </div>

      {/* Client selector */}
      <div style={{ marginBottom: 14 }}>
        <select
          value={selectedClientId}
          onChange={e => { setSelectedClientId(e.target.value); setActiveTabIdx(0) }}
          style={{ width: 260 }}
        >
          {clients.length === 0 && <option value="">Loading clients…</option>}
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </select>
      </div>

      {/* Rule type tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid var(--line)' }}>
        {ruleTypes.map((rt, i) => (
          <button
            key={rt.id}
            onClick={() => setActiveTabIdx(i)}
            style={{
              background: 'none', border: 'none',
              borderBottom: i === activeTabIdx ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0, padding: '8px 16px',
              color: i === activeTabIdx ? 'var(--accent)' : 'var(--muted)',
              fontWeight: i === activeTabIdx ? 700 : 400,
              cursor: 'pointer', marginBottom: -2,
            }}
          >
            {rt.name}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <select value={toolFilter} onChange={e => setToolFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">All tools</option>
          {TOOLS.map(t => <option key={t} value={t === 'Any' ? '' : t}>{t}</option>)}
        </select>
      </div>

      {/* Rules table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Tool</th><th>Priority</th><th>Enabled</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }} className="muted">Loading…</td></tr>
            )}
            {!loading && rules.map(rule => (
              <tr key={rule.id}>
                <td><strong>{rule.name}</strong>
                  {rule.description && <div className="muted" style={{ fontSize: 12 }}>{rule.description}</div>}
                </td>
                <td>{rule.tool ?? <span className="muted">—</span>}</td>
                <td>{rule.priority ?? <span className="muted">—</span>}</td>
                <td>
                  <span className={`badge ${rule.enabled ? 'badge-ok' : 'badge-muted'}`}>
                    {rule.enabled ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-outline btn-sm" onClick={() => setEditingRule(rule)}>Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(rule)}>Delete</button>
                  </span>
                </td>
              </tr>
            ))}
            {!loading && rules.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                No rules for this client + rule type.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rule Editor modal */}
      {editingRule !== null && (
        <RuleEditor
          rule={editingRule === 'new' ? {} : editingRule}
          ruleTypes={ruleTypes}
          clients={clients}
          defaultClientId={selectedClientId}
          defaultRuleTypeId={activeRuleType?.id}
          onSave={handleSaved}
          onClose={() => setEditingRule(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/pages/RuleLibrary.test.tsx
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/src/pages/RuleLibrary.tsx frontend/src/pages/RuleLibrary.test.tsx \
        frontend/src/components/RuleEditor/RuleEditor.tsx
git commit -m "feat: add Rule Library page with client selector, tabs, and rules table"
```

---

### Task 6: Rule Editor Modal

**Files:**
- Modify: `frontend/src/components/RuleEditor/RuleEditor.tsx`
- Create: `frontend/src/components/DrlPreview.tsx`
- Create: `frontend/src/components/RuleEditor/RuleEditor.test.tsx`

- [ ] **Step 1: Write failing test `frontend/src/components/RuleEditor/RuleEditor.test.tsx`**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { RuleEditor } from './RuleEditor'
import * as api from '../../api/client'
import type { RuleType, Client } from '../../api/client'

vi.mock('../../api/client')

const ruleTypes: RuleType[] = [
  { id: 'rt1', slug: 'alert_classifier', name: 'Alert Classifier', pipeline_stage: 1,
    drl_package: 'com.example', drl_imports: '', drl_functions: null },
]
const clients: Client[] = [
  { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
]

beforeEach(() => {
  vi.mocked(api.createRule).mockResolvedValue({
    id: 'new1', client_id: 'c1', rule_type_id: 'rt1', name: 'TestRule',
    description: null, tool: null, condition_raw: 'cond', action_raw: 'act',
    condition_meta: null, action_meta: null, enabled: true, priority: null,
    window: null, created_at: '', updated_at: '',
  })
  vi.mocked(api.updateRule).mockResolvedValue({
    id: 'existing1', client_id: 'c1', rule_type_id: 'rt1', name: 'Updated',
    description: null, tool: null, condition_raw: 'cond', action_raw: 'act',
    condition_meta: null, action_meta: null, enabled: true, priority: null,
    window: null, created_at: '', updated_at: '',
  })
})

describe('RuleEditor', () => {
  it('renders the modal with form fields', () => {
    render(
      <RuleEditor
        rule={{}}
        ruleTypes={ruleTypes}
        clients={clients}
        defaultClientId="c1"
        defaultRuleTypeId="rt1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/rule name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/condition/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/action/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(
      <RuleEditor rule={{}} ruleTypes={ruleTypes} clients={clients}
        onSave={vi.fn()} onClose={onClose} />
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls createRule and onSave when saving a new rule', async () => {
    const onSave = vi.fn()
    render(
      <RuleEditor
        rule={{}}
        ruleTypes={ruleTypes}
        clients={clients}
        defaultClientId="c1"
        defaultRuleTypeId="rt1"
        onSave={onSave}
        onClose={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/rule name/i), { target: { value: 'TestRule' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(api.createRule).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/components/RuleEditor/RuleEditor.test.tsx
```

Expected: FAIL (stub doesn't have form fields)

- [ ] **Step 3: Create `frontend/src/components/DrlPreview.tsx`**

```tsx
interface Props {
  ruleName: string
  conditionRaw: string
  actionRaw: string
  ruleTypeName?: string
}

export function DrlPreview({ ruleName, conditionRaw, actionRaw, ruleTypeName }: Props) {
  const preview = [
    `// ${ruleTypeName ?? 'rule type'}`,
    `rule "${ruleName || 'RuleName'}"`,
    '\twhen',
    ...(conditionRaw.trim() ? conditionRaw.split('\n').map(l => `\t\t${l}`) : ['\t\t// condition here']),
    '\tthen',
    ...(actionRaw.trim() ? actionRaw.split('\n').map(l => `\t\t${l}`) : ['\t\t// action here']),
    'end',
  ].join('\n')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <label style={{ marginBottom: 6 }}>Live DRL Preview</label>
      <pre style={{
        flex: 1,
        background: '#1e2d3d',
        color: '#c8d8e8',
        borderRadius: 8,
        padding: 14,
        margin: 0,
        fontSize: 12,
        lineHeight: 1.6,
        overflow: 'auto',
        fontFamily: 'Consolas, monospace',
        whiteSpace: 'pre',
      }}>
        {preview}
      </pre>
    </div>
  )
}
```

- [ ] **Step 4: Implement `frontend/src/components/RuleEditor/RuleEditor.tsx`**

```tsx
import { useState } from 'react'
import { Rule, RuleType, Client, createRule, updateRule } from '../../api/client'
import { DrlPreview } from '../DrlPreview'

const TOOLS = ['', 'LogicMonitor', 'SCOM', 'Tivoli', 'Dynatrace', 'Solarwinds', 'Datadog', 'Any']
const PRIORITIES = ['', 'P1', 'P2', 'P3', 'P4']

interface Props {
  rule: Partial<Rule>
  ruleTypes: RuleType[]
  clients: Client[]
  defaultClientId?: string
  defaultRuleTypeId?: string
  onSave: (rule: Rule) => void
  onClose: () => void
}

export function RuleEditor({ rule, ruleTypes, clients, defaultClientId, defaultRuleTypeId, onSave, onClose }: Props) {
  const isNew = !rule.id

  const [form, setForm] = useState({
    client_id: rule.client_id ?? defaultClientId ?? '',
    rule_type_id: rule.rule_type_id ?? defaultRuleTypeId ?? '',
    name: rule.name ?? '',
    description: rule.description ?? '',
    tool: rule.tool ?? '',
    condition_raw: rule.condition_raw ?? '',
    action_raw: rule.action_raw ?? '',
    enabled: rule.enabled ?? true,
    priority: rule.priority ?? '',
    window: rule.window?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const activeRuleType = ruleTypes.find(rt => rt.id === form.rule_type_id)

  async function handleSave() {
    if (!form.name.trim()) { setError('Rule name is required'); return }
    if (!form.client_id) { setError('Client is required'); return }
    if (!form.rule_type_id) { setError('Rule type is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        client_id: form.client_id,
        rule_type_id: form.rule_type_id,
        name: form.name.trim(),
        description: form.description || null,
        tool: form.tool || null,
        condition_raw: form.condition_raw || null,
        action_raw: form.action_raw || null,
        condition_meta: null,
        action_meta: null,
        enabled: form.enabled,
        priority: form.priority || null,
        window: form.window ? parseInt(form.window) : null,
      }
      const saved = isNew
        ? await createRule(payload)
        : await updateRule(rule.id!, payload)
      onSave(saved)
    } catch {
      setError('Save failed — check the form and try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 1000 }} onClick={e => e.stopPropagation()}>
        <h2>{isNew ? 'New Rule' : `Edit: ${rule.name}`}</h2>
        {error && <p className="error-msg">{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: form fields */}
          <div>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-row">
                <label htmlFor="re-client">Client</label>
                <select id="re-client" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                  <option value="">— select —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="re-ruletype">Rule Type</label>
                <select id="re-ruletype" value={form.rule_type_id} onChange={e => set('rule_type_id', e.target.value)}>
                  <option value="">— select —</option>
                  {ruleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="re-name">Rule Name</label>
              <input id="re-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. LogicMonitorNoiseSuppression_8" />
            </div>

            <div className="form-row">
              <label htmlFor="re-desc">Description</label>
              <input id="re-desc" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional plain English description" />
            </div>

            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-row">
                <label htmlFor="re-tool">Tool</label>
                <select id="re-tool" value={form.tool} onChange={e => set('tool', e.target.value)}>
                  {TOOLS.map(t => <option key={t} value={t}>{t || 'Any / unset'}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="re-priority">Priority</label>
                <select id="re-priority" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p || '— none —'}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="re-enabled" checked={form.enabled}
                onChange={e => set('enabled', e.target.checked)} style={{ width: 'auto' }} />
              <label htmlFor="re-enabled" style={{ margin: 0 }}>Enabled</label>
            </div>

            <div className="form-row">
              <label htmlFor="re-condition">Condition (when)</label>
              <textarea id="re-condition" rows={6} value={form.condition_raw}
                onChange={e => set('condition_raw', e.target.value)}
                placeholder={'alert:IPPAlert(sourceId == "LogicMonitor")'} />
            </div>

            <div className="form-row">
              <label htmlFor="re-action">Action (then)</label>
              <textarea id="re-action" rows={5} value={form.action_raw}
                onChange={e => set('action_raw', e.target.value)}
                placeholder={'alert.setServiceName("event_mgmt_sw_1");'} />
            </div>
          </div>

          {/* Right: DRL preview */}
          <DrlPreview
            ruleName={form.name}
            conditionRaw={form.condition_raw}
            actionRaw={form.action_raw}
            ruleTypeName={activeRuleType?.name}
          />
        </div>

        <div className="form-actions">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/components/RuleEditor/RuleEditor.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/src/components/
git commit -m "feat: add Rule Editor modal with condition/action fields and live DRL preview"
```

---

### Task 7: Deployments Page

**Files:**
- Modify: `frontend/src/pages/Deployments.tsx`
- Create: `frontend/src/pages/Deployments.test.tsx`

- [ ] **Step 1: Write failing test `frontend/src/pages/Deployments.test.tsx`**

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Deployments } from './Deployments'
import * as api from '../api/client'

vi.mock('../api/client')

const mockClient = { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' }
const mockDeployments = [
  { id: 'd1', client_id: 'c1', version: 'v1.0', status: 'draft' as const, notes: 'First', created_at: '2024-01-01T10:00:00Z' },
]

beforeEach(() => {
  vi.mocked(api.getClients).mockResolvedValue([mockClient])
  vi.mocked(api.getDeployments).mockResolvedValue(mockDeployments)
  vi.mocked(api.createDeployment).mockResolvedValue({
    id: 'd2', client_id: 'c1', version: 'v2.0', status: 'draft', notes: null, created_at: ''
  })
  vi.mocked(api.exportDeployment).mockResolvedValue(new Response(new Blob(['zip']), { status: 200 }))
})

function renderWithRoute(clientId = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/clients/${clientId}/deployments`]}>
      <Routes>
        <Route path="/clients/:id/deployments" element={<Deployments />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Deployments page', () => {
  it('renders page heading', async () => {
    renderWithRoute()
    await waitFor(() => expect(screen.getByText(/deployments/i)).toBeInTheDocument())
  })

  it('lists existing deployments', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('v1.0'))
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('opens new deployment form on button click', async () => {
    renderWithRoute()
    await waitFor(() => screen.getByText('v1.0'))
    fireEvent.click(screen.getByRole('button', { name: /new deployment/i }))
    expect(screen.getByLabelText(/version/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/pages/Deployments.test.tsx
```

Expected: FAIL (stub)

- [ ] **Step 3: Implement `frontend/src/pages/Deployments.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Client, Deployment, getClients, getDeployments, createDeployment, exportDeployment } from '../api/client'

export function Deployments() {
  const { id: clientId } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ version: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clientId) return
    Promise.all([
      getClients().then(cs => cs.find(c => c.id === clientId) ?? null),
      getDeployments(clientId),
    ]).then(([c, deps]) => {
      setClient(c)
      setDeployments(deps)
    }).finally(() => setLoading(false))
  }, [clientId])

  async function handleCreate() {
    if (!form.version.trim()) { setError('Version is required'); return }
    setSaving(true); setError('')
    try {
      const dep = await createDeployment({ client_id: clientId!, version: form.version, notes: form.notes || undefined })
      setDeployments(prev => [dep, ...prev])
      setShowForm(false)
      setForm({ version: '', notes: '' })
    } catch { setError('Failed to create deployment') }
    finally { setSaving(false) }
  }

  async function handleDownload(dep: Deployment) {
    const res = await exportDeployment(dep.id)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deployment_${dep.version}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 6px' }}>
        <div>
          <Link to="/clients" style={{ color: 'var(--accent)', fontSize: 13 }}>← Clients</Link>
          <h2 style={{ margin: '4px 0 0' }}>
            Deployments {client ? `— ${client.name}` : ''}
          </h2>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Deployment</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px' }}>Create Deployment</h3>
          {error && <p className="error-msg">{error}</p>}
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="dep-version">Version</label>
              <input id="dep-version" placeholder="e.g. v1.2" value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
            </div>
            <div className="form-row">
              <label htmlFor="dep-notes">Release Notes</label>
              <input id="dep-notes" placeholder="Optional" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create & Snapshot Rules'}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Version</th><th>Status</th><th>Notes</th><th>Created</th><th>Export</th></tr>
          </thead>
          <tbody>
            {deployments.map(dep => (
              <tr key={dep.id}>
                <td><strong>{dep.version}</strong></td>
                <td><span className={`badge ${dep.status === 'deployed' ? 'badge-ok' : 'badge-muted'}`}>{dep.status}</span></td>
                <td className="muted">{dep.notes ?? '—'}</td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(dep.created_at).toLocaleString()}</td>
                <td>
                  <button className="btn-outline btn-sm" onClick={() => handleDownload(dep)}>
                    ↓ ZIP
                  </button>
                </td>
              </tr>
            ))}
            {!loading && deployments.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                No deployments yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/pages/Deployments.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/src/pages/Deployments.tsx frontend/src/pages/Deployments.test.tsx
git commit -m "feat: add Deployments page with create and ZIP download"
```

---

### Task 8: Import DRL Page

**Files:**
- Modify: `frontend/src/pages/ImportDrl.tsx`
- Create: `frontend/src/pages/ImportDrl.test.tsx`

- [ ] **Step 1: Write failing test `frontend/src/pages/ImportDrl.test.tsx`**

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ImportDrl } from './ImportDrl'
import * as api from '../api/client'

vi.mock('../api/client')

const mockRuleTypes = [
  { id: 'rt1', slug: 'alert_classifier', name: 'Alert Classifier', pipeline_stage: 1,
    drl_package: '', drl_imports: '', drl_functions: null },
]
const mockClients = [
  { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
]
const mockPreview = {
  filename: 'test.drl',
  package: 'com.example',
  rule_count: 2,
  rules: [
    { name: 'Rule_1', condition_raw: 'cond1', action_raw: 'act1' },
    { name: 'Rule_2', condition_raw: 'cond2', action_raw: 'act2' },
  ],
}

beforeEach(() => {
  vi.mocked(api.getRuleTypes).mockResolvedValue(mockRuleTypes)
  vi.mocked(api.getClients).mockResolvedValue(mockClients)
  vi.mocked(api.parseDrlFile).mockResolvedValue(mockPreview)
  vi.mocked(api.confirmImport).mockResolvedValue({ imported: 2, rule_ids: ['r1', 'r2'] })
})

describe('ImportDrl page', () => {
  it('renders page heading', () => {
    render(<MemoryRouter><ImportDrl /></MemoryRouter>)
    expect(screen.getByText('Import DRL')).toBeInTheDocument()
  })

  it('shows file upload area', () => {
    render(<MemoryRouter><ImportDrl /></MemoryRouter>)
    expect(screen.getByText(/drop a .drl file/i)).toBeInTheDocument()
  })

  it('shows preview table after file upload', async () => {
    render(<MemoryRouter><ImportDrl /></MemoryRouter>)
    await waitFor(() => screen.getByText('Infosys'))

    const file = new File(['package com.test;'], 'test.drl', { type: 'text/plain' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => screen.getByText('Rule_1'))
    expect(screen.getByText('Rule_2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx vitest run src/pages/ImportDrl.test.tsx
```

Expected: FAIL (stub)

- [ ] **Step 3: Implement `frontend/src/pages/ImportDrl.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Client, RuleType, ParsedFilePreview, getClients, getRuleTypes, parseDrlFile, confirmImport } from '../api/client'

export function ImportDrl() {
  const [clients, setClients] = useState<Client[]>([])
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [preview, setPreview] = useState<ParsedFilePreview | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedRuleTypeId, setSelectedRuleTypeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getClients(), getRuleTypes()]).then(([cs, rts]) => {
      setClients(cs)
      setRuleTypes(rts)
      if (cs.length > 0) setSelectedClientId(cs[0].id)
      if (rts.length > 0) setSelectedRuleTypeId(rts[0].id)
    })
  }, [])

  async function handleFile(file: File) {
    if (!file.name.endsWith('.drl')) { setError('Only .drl files are accepted'); return }
    setError(''); setSuccess(''); setLoading(true)
    try {
      const p = await parseDrlFile(file)
      setPreview(p)
    } catch { setError('Failed to parse file — make sure it is a valid .drl file') }
    finally { setLoading(false) }
  }

  async function handleConfirm() {
    if (!preview || !selectedClientId || !selectedRuleTypeId) return
    setLoading(true); setError('')
    try {
      const rules = preview.rules.map(r => ({
        client_id: selectedClientId,
        rule_type_id: selectedRuleTypeId,
        name: r.name,
        condition_raw: r.condition_raw,
        action_raw: r.action_raw,
      }))
      const result = await confirmImport(rules)
      setSuccess(`✓ ${result.imported} rule${result.imported !== 1 ? 's' : ''} imported successfully`)
      setPreview(null)
    } catch { setError('Import failed') }
    finally { setLoading(false) }
  }

  return (
    <>
      <div style={{ margin: '20px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Import DRL</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Upload a .drl file to extract rules and add them to a client's rule library.
        </p>
      </div>

      {/* Assignment selectors */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Assign imported rules to:</p>
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="imp-client">Client</label>
            <select id="imp-client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="imp-ruletype">Rule Type</label>
            <select id="imp-ruletype" value={selectedRuleTypeId} onChange={e => setSelectedRuleTypeId(e.target.value)}>
              {ruleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.pipeline_stage}. {rt.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 10,
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#f0f6ff' : '#fafcff',
          marginBottom: 16,
          transition: 'all 0.15s',
        }}
      >
        <p style={{ margin: 0, fontSize: 16, color: 'var(--muted)' }}>
          Drop a .drl file here or <strong style={{ color: 'var(--accent)' }}>click to browse</strong>
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }} className="muted">
          One file at a time. The file will be parsed and previewed before importing.
        </p>
        <input ref={fileRef} type="file" accept=".drl" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      {error && <p className="error-msg">{error}</p>}
      {success && <p style={{ color: 'var(--ok)', fontWeight: 600 }}>{success}</p>}
      {loading && <p className="muted">Processing…</p>}

      {/* Preview table */}
      {preview && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{preview.filename}</strong>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
                {preview.rule_count} rule{preview.rule_count !== 1 ? 's' : ''} · package: {preview.package}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline btn-sm" onClick={() => setPreview(null)}>Clear</button>
              <button className="btn-primary btn-sm" onClick={handleConfirm} disabled={loading}>
                Confirm Import
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Rule Name</th><th>Condition (when)</th><th>Action (then)</th></tr>
            </thead>
            <tbody>
              {preview.rules.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{i + 1}</td>
                  <td><strong>{r.name}</strong></td>
                  <td><code style={{ fontSize: 12 }}>{r.condition_raw.slice(0, 80)}{r.condition_raw.length > 80 ? '…' : ''}</code></td>
                  <td><code style={{ fontSize: 12 }}>{r.action_raw.slice(0, 60)}{r.action_raw.length > 60 ? '…' : ''}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/pages/ImportDrl.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 5: Run all frontend tests**

```bash
cd frontend && npx vitest run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
cd D:/GenAI/rules-generator
git add frontend/src/pages/ImportDrl.tsx frontend/src/pages/ImportDrl.test.tsx
git commit -m "feat: add Import DRL page with file upload, preview, and confirm"
```

---

### Task 9: Production Build Integration

**Files:**
- Modify: `backend/main.py` — serve built frontend as static files
- Modify: `frontend/vite.config.ts` — set build output path

- [ ] **Step 1: Update `backend/main.py` to serve static files**

Add at the bottom of `backend/main.py`, after all route definitions:

```python
import os
from fastapi.staticfiles import StaticFiles

# Serve compiled React frontend in production
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
```

The full `backend/main.py` becomes:

```python
from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base
from seed_data import seed_rule_types
from database import AsyncSessionLocal
from routers import clients, rule_types, rules, deployments, import_drl


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_rule_types(session)
        await session.commit()
    yield


app = FastAPI(title="Polycloud Rules Manager", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix="/api")
app.include_router(rule_types.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(deployments.router, prefix="/api")
app.include_router(import_drl.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve compiled React frontend in production
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
```

- [ ] **Step 2: Run backend tests — verify nothing broke**

```bash
cd D:/GenAI/rules-generator
source backend/venv/Scripts/activate
cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -5
```

Expected: `54 passed`

- [ ] **Step 3: Build the frontend**

```bash
cd D:/GenAI/rules-generator/frontend && npm run build
```

Expected: `frontend/dist/` created, `✓ built in Xs`

- [ ] **Step 4: Test production mode — backend serves frontend**

```bash
cd D:/GenAI/rules-generator
source backend/venv/Scripts/activate
cd backend
uvicorn main:app --port 8000 &
sleep 3
curl -s http://localhost:8000/ | grep -i "polycloud\|vite\|react"
curl -s http://localhost:8000/api/health
kill %1
```

Expected: HTML response containing React app content, and `{"status":"ok"}` from health endpoint.

- [ ] **Step 5: Run all frontend tests one final time**

```bash
cd D:/GenAI/rules-generator/frontend && npx vitest run
```

Expected: all tests PASS

- [ ] **Step 6: Commit everything**

```bash
cd D:/GenAI/rules-generator
git add backend/main.py frontend/dist/ frontend/
git commit -m "feat: integrate production build — backend serves React frontend as static files"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| React + Vite (TypeScript) | Task 1 |
| Typed API client (fetch) | Task 2 |
| Rule Library `/` — client selector, rule-type tabs, rules table, add/edit/delete | Task 5 + Task 6 |
| Rule Editor modal — condition/action builder + live DRL preview | Task 6 |
| Clients `/clients` — list, create, edit | Task 4 |
| Deployments `/clients/:id/deployments` — history, create, download ZIP | Task 7 |
| Import DRL `/import` — upload, preview, confirm | Task 8 |
| `src/api/client.ts` typed API client | Task 2 |
| `components/RuleEditor/` condition/action builder | Task 6 |
| `components/DrlPreview.tsx` | Task 6 |
| `components/layout/` top nav | Task 3 |
| Production: FastAPI serves built frontend | Task 9 |
| `start.bat` / `start.sh` activate venv + start backend | Already done in backend plan |

All spec requirements are covered.

### Placeholder scan

No TBDs, TODOs, or "implement later" in this plan. Every step has complete code.

### Type consistency

- `Client`, `Rule`, `RuleType`, `Deployment` defined once in `src/api/client.ts` (Task 2) and imported everywhere — no redefinitions.
- `RuleEditor` props interface uses `Partial<Rule>` (Task 6), consistent with how `RuleLibrary` passes `editingRule` (Task 5).
- `ParsedFilePreview.rules` is `ParsedRulePreview[]` in client.ts — `ImportDrl.tsx` maps it correctly.
- `exportDeployment` returns `Promise<Response>` — `Deployments.tsx` calls `.blob()` on it, which is correct.
