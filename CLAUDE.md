# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules
Never mention claude as co-founder in any git commits.

## Project Overview

**Polycloud Rules Manager** - a full-stack app for managing Drools Rule Language (DRL) business rules across multiple clients. Rules are authored in the UI, stored in PostgreSQL, and exported as `.drl` files (individually or as a ZIP bundle per deployment). The app also manages Knowledge Base documents and Cron Job scripts per client.

## Running the App

**Start both services (recommended):**
```bash
# Linux/Mac/Git Bash
./start.sh

# Windows CMD
start.bat
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- Default login: `admin` / `admin`

**Run services individually:**
```bash
# Backend (from backend/)
.\venv\Scripts\activate     # Windows PowerShell
# or: source venv/Scripts/activate
# or: source venv/bin/activate on Linux/Mac
uvicorn main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev
```

**Backend setup (first time):**
```bash
cd backend
py -3.14 -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
# Requires PostgreSQL running with DB: polycloud_rm (see DATABASE_URL below)
```

Backend dependencies are verified to install and tests pass on Python `3.14` on Windows.

## Environment Variables

Backend reads from a `.env` file in `backend/`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost/polycloud_rm
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost/test_polycloud_rm
UPLOADS_DIR=./uploads   # optional; defaults to ./uploads relative to backend/
```

## Testing

```bash
# All backend tests (from backend/)
pytest

# Single test file
pytest tests/test_rules.py

# Single test by name
pytest tests/test_rules.py::test_create_rule
```

Frontend tests:
```bash
cd frontend
npm test          # vitest run (non-watch)
```

## Frontend Commands

```bash
cd frontend
npm run build     # TypeScript check + Vite build to dist/
npm run lint      # ESLint
npm run preview   # Serve the production build locally
```

## Architecture

### Backend (`backend/`)

FastAPI + SQLAlchemy async + PostgreSQL (asyncpg). Schema is auto-created on startup via `Base.metadata.create_all`. Seed data (rule types, admin user) is also applied at startup.

**Key files:**
- `main.py` - app factory, CORS, router registration, optional static file serving of compiled frontend
- `models.py` - all ORM models
- `schemas.py` - Pydantic request/response models
- `database.py` - async engine setup, `DATABASE_URL` from env
- `auth_deps.py` - `get_current_user`, `require_admin`, `check_client_access` FastAPI dependencies
- `seed_data.py` - idempotent seed for rule types, DRL functions/imports, and admin user
- `security.py` - Argon2 password hashing and verification helpers
- `storage.py` - file storage utility; resolves per-client `knowledge/` and `cron_jobs/` upload directories from `UPLOADS_DIR` env var

**Routers** (`routers/`): `auth`, `clients`, `rules`, `rule_types`, `deployments`, `import_drl`, `admin`, `functions`, `knowledge_base`, `cron_jobs`

**Services** (`services/`):
- `drl_generator.py` - renders `.drl` text from rule+rule_type dicts (including per-rule functions/imports); builds ZIP bundles
- `drl_parser.py` - parses uploaded `.drl` files back into structured rule data with per-rule function/import heuristics

**Backend auth notes:**
- Passwords are hashed with Argon2 via `backend/security.py`.
- There is no bcrypt/passlib migration path in the current app because existing production users are not being preserved.

**File uploads:**
- Uploaded Knowledge Base documents land in `uploads/knowledge/<client_id>/`
- Uploaded Cron Job scripts land in `uploads/cron_jobs/<client_id>/`
- `storage.py` creates these directories on demand and is monkeypatchable via `UPLOADS_DIR` in tests

### Frontend (`frontend/`)

React 18 + TypeScript + Vite. Routing via react-router-dom v7. No external UI component library - all styling is custom CSS via the `theme.css` design system.

**Design system:**
- `src/theme.css` - CSS custom-property design tokens (colors, spacing, typography, dark mode)
- `src/components/Icon.tsx` - SVG icon wrapper
- `src/components/Skeleton.tsx` - loading placeholder
- `src/components/EmptyState.tsx` - zero-item placeholder
- `src/components/Toast.tsx` - ephemeral notification
- `src/components/Switch.tsx` - accessible toggle switch
- `src/components/DrlPreview.tsx` - DRL syntax highlighter with line numbers and copy button
- `src/components/CommandPalette/` - ⌘K global command palette (cmdk library)
- `src/components/FunctionsPanel/` - panel for managing per-rule-type DRL functions and imports

