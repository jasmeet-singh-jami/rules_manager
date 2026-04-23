# Knowledge Base & Cron Jobs — Design Spec

**Date:** 2026-04-23
**Branch:** ui-redesign-2026-04
**Features:** Items 9 and 10 from improvements.txt

---

## Overview

Two new sidebar sections added to Polycloud Rules Manager:

1. **Knowledge Base** — per-client document store (PDF, Word, PPT, TXT) organised into three fixed categories: Integrations, Automations, Issues.
2. **Cron Jobs** — per-client flat file store for cron scripts (shell, Python, JSON, etc.).

Both features store uploaded files on the local filesystem at a configurable path and record metadata in PostgreSQL. Downloads are browser-triggered (no in-app preview).

---

## Data Model

### `knowledge_documents` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `client_id` | UUID FK → clients | CASCADE delete |
| `category` | enum | `integrations`, `automations`, `issues` |
| `name` | VARCHAR(150) | user-facing title |
| `description` | TEXT | nullable |
| `filename` | VARCHAR(255) | original filename as uploaded |
| `file_path` | TEXT | absolute path on disk |
| `file_size` | INTEGER | bytes |
| `mime_type` | VARCHAR(100) | |
| `uploaded_by` | UUID FK → users | SET NULL on delete |
| `created_at` | TIMESTAMP WITH TZ | |

### `cron_jobs` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `client_id` | UUID FK → clients | CASCADE delete |
| `name` | VARCHAR(150) | |
| `description` | TEXT | nullable |
| `filename` | VARCHAR(255) | original filename as uploaded |
| `file_path` | TEXT | absolute path on disk |
| `file_size` | INTEGER | bytes |
| `mime_type` | VARCHAR(100) | |
| `uploaded_by` | UUID FK → users | SET NULL on delete |
| `created_at` | TIMESTAMP WITH TZ | |

### PostgreSQL enum

```sql
CREATE TYPE kb_category AS ENUM ('integrations', 'automations', 'issues');
```

---

## File Storage

- **Env var:** `UPLOADS_DIR` in `backend/.env` (same file as `DATABASE_URL`)
- **Default:** `./uploads` relative to the backend directory
- **Layout:**
  - `{UPLOADS_DIR}/knowledge/{client_id}/{uuid4}_{original_filename}`
  - `{UPLOADS_DIR}/cron_jobs/{client_id}/{uuid4}_{original_filename}`
- **Startup behaviour:** backend creates `UPLOADS_DIR` and both subdirectory trees if they don't exist (using `pathlib.Path.mkdir(parents=True, exist_ok=True)`)
- **File types:** unrestricted — any file the user uploads is accepted
- **On delete:** DB record and the file on disk are both removed

---

## Backend API

### Router: `/api/knowledge` (`routers/knowledge_base.py`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/knowledge` | authenticated | List docs; query params: `client_id`, `category` |
| POST | `/api/knowledge` | edit access for client | Upload a document; multipart: `client_id`, `category`, `name`, `description?`, `file` |
| GET | `/api/knowledge/{id}/download` | authenticated | Stream file as `FileResponse` with original filename |
| DELETE | `/api/knowledge/{id}` | edit access for client | Delete DB record and file from disk |

### Router: `/api/cron-jobs` (`routers/cron_jobs.py`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cron-jobs` | authenticated | List cron jobs; query param: `client_id` |
| POST | `/api/cron-jobs` | edit access for client | Upload; multipart: `client_id`, `name`, `description?`, `file` |
| GET | `/api/cron-jobs/{id}/download` | authenticated | Stream file as `FileResponse` |
| DELETE | `/api/cron-jobs/{id}` | edit access for client | Delete record and file |

### Implementation notes
- FastAPI `UploadFile` for ingestion; `aiofiles` for async disk write
- `FileResponse` from `fastapi.responses` for downloads
- `UPLOADS_DIR` read from env at startup via the existing `database.py` / `.env` pattern; use `python-dotenv` already in requirements
- Both routers registered in `main.py`

---

## Frontend

### Routing (`App.tsx`)

```
/knowledge                → redirect to /knowledge/integrations
/knowledge/:category      → KnowledgeBase page (category from URL param)
/cron-jobs                → CronJobs page
```

### Sidebar (`Sidebar.tsx`)

Added to `WORKSPACE` between Deployments and Clients:
```ts
{ to: '/knowledge', icon: 'folder', label: 'Knowledge Base' },
{ to: '/cron-jobs', icon: 'clock',  label: 'Cron Jobs' },
```

When on `/knowledge*`, a "Categories" sub-nav appears (same mechanism as Rule Types sub-nav):
- Integrations → `/knowledge/integrations`
- Automations  → `/knowledge/automations`
- Issues       → `/knowledge/issues`

Cron Jobs has no sub-nav.

### `KnowledgeBase.tsx`

- **Toolbar:** search (by name/filename), client filter dropdown (when no client selected globally)
- **Table columns:** Name, Category, Description, Filename, Size, Uploaded By, Date, Download button
- **Upload button** (edit-access only) → modal with: client picker, name field, description field, category select, file picker
- **Delete** (trash icon, edit-access only) with inline confirmation
- Category is driven by the `:category` URL param; page re-fetches when param changes

### `CronJobs.tsx`

- Same table + toolbar pattern as KnowledgeBase, minus category column/filter
- **Upload modal:** client picker, name, description, file picker
- Download + Delete actions identical to KnowledgeBase

### API layer additions (`api/client.ts`)

New interfaces: `KnowledgeDocument`, `CronJob`

New functions:
- `getKnowledgeDocs(filters)` — GET with query params
- `uploadKnowledgeDoc(formData)` — POST multipart, returns `KnowledgeDocument`
- `downloadKnowledgeDoc(id)` — returns raw `Response` (same pattern as `exportDeployment`)
- `deleteKnowledgeDoc(id)` — DELETE
- `getCronJobs(clientId?)` — GET
- `uploadCronJob(formData)` — POST multipart
- `downloadCronJob(id)` — raw `Response`
- `deleteCronJob(id)` — DELETE

Upload functions use `FormData` (not JSON body); the `request` helper is bypassed for multipart calls, mirroring how `parseDrlFile` works today.

---

## Access Control

| Action | Required permission |
|---|---|
| List / download | Admin: all clients. Contributor: only their assigned clients (same visibility as rules) |
| Upload | Edit access for that client (`check_client_access` dependency) |
| Delete | Edit access for that client |

Follows the same `auth_deps.py` pattern used by rules and deployments.

---

## Out of Scope

- In-app document preview (view in browser)
- Sub-categories for Cron Jobs
- File type restrictions / virus scanning
- Version history for uploaded files
- Search within document content
