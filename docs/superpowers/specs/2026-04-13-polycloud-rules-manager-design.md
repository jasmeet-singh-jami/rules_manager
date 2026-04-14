# Polycloud Rules Manager — Design Spec

**Date:** 2026-04-13  
**Status:** Approved  

---

## Overview

Polycloud Rules Manager is a full-stack web application for managing Drools (DRL) rules used in the Polycloud observability platform. Implementation teams currently create rules from scratch for each client deployment. This application provides a centralized repository where rules created for any client can be stored, searched, copied, adapted, and exported as deployment-ready DRL bundles.

---

## Background: Polycloud Alert Pipeline

Rules in this system map to five sequential stages of the Polycloud alert processing pipeline:

| Stage | Pipeline Step | Rule Type | DRL File |
|-------|--------------|-----------|----------|
| 1 | Alerts received from monitoring tools | Alert Classifier | `alert_classifier.drl` |
| 2 | Alerts grouped by similarity (noise removed) | Noise Suppression | `noise_suppression.drl` |
| 3 | Grouped alerts correlated into issues | Issue Correlation | `issue_correlation.drl` |
| 4 | Actionable issues converted to ServiceNow tickets | Incident Creation | `incident_rules.drl` |
| 5 | Recommendations triggered via labels on issues | Recommendation | `recommendation.drl` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (TypeScript) |
| Backend | Python 3.11+ / FastAPI |
| ORM | SQLAlchemy 2.x (async) |
| Validation | Pydantic v2 |
| Database | PostgreSQL 15+ |
| Dev server | Uvicorn (backend), Vite dev server (frontend) |
| Deployment | Native processes — `start.sh` (Linux) / `start.bat` (Windows) |

No Docker. PostgreSQL runs as a locally installed service. Backend and frontend start via convenience scripts.

---

## Architecture

```
Browser
  └── React SPA (port 5173 in dev, served by FastAPI in prod)
        └── FastAPI REST API (port 8000)
              └── PostgreSQL (local service)
```

In production (internal server), FastAPI serves the compiled React build as static files on port 8000. No separate frontend server needed.

### Backend modules

