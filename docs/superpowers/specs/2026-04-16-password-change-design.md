# Password Change & Admin Reset — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Overview

Users currently have no way to change their own password, and admins cannot reset another user's password. This feature adds both capabilities:

- A dedicated **Account page** where any authenticated user can set a new password
- An **admin reset action** in the existing User Management table so admins can set any user's password directly

---

## Backend

### New Pydantic Schemas (`schemas.py`)

```python
class ChangePasswordRequest(BaseModel):
    new_password: str
    confirm_password: str

class AdminResetPasswordRequest(BaseModel):
    new_password: str
```

### `PATCH /auth/me/password`

- **Auth:** any authenticated user (`get_current_user`)
- **Body:** `ChangePasswordRequest`
- **Validation:**
  - `new_password == confirm_password` → 422 if mismatch
  - `len(new_password) >= 8` → 422 if too short
- **Success:** hashes with `hash_password()`, saves to `user.password_hash`, commits; returns `204 No Content`
- **Location:** `routers/auth.py`

### `PATCH /admin/users/{user_id}/password`

- **Auth:** admin only (`require_admin`)
- **Body:** `AdminResetPasswordRequest`
- **Validation:**
  - User must exist → 404 if not found
  - `len(new_password) >= 8` → 422 if too short
- **Success:** hashes with `hash_password()`, saves to `user.password_hash`, commits; returns `204 No Content`
- **Location:** `routers/admin.py`

---

## Frontend

### `AccountPage` (`src/pages/AccountPage.tsx`)

- Route: `/account` (protected, any authenticated user)
- Form fields: "New password" + "Confirm password" (both `type="password"`)
- On submit: `PATCH /api/auth/me/password` with `{ new_password, confirm_password }`
- Client-side validation: fields must match before submitting
- Shows inline success message on 204, inline error message on failure
- User stays on the page after success (no redirect)
- Styled consistently with `LoginPage` / `RegisterPage`

### `Layout.tsx` — username as link

- The username text in the top-right header becomes `<Link to="/account">`
- Hover style distinguishes it as clickable

### `AdminPage.tsx` — Reset Password column

- New table column: "Reset Password"
- Each row contains a password `<input>` + "Reset" button (inline, no modal)
- On submit: `PATCH /api/admin/users/{user_id}/password` with `{ new_password }`
- Per-row success/error state (e.g. "✓ Reset" or "Failed")
- Pattern is consistent with the existing inline `<select>` for granting client access

---

## Error Handling

| Scenario | HTTP | Message |
|---|---|---|
| Password too short (< 8 chars) | 422 | "Password must be at least 8 characters" |
| Passwords don't match (self-service) | 422 | "Passwords do not match" |
| User not found (admin reset) | 404 | "User not found" |
| Not authenticated | 401 | "Not authenticated" |
| Not admin (admin endpoint) | 403 | "Admin access required" |

---

## Out of Scope

- Forced password change on next login (not required)
- Current-password verification for self-service (explicitly excluded per design decision)
- Password reset via email / forgot-password flow
- Session invalidation after password change (existing tokens remain valid)
