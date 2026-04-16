# Password Change & Admin Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any authenticated user change their own password via a dedicated Account page, and let admins reset any user's password directly from the User Management table.

**Architecture:** Two new backend endpoints (`PATCH /auth/me/password` and `PATCH /admin/users/{user_id}/password`) follow the existing router split; a new `AccountPage` is added under `/account`; the username chip in `Layout` becomes a `<Link>`; the `AdminPage` table gets a new inline Reset Password column.

**Tech Stack:** FastAPI, SQLAlchemy async, Argon2 (`security.py`), React 18, TypeScript, React Router v7, Vitest + Testing Library, pytest-asyncio

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/schemas.py` | Modify | Add `ChangePasswordRequest`, `AdminResetPasswordRequest` |
| `backend/routers/auth.py` | Modify | Add `PATCH /auth/me/password` endpoint |
| `backend/routers/admin.py` | Modify | Add `PATCH /admin/users/{user_id}/password` endpoint |
| `backend/tests/test_auth.py` | Modify | Tests for self-service password change |
| `backend/tests/test_admin.py` | Modify | Tests for admin password reset |
| `frontend/src/api/auth.ts` | Modify | Add `changePassword` function |
| `frontend/src/pages/AccountPage.tsx` | Create | Self-service password change page |
| `frontend/src/pages/AccountPage.test.tsx` | Create | Vitest tests for AccountPage |
| `frontend/src/App.tsx` | Modify | Add `/account` route |
| `frontend/src/components/layout/Layout.tsx` | Modify | Make username chip a `<Link to="/account">` |
| `frontend/src/pages/AdminPage.tsx` | Modify | Add inline Reset Password column |

---

## Task 1: Add Pydantic schemas

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Add the two new schemas at the end of the `# ── Auth` section in `backend/schemas.py`**

Add after the existing `UserWithClientsOut` class:

```python
class ChangePasswordRequest(BaseModel):
    new_password: str
    confirm_password: str


class AdminResetPasswordRequest(BaseModel):
    new_password: str
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add ChangePasswordRequest and AdminResetPasswordRequest schemas"
```

---

## Task 2: Self-service password change endpoint (TDD)

**Files:**
- Modify: `backend/tests/test_auth.py`
- Modify: `backend/routers/auth.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_auth.py`:

```python
@pytest.mark.asyncio
async def test_change_password_succeeds(client):
    reg = await client.post("/api/auth/register", json={"username": "pwchange", "password": "oldpassword"})
    token = reg.json()["token"]
    response = await client.patch(
        "/api/auth/me/password",
        json={"new_password": "newpassword1", "confirm_password": "newpassword1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204
    # Old password no longer works
    old_login = await client.post("/api/auth/login", json={"username": "pwchange", "password": "oldpassword"})
    assert old_login.status_code == 401
    # New password works
    new_login = await client.post("/api/auth/login", json={"username": "pwchange", "password": "newpassword1"})
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_change_password_mismatch_returns_422(client):
    reg = await client.post("/api/auth/register", json={"username": "pwmismatch", "password": "oldpassword"})
    token = reg.json()["token"]
    response = await client.patch(
        "/api/auth/me/password",
        json={"new_password": "newpassword1", "confirm_password": "differentpassword"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_change_password_too_short_returns_422(client):
    reg = await client.post("/api/auth/register", json={"username": "pwshort", "password": "oldpassword"})
    token = reg.json()["token"]
    response = await client.patch(
        "/api/auth/me/password",
        json={"new_password": "short", "confirm_password": "short"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_change_password_requires_auth(client):
    response = await client.patch(
        "/api/auth/me/password",
        json={"new_password": "newpassword1", "confirm_password": "newpassword1"},
    )
    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_auth.py::test_change_password_succeeds tests/test_auth.py::test_change_password_mismatch_returns_422 tests/test_auth.py::test_change_password_too_short_returns_422 tests/test_auth.py::test_change_password_requires_auth -v
```

