# User Authentication & Authorization Design

**Date:** 2026-04-14  
**Project:** Polycloud Rules Manager  
**Status:** Approved

---

## Overview

Add user-based authentication and role-based access control to the Polycloud Rules Manager. Two roles exist: `admin` and `contributor`. Access to client data is governed by explicit user-client assignments, with read-only fallback to all other clients.

---

## Requirements Summary

- Any visitor can self-register a new contributor account
- A seeded `admin` / `admin` account is the initial admin
- Two roles: `admin` and `contributor`
- A user has **full edit access** to clients they are explicitly assigned to
- A user has **read-only access** (view + download DRL) to all other clients
- When a user creates a new client, they are automatically granted full edit access to it
- Admin can assign or revoke any user's access to any client
- Auth mechanism: bearer token stored in the database (no JWT, no cookies)

---

## Data Model

Three new tables added to `models.py`:

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| username | VARCHAR(50) UNIQUE NOT NULL | login identifier |
| password_hash | TEXT NOT NULL | bcrypt hash |
| role | ENUM('admin', 'contributor') NOT NULL | default: `contributor` |
| created_at | TIMESTAMP | auto |

### `tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| user_id | UUID FK → users.id | CASCADE DELETE |
| token | TEXT UNIQUE NOT NULL | random 32-byte hex string |
| created_at | TIMESTAMP | auto |

### `user_client_access`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| user_id | UUID FK → users.id | CASCADE DELETE |
| client_id | UUID FK → clients.id | CASCADE DELETE |
| UNIQUE(user_id, client_id) | | prevents duplicates |

---

## Backend API

### Auth router (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create contributor account, returns token |
| POST | `/api/auth/login` | Public | Validates credentials, returns token |
| POST | `/api/auth/logout` | Bearer token | Deletes token from DB |
| GET | `/api/auth/me` | Bearer token | Returns `{id, username, role}` |

### Admin router (`/api/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | Admin only | Lists all users with their assigned clients |
| POST | `/api/admin/users/{user_id}/clients/{client_id}` | Admin only | Grants user access to a client |
| DELETE | `/api/admin/users/{user_id}/clients/{client_id}` | Admin only | Revokes user access to a client |

### Shared dependency functions (`auth_deps.py`)

- **`get_current_user`** — reads `Authorization: Bearer <token>` header, looks up token in DB, returns `User` or raises 401
- **`require_admin`** — wraps `get_current_user`, asserts `user.role == 'admin'` or raises 403
- **`require_client_access(client_id)`** — asserts a row exists in `user_client_access` for `(current_user.id, client_id)` or raises 403

### Changes to existing routers

All existing routers (`clients`, `rules`, `deployments`, `import_drl`) get `current_user = Depends(get_current_user)` on every route.

Write operations (POST, PUT, PATCH, DELETE) on client-scoped resources additionally use `Depends(require_client_access)`:
- Creating a client is permitted for all authenticated users (contributor can create their own client)
- After creating a client, the backend inserts a row into `user_client_access` automatically
- Editing/deleting rules, creating deployments, importing DRL all require `require_client_access`

Read operations (GET) are permitted for all authenticated users regardless of client assignment.

### Seeded admin user

`seed_data.py` is extended to insert a `users` row with `username='admin'`, `role='admin'`, and a bcrypt hash of `'admin'` if the user doesn't already exist.

---

## Frontend

### New pages

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | `LoginPage` | Public |
| `/register` | `RegisterPage` | Public |
| `/admin` | `AdminPage` | Admin only |

### Auth context (`AuthContext`)

Wraps the entire app. Holds:
- `user: { id, username, role } | null`
- `token: string | null`
- `clientAccess: string[]` — list of client IDs the user has full edit access to (fetched from `/api/auth/me` extended response)
- `login(token, user)` — saves to `localStorage` and context
- `logout()` — calls `/api/auth/logout`, clears localStorage and context

Token is sent as `Authorization: Bearer <token>` on all API calls.

### Route protection

- `ProtectedRoute` wraps all existing routes — redirects to `/login` if no token present
- `/admin` additionally checks `role === 'admin'`, redirects to `/` if not admin

### UI behaviour

- Nav header shows **Admin** link only for admin users
- Rule Library, Deployments, Import DRL: write action buttons (save rule, create deployment, confirm import) are hidden when the user does not have access to that client
- The backend independently enforces these restrictions — the UI hiding is a UX convenience only

### Admin page (`/admin`)

- Lists all users (username, role)
- For each user, shows assigned clients with a revoke button
- Dropdown or searchable list to assign a new client to a user

---

## Security Notes

- Passwords are hashed with bcrypt before storage — plain-text `admin` is never stored
- Tokens are random 32-byte hex strings (not guessable)
- All write-path enforcement is server-side; frontend hiding is supplementary
- The seeded `admin`/`admin` password should be changed after first login in production

---

## Out of Scope

- Password reset / forgot password flow
- Email verification on registration
- Token expiry / refresh
- Per-client permission levels (it's always full access or read-only)
