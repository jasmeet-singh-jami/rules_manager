# Security Hardening Design

**Date:** 2026-04-16  
**Scope:** Authentication hardening and tenant isolation cleanup for Polycloud Rules Manager

## Context

Two security gaps were identified:

1. **Tenant isolation** — read endpoints allow broad access, which is intentional (contributors see all clients read-only). However, `POST /clients` was ungated, allowing contributors to create new clients silently.
2. **Auth/session weaknesses** — tokens never expire, the seeded `admin/admin` account has no forced credential change, self-service password change does not verify the current password, and a stolen session token could be used to lock out the real user.

**Decisions made:**
- Read access stays broad (contributors see all clients/rules/deployments, write-only gated per client)
- Token expiry: sliding 24h window on opaque tokens (no JWT / refresh token)
- Bootstrap admin: keep seeding `admin/admin` but add `must_change_password` flag → force password change on first login
- Current-password verification: required on `PATCH /auth/me/password`
- localStorage: kept as-is (acceptable for internal tool)

---

## Change 1: Sliding Token Expiry (24h)

**Goal:** Inactive sessions expire automatically; active sessions stay alive indefinitely.

### Backend — `models.py`
Add `expires_at` column to `Token`:
```python
expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
```
Default: `utcnow() + timedelta(hours=24)`. `Base.metadata.create_all` adds the column on restart. All existing tokens should be deleted at deploy time to force re-login (avoids NULL `expires_at` in production).

### Backend — `auth_deps.py` (`get_current_user`)
After fetching the token row:
1. If `token.expires_at < utcnow()` → delete the token row, raise HTTP 401.
2. Otherwise → slide: `token.expires_at = utcnow() + timedelta(hours=24)`, commit.

### Frontend
No change. The existing 401 → redirect-to-login flow handles expired sessions correctly.

---

## Change 2: `must_change_password` Flag + First-Login Gate

**Goal:** The seeded `admin/admin` credential is forced to change before the admin can access the app.

### Backend — `models.py`
Add column to `User`:
```python
must_change_password = Column(Boolean, nullable=False, default=False)
```

### Backend — `seed_data.py`
Set flag when creating the admin seed account:
```python
User(username="admin", password_hash=hash_password("admin"), role="admin", must_change_password=True)
```

### Backend — `schemas.py`
`TokenOut` and `MeOut` gain `must_change_password: bool`, populated from the user object.

### Backend — `auth.py`
`PATCH /auth/me/password` sets `must_change_password = False` after a successful password change.

### Frontend — `AuthContext.tsx`
Store `must_change_password` in auth state (alongside `user`). Persist to `localStorage` so the gate survives page refresh before the password is changed.

### Frontend — `ProtectedRoute.tsx`
Add secondary gate: if `user.must_change_password && currentPath !== '/account'` → redirect to `/account`.

### Frontend — `AccountPage.tsx`
When `must_change_password` is true, render a banner: *"You must set a new password before continuing."* The existing change-password form handles the submission — no new UI needed beyond the banner and gate.

---

## Change 3: Current-Password Verification + Token Invalidation on Change

**Goal:** Prevent a stolen session token from being used to lock out the real user by changing their password.

### Backend — `schemas.py`
Add `current_password: str` to `ChangePasswordRequest`. All three fields (`current_password`, `new_password`, `confirm_password`) are required.

### Backend — `auth.py` (`change_password`)
1. Verify `current_password` against the stored hash:
   ```python
   if not verify_password(body.current_password, current_user.password_hash):
       raise HTTPException(status_code=400, detail="Current password is incorrect")
   ```
2. Save the new hash.
3. Delete all `Token` rows for the user **except** the token used in the current request. To get the raw token value, add `authorization: str = Header(None)` directly to the `change_password` endpoint signature (alongside `get_current_user`) and extract it with `authorization[7:]`. This invalidates any other active sessions.

### Frontend — `AccountPage.tsx`
Add a "Current password" input at the top of the change-password form. Pass it in the request body. Display a 400 error inline if the current password is wrong. The field is shown even during the first-login flow (the user enters `admin` as their current password).

---

## Change 4: Gate `POST /clients` to Admins

**Goal:** Prevent contributors from silently creating new clients.

### Backend — `clients.py`
Swap the dependency on `create_client`:
```python
current_user: User = Depends(require_admin)   # was get_current_user
```
The auto-grant of `UserClientAccess` to the creator is retained (harmless for admins).

### Frontend
No change. The "New Client" button is already hidden behind `isAdmin`.

### Tests
Any existing test that creates a client with a contributor token must be updated to use an admin token or admin fixture.

---

## Files Touched Summary

| File | Changes |
|------|---------|
| `backend/models.py` | Add `Token.expires_at`, `User.must_change_password` |
| `backend/auth_deps.py` | Expiry check + sliding extension in `get_current_user` |
| `backend/seed_data.py` | Set `must_change_password=True` on seeded admin |
| `backend/schemas.py` | Add `must_change_password` to `TokenOut`/`MeOut`; add `current_password` to `ChangePasswordRequest` |
| `backend/routers/auth.py` | Current-password check, token invalidation, clear `must_change_password` |
| `backend/routers/clients.py` | Swap to `require_admin` on `POST /clients` |
| `frontend/src/context/AuthContext.tsx` | Store + persist `must_change_password` |
| `frontend/src/components/ProtectedRoute.tsx` | Gate to `/account` when `must_change_password` |
| `frontend/src/pages/AccountPage.tsx` | Add current-password field + first-login banner |

---

## Deployment Note

At the time of deployment, delete all existing tokens from the `tokens` table to avoid NULL `expires_at` errors:
```sql
DELETE FROM tokens;
```
Users will be prompted to log in again, at which point new tokens with `expires_at` are issued.