- **routers/** — REST endpoints: `clients.py`, `rules.py`, `deployments.py`, `import_drl.py`
- **services/drl_parser.py** — Parses `.drl` files into structured rule records
- **services/drl_generator.py** — Reconstructs valid `.drl` files from stored rules
- **models.py** — SQLAlchemy ORM models
- **schemas.py** — Pydantic request/response schemas
- **seed_data.py** — Seeds `rule_types` table at startup

---

## Data Model

### `clients`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| code | VARCHAR(20) UNIQUE | e.g. "INFY" |
| name | VARCHAR(100) | Display name |
| description | TEXT | |
| created_at | TIMESTAMPTZ | |

### `rule_types`
Seeded at startup — not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | VARCHAR(50) UNIQUE | e.g. `noise_suppression` |
| name | VARCHAR(100) | e.g. "Noise Suppression" |
| pipeline_stage | INT | 1–5 |
| drl_package | VARCHAR(200) | Java package declaration |
| drl_imports | TEXT | Import block for generated DRL |
| drl_functions | TEXT | Helper functions block for generated DRL |

### `rules`
Core table. Stores both raw DRL text (for imported rules) and structured JSONB (for builder-created rules).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| client_id | UUID FK → clients | |
| rule_type_id | UUID FK → rule_types | |
| name | VARCHAR(150) | Auto-generated or user-defined |
| description | TEXT | Plain English description |
| tool | VARCHAR(50) | LogicMonitor, SCOM, Tivoli, Dynatrace, Solarwinds, Datadog, Any |
| condition_raw | TEXT | Raw DRL `when` block (populated on import; editable) |
| action_raw | TEXT | Raw DRL `then` block (populated on import; editable) |
| condition_meta | JSONB | Structured builder rows (populated when created via UI builder) |
| action_meta | JSONB | Structured builder rows (populated when created via UI builder) |
| enabled | BOOLEAN | Default true |
| priority | VARCHAR(10) | P1/P2/P3/P4 |
| window | INT | Minutes |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Key design note:** `condition_raw`/`action_raw` and `condition_meta`/`action_meta` are complementary. Imported rules have raw only. Rules created via the builder have both. DRL generation always uses raw (builder syncs raw from meta on save).

### `deployments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| client_id | UUID FK → clients | |
| version | VARCHAR(20) | e.g. "v1.2" |
| status | ENUM | `draft` \| `deployed` |
| notes | TEXT | Release notes |
| created_at | TIMESTAMPTZ | |

### `deployment_rule_snapshots`
Freezes rule state at deployment time. Editing a rule later does not affect past deployments.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| deployment_id | UUID FK → deployments | |
| rule_id | UUID FK → rules | |
| rule_snapshot | JSONB | Full rule record at deploy time |
| drl_block | TEXT | Pre-rendered DRL `rule "..." when ... then ... end` block |

---

## Key Workflows

### 1. Import Existing DRL Files
1. User uploads one or more `.drl` files via the UI, assigns them to a client
2. `POST /api/import/parse` — DRL parser extracts: package, imports, functions, individual rule blocks (name / when / then)
3. UI shows a preview table of parsed rules; user confirms rule type mapping
4. `POST /api/import/confirm` — Rules inserted into DB with `condition_raw`/`action_raw` populated

### 2. Browse Library & Copy Rules to Another Client
1. User searches/filters rules across all clients by rule type, tool, keyword, or source client (`GET /api/rules`)
2. Click a rule to see full DRL, description, and which clients use it
3. "Copy to Client" duplicates the rule into target client (`POST /api/rules/{id}/copy`), auto-renaming it
4. Open copied rule in editor to adapt conditions/actions for the new client

### 3. Create Deployment & Export DRL Bundle
1. User creates a deployment for a client with a version tag and release notes (`POST /api/deployments`)
2. All enabled rules for that client are snapshotted into `deployment_rule_snapshots`
3. `GET /api/deployments/{id}/export` — DRL Generator builds one `.drl` per rule type from snapshots
4. Returns a `.zip` containing: `alert_classifier.drl`, `noise_suppression.drl`, `issue_correlation.drl`, `incident_rules.drl`, `recommendation.drl`

---

## REST API Surface

```
# Clients
GET    /api/clients
POST   /api/clients
GET    /api/clients/{id}
PUT    /api/clients/{id}
DELETE /api/clients/{id}

# Rules
GET    /api/rules                     # ?search=&tool=&rule_type=&client_id=
POST   /api/rules
GET    /api/rules/{id}
PUT    /api/rules/{id}
DELETE /api/rules/{id}
POST   /api/rules/{id}/copy           # body: { target_client_id }

# Rule Types (read-only)
GET    /api/rule-types

# Deployments
GET    /api/clients/{id}/deployments
POST   /api/deployments
GET    /api/deployments/{id}
GET    /api/deployments/{id}/export   # returns .zip

# DRL Import
POST   /api/import/parse              # multipart file upload → parsed preview
POST   /api/import/confirm            # save parsed rules to DB
```

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Rule Library | `/` | Main view — top nav, client selector, rule-type tabs, rules table, add/edit/delete |
| Rule Editor | modal | Condition/action builder + live DRL preview (replaces `rules_manager.html`) |
| Clients | `/clients` | List, create, edit clients |
| Deployments | `/clients/:id/deployments` | Deployment history, create new, download ZIP |
| Import DRL | `/import` | Upload `.drl` files, preview parsed rules, confirm import |

---

## Project Structure

```
rules-manager/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── seed_data.py
│   ├── routers/
│   │   ├── clients.py
│   │   ├── rules.py
│   │   ├── deployments.py
│   │   └── import_drl.py
│   ├── services/
│   │   ├── drl_parser.py
│   │   └── drl_generator.py
│   ├── .env                  ← DATABASE_URL
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── RuleLibrary.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── Deployments.tsx
│   │   │   └── ImportDrl.tsx
│   │   ├── components/
│   │   │   ├── RuleEditor/        ← condition/action builder
│   │   │   ├── DrlPreview.tsx
│   │   │   └── layout/
│   │   └── api/
│   │       └── client.ts          ← typed API client (fetch)
│   ├── package.json
│   └── vite.config.ts
├── data/                     ← existing .drl sample files
├── docs/
├── start.sh                  ← starts backend + frontend (Linux/macOS)
└── start.bat                 ← starts backend + frontend (Windows)
```

---

## Deployment

### Local Development
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install
npm run dev   # serves on port 5173, proxies /api → :8000
```

### Internal Server (Production)
```bash
# Build frontend
cd frontend && npm run build

# Backend serves built frontend as static files
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
```
Access at `http://<server-ip>:8000`. One process, one port.

PostgreSQL must be installed and running as a system service on the host.

---

## Out of Scope (v1)

- User authentication / role-based access
- AI-assisted rule generation
- Direct Drools engine integration / rule testing
- Multi-environment promotion (dev → staging → prod)