**Key structure:**
- `src/context/AuthContext.tsx` - global auth state (token, username, role); persisted to `localStorage`; exposes `login`, `logout`, `hasAdminRole`
- `src/context/ClientContext.tsx` - active client + rule-type sub-nav state; drives sidebar client switcher
- `src/api/client.ts` - all API calls; reads token from `localStorage` and attaches `Authorization: Bearer <token>` header
- `src/api/auth.ts` - login/register calls
- `src/components/ProtectedRoute.tsx` - redirects unauthenticated users to `/login`; `adminOnly` prop gates admin routes
- `src/components/layout/Sidebar.tsx` - collapsible sidebar with client switcher, rule-type sub-nav, and main nav links

**Pages** (`src/pages/`):

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Overview.tsx` | Dashboard with stats and recent activity |
| `/rules/:slug` | `RuleLibrary.tsx` | Rule list with inline toggle, bulk delete, pagination |
| `/rules/:slug/new` | `RuleEditorPage/` | Full-page rule editor with condition builder |
| `/rules/:slug/edit/:id` | `RuleEditorPage/` | Edit existing rule; unsaved-changes guard |
| `/clients` | `Clients.tsx` | Client management |
| `/deployments` | `Deployments.tsx` | Global deployments view |
| `/clients/:id/deployments` | `Deployments.tsx` | Per-client deployments |
| `/import` | `ImportDrl.tsx` | DRL file import with per-rule selection and duplicate warnings |
| `/knowledge/:category` | `KnowledgeBase.tsx` | Upload/download/delete KB documents per client |
| `/cron-jobs` | `CronJobs.tsx` | Upload/download/delete cron job scripts per client |
| `/admin` | `AdminPage.tsx` | Users tab + Access Matrix tab (admin only) |
| `/account` | `AccountPage.tsx` | User account settings and password change |
| `/login` | `LoginPage.tsx` | Auth |
| `/register` | `RegisterPage.tsx` | Registration |

### Data model

```text
Client --< Rule >-- RuleType
Client --< Deployment --< DeploymentRuleSnapshot
Client --< KnowledgeDocument
Client --< CronJob
RuleType --< DrlFunction
RuleType --< DrlImport
User --< Token
User --< UserClientAccess >-- Client
```

- **RuleType** defines the DRL package, imports, and optional shared functions. Seeded from `seed_data.py`; not user-editable. The 6 seeded types are: `alert_classifier`, `noise_suppression`, `issue_correlation`, `incident_rules`, `recommendation`, `email_ingestion`.
- **DrlFunction / DrlImport** - per-rule-type reusable DRL functions and import statements; managed via `/admin` Functions Panel.
- **Rule** stores raw DRL condition/action text plus structured metadata (`condition_meta`, `action_meta` JSONB).
- **Deployment** snapshots the rules at publish time; `DeploymentRuleSnapshot` stores both the frozen rule JSON and the rendered `drl_block`.
- **KnowledgeDocument** - metadata record for a file uploaded to `uploads/knowledge/<client_id>/`.
- **CronJob** - metadata record for a script uploaded to `uploads/cron_jobs/<client_id>/`.
- **Auth** uses opaque bearer tokens (stored in `tokens` table). Roles: `admin` (full access) or `contributor` (read-only unless granted per-client access via `UserClientAccess`).

### Production build

`npm run build` in `frontend/` outputs to `frontend/dist/`. The backend serves this directory as a static mount at `/` when the `dist/` folder is present.

### Deployment ZIP

The deployment ZIP (`polycloud_rules_manager_deploy.zip`) bundles the compiled frontend (`frontend/dist/`) with the backend source. To rebuild it after a frontend change:

```bash
# 1. Build the frontend
cd frontend && npm run build && cd ..

# 2. Recreate the ZIP (from repo root)
powershell -Command "
  Remove-Item -Force polycloud_rules_manager_deploy.zip -ErrorAction SilentlyContinue;
  Compress-Archive -Path backend, frontend/dist -DestinationPath polycloud_rules_manager_deploy.zip
"
```