Expected: all 4 FAIL (404 or connection error — endpoint doesn't exist yet)

- [ ] **Step 3: Add the endpoint to `backend/routers/auth.py`**

Add these imports at the top of the existing imports block:

```python
from schemas import UserCreate, LoginRequest, TokenOut, MeOut, ChangePasswordRequest
```

Then append the new endpoint after the `me` route:

```python
@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_auth.py::test_change_password_succeeds tests/test_auth.py::test_change_password_mismatch_returns_422 tests/test_auth.py::test_change_password_too_short_returns_422 tests/test_auth.py::test_change_password_requires_auth -v
```

Expected: all 4 PASS

- [ ] **Step 5: Run the full auth test suite to check for regressions**

```bash
pytest tests/test_auth.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routers/auth.py backend/tests/test_auth.py
git commit -m "feat: add PATCH /auth/me/password endpoint"
```

---

## Task 3: Admin password reset endpoint (TDD)

**Files:**
- Modify: `backend/tests/test_admin.py`
- Modify: `backend/routers/admin.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_admin.py`:

```python
@pytest.mark.asyncio
async def test_admin_reset_password_succeeds(authed_client, client):
    reg = await client.post("/api/auth/register", json={"username": "resetme", "password": "oldpassword"})
    user_id = reg.json()["user"]["id"]
    response = await authed_client.patch(
        f"/api/admin/users/{user_id}/password",
        json={"new_password": "newpassword1"},
    )
    assert response.status_code == 204
    # Old password no longer works
    old_login = await client.post("/api/auth/login", json={"username": "resetme", "password": "oldpassword"})
    assert old_login.status_code == 401
    # New password works
    new_login = await client.post("/api/auth/login", json={"username": "resetme", "password": "newpassword1"})
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_admin_reset_password_nonexistent_user_returns_404(authed_client):
    response = await authed_client.patch(
        "/api/admin/users/00000000-0000-0000-0000-000000000001/password",
        json={"new_password": "newpassword1"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_reset_password_requires_admin(client):
    reg = await client.post("/api/auth/register", json={"username": "notadmin3", "password": "oldpassword"})
    user_id = reg.json()["user"]["id"]
    token = reg.json()["token"]
    response = await client.patch(
        f"/api/admin/users/{user_id}/password",
        json={"new_password": "newpassword1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_reset_password_too_short_returns_422(authed_client, client):
    reg = await client.post("/api/auth/register", json={"username": "resetshort", "password": "oldpassword"})
    user_id = reg.json()["user"]["id"]
    response = await authed_client.patch(
        f"/api/admin/users/{user_id}/password",
        json={"new_password": "short"},
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_admin.py::test_admin_reset_password_succeeds tests/test_admin.py::test_admin_reset_password_nonexistent_user_returns_404 tests/test_admin.py::test_admin_reset_password_requires_admin tests/test_admin.py::test_admin_reset_password_too_short_returns_422 -v
```

Expected: all 4 FAIL (404 — endpoint doesn't exist yet)

- [ ] **Step 3: Add the endpoint to `backend/routers/admin.py`**

Update the import line at the top to add `AdminResetPasswordRequest`:

```python
from schemas import UserWithClientsOut, AdminResetPasswordRequest
```

Also add `hash_password` to the security import — add after the existing imports:

```python
from security import hash_password
```

Then append the new endpoint after `revoke_client_access`:

```python
@router.patch(
    "/users/{user_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reset_user_password(
    user_id: UUID,
    body: AdminResetPasswordRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_admin.py::test_admin_reset_password_succeeds tests/test_admin.py::test_admin_reset_password_nonexistent_user_returns_404 tests/test_admin.py::test_admin_reset_password_requires_admin tests/test_admin.py::test_admin_reset_password_too_short_returns_422 -v
```

Expected: all 4 PASS

- [ ] **Step 5: Run the full admin test suite to check for regressions**

```bash
pytest tests/test_admin.py -v
```

Expected: all PASS

- [ ] **Step 6: Run the full backend test suite**

```bash
pytest -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add backend/routers/admin.py backend/tests/test_admin.py
git commit -m "feat: add PATCH /admin/users/{user_id}/password endpoint"
```

---

## Task 4: AccountPage — API function, page, route, and tests

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Create: `frontend/src/pages/AccountPage.tsx`
- Create: `frontend/src/pages/AccountPage.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/pages/AccountPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import * as authApi from '../api/auth'

vi.mock('../api/auth')

describe('AccountPage', () => {
  it('renders change password form', () => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows success message after successful change', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined)
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument()
    )
  })

  it('shows error message when API call fails', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new Error('500'))
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() =>
      expect(screen.getByText(/failed to change password/i)).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend
npm test -- AccountPage
```

Expected: FAIL — `AccountPage` module not found

- [ ] **Step 3: Add `changePassword` to `frontend/src/api/auth.ts`**

Append after the `getMe` export:

```typescript
export const changePassword = (newPassword: string, confirmPassword: string) =>
  authRequest<void>('/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }),
  })
```

- [ ] **Step 4: Create `frontend/src/pages/AccountPage.tsx`**

```tsx
import { useState, FormEvent } from 'react'
import { changePassword } from '../api/auth'

export function AccountPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await changePassword(newPassword, confirmPassword)
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginBottom: 20 }}>Account</h2>
      <div className="glass-card" style={{ padding: 28 }}>
        <h3 style={{ marginBottom: 20, fontSize: 16 }}>Change Password</h3>
        {success && (
          <p style={{ color: 'var(--ok)', marginBottom: 12 }}>Password updated successfully.</p>
        )}
        {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add the `/account` route to `frontend/src/App.tsx`**

Add the import after the existing page imports:

```tsx
import { AccountPage } from './pages/AccountPage'
```

Add the route inside the inner `<Routes>` block, after the `/import` route and before the `/admin` route:

```tsx
<Route path="/account" element={<AccountPage />} />
```

The inner Routes block should look like:

```tsx
<Routes>
  <Route path="/" element={<RuleLibrary />} />
  <Route path="/clients" element={<Clients />} />
  <Route path="/clients/:id/deployments" element={<Deployments />} />
  <Route path="/import" element={<ImportDrl />} />
  <Route path="/account" element={<AccountPage />} />
  <Route
    path="/admin"
    element={
      <ProtectedRoute adminOnly>
        <AdminPage />
      </ProtectedRoute>
    }
  />
</Routes>
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd frontend
npm test -- AccountPage
```

Expected: all 5 PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/pages/AccountPage.tsx frontend/src/pages/AccountPage.test.tsx frontend/src/App.tsx
git commit -m "feat: add AccountPage and /account route for self-service password change"
```

---

## Task 5: Make username a link in Layout

**Files:**
- Modify: `frontend/src/components/layout/Layout.tsx`

- [ ] **Step 1: Update `Layout.tsx` to make the username chip a link**

In `frontend/src/components/layout/Layout.tsx`, replace the `<span className="username-chip">` with a `<Link>`:

Old:
```tsx
<span className="username-chip">{user?.username}</span>
```

New:
```tsx
<Link to="/account" className="username-chip" style={{ textDecoration: 'none' }}>{user?.username}</Link>
```

`Link` is already imported at the top of the file — no new imports needed.

- [ ] **Step 2: Run the existing Layout tests**

```bash
cd frontend
npm test -- Layout
```

Expected: all PASS (the chip is now a link, but existing assertions on nav links and children still hold)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Layout.tsx
git commit -m "feat: make username chip a link to /account page"
```

---

## Task 6: Admin password reset column in AdminPage

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: Add per-row password state and reset handler to `AdminPage.tsx`**

Add these two state declarations inside the `AdminPage` component function body, after the existing `useState` calls:

```tsx
const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({})
const [resetStatus, setResetStatus] = useState<Record<string, 'ok' | 'error' | ''>>({}  )
```

Add this handler function after the `handleRevoke` function:

```tsx
async function handleResetPassword(userId: string) {
  const pw = resetPasswords[userId] ?? ''
  setResetStatus(prev => ({ ...prev, [userId]: '' }))
  try {
    const res = await fetch(`/api/admin/users/${userId}/password`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_password: pw }),
    })
    if (!res.ok) throw new Error()
    setResetStatus(prev => ({ ...prev, [userId]: 'ok' }))
    setResetPasswords(prev => ({ ...prev, [userId]: '' }))
  } catch {
    setResetStatus(prev => ({ ...prev, [userId]: 'error' }))
  }
}
```

- [ ] **Step 2: Add the Reset Password column to the table**

In the `<thead>` row, add a new `<th>` after the existing "Grant Access" `<th>`:

```tsx
<th>Reset Password</th>
```

In the `<tbody>` row (inside the `users.map` block), add a new `<td>` after the "Grant Access" `<td>`:

```tsx
<td>
  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
    <input
      type="password"
      placeholder="New password"
      value={resetPasswords[u.id] ?? ''}
      onChange={e =>
        setResetPasswords(prev => ({ ...prev, [u.id]: e.target.value }))
      }
      style={{ fontSize: 12, padding: '3px 6px', width: 140 }}
    />
    <button
      className="btn-primary"
      onClick={() => handleResetPassword(u.id)}
      disabled={!resetPasswords[u.id]}
      style={{ fontSize: 12, padding: '3px 10px' }}
    >
      Reset
    </button>
    {resetStatus[u.id] === 'ok' && (
      <span style={{ color: 'var(--ok)', fontSize: 12 }}>✓ Reset</span>
    )}
    {resetStatus[u.id] === 'error' && (
      <span style={{ color: 'var(--danger)', fontSize: 12 }}>Failed</span>
    )}
  </div>
</td>
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend
npm test
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx
git commit -m "feat: add inline password reset column to AdminPage user table"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full backend test suite**

```bash
cd backend
pytest -v
```

Expected: all PASS

- [ ] **Step 2: Run the full frontend test suite**

```bash
cd frontend
npm test
```

Expected: all PASS

- [ ] **Step 3: Build the frontend**

```bash
cd frontend
npm run build
```

Expected: exits 0 with no TypeScript errors

- [ ] **Step 4: Start the app and smoke-test manually**

```bash
# from repo root
./start.sh   # or start.bat on Windows CMD
```

Verify:
1. Log in as `admin` / `admin` — username chip in top-right is now a clickable link
2. Click username → `/account` page loads with a Change Password form
3. Submit mismatched passwords → inline error "Passwords do not match"
4. Submit a short password (< 8 chars) → inline error "Password must be at least 8 characters"
5. Submit valid matching passwords → success message "Password updated successfully."
6. Log out and log back in with the new password — confirm it works
7. Navigate to `/admin` → Reset Password column is visible in the user table
8. Enter a new password for a test user and click Reset → "✓ Reset" confirmation appears
9. Log in as that user with the new password — confirm it works
