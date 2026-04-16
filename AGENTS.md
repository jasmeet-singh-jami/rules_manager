# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Polycloud Rules Manager** - a full-stack app for managing Drools Rule Language (DRL) business rules across multiple clients. Rules are authored in the UI, stored in PostgreSQL, and exported as `.drl` files (individually or as a ZIP bundle per deployment).

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
- `seed_data.py` - idempotent seed for rule types and admin user
- `security.py` - Argon2 password hashing and verification helpers

**Routers** (`routers/`): `auth`, `clients`, `rules`, `rule_types`, `deployments`, `import_drl`, `admin`

**Services** (`services/`):
- `drl_generator.py` - renders `.drl` text from rule+rule_type dicts; builds ZIP bundles
- `drl_parser.py` - parses uploaded `.drl` files back into structured rule data

**Backend auth notes:**
- Passwords are hashed with Argon2 via `backend/security.py`.
- There is no bcrypt/passlib migration path in the current app because existing production users are not being preserved.

### Frontend (`frontend/`)

React 18 + TypeScript + Vite. Routing via react-router-dom v7. No external UI component library - all styling is custom CSS.

**Key structure:**
- `src/context/AuthContext.tsx` - global auth state (token, username, role); persisted to `localStorage`; exposes `login`, `logout`, `hasAdminRole`
- `src/api/client.ts` - all API calls; reads token from `localStorage` and attaches `Authorization: Bearer <token>` header
- `src/api/auth.ts` - login/register calls
- `src/components/ProtectedRoute.tsx` - redirects unauthenticated users to `/login`; `adminOnly` prop gates admin routes
- `src/pages/` - one file per route: `RuleLibrary`, `Clients`, `Deployments`, `ImportDrl`, `AdminPage`, `LoginPage`, `RegisterPage`

### Data model

```text
Client --< Rule >-- RuleType
Client --< Deployment --< DeploymentRuleSnapshot
User --< Token
User --< UserClientAccess >-- Client
```

- **RuleType** defines the DRL package, imports, and optional shared functions. Seeded from `seed_data.py`; not user-editable.
- **Rule** stores raw DRL condition/action text plus structured metadata (`condition_meta`, `action_meta` JSONB).
- **Deployment** snapshots the rules at publish time; `DeploymentRuleSnapshot` stores both the frozen rule JSON and the rendered `drl_block`.
- **Auth** uses opaque bearer tokens (stored in `tokens` table). Roles: `admin` (full access) or `contributor` (read-only unless granted per-client access via `UserClientAccess`).

### Production build

`npm run build` in `frontend/` outputs to `frontend/dist/`. The backend serves this directory as a static mount at `/` when the `dist/` folder is present.
