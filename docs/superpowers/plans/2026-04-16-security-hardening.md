# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sliding token expiry, force-password-change on first login, current-password verification with session invalidation, and admin-only client creation.

**Architecture:** All changes are in-place additions to existing files — no new routers or services. Backend uses SQLAlchemy `server_default` on new columns so the DB can be altered without dropping tables. Frontend gates are added to `ProtectedRoute` and `AccountPage`; `AuthContext` persists the new `must_change_password` flag to `localStorage`.

**Tech Stack:** FastAPI + SQLAlchemy async + PostgreSQL (backend); React 18 + TypeScript + Vite (frontend). Tests use pytest-asyncio + httpx AsyncClient against a real test DB.

---

## Pre-flight: Prepare the dev database

Before any code changes, add the new columns to your running dev DB so the server starts cleanly:

```sql
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
```

Then delete all existing tokens (they have no `expires_at` semantics yet):

```sql
DELETE FROM tokens;
```

The test suite drops and recreates tables automatically, so no manual steps needed there.

---

## Task 1: Add `Token.expires_at` and `User.must_change_password` model columns

**Files:**
- Modify: `backend/models.py`
- Test: `backend/tests/test_auth_models.py`

- [ ] **Step 1: Add import for `timedelta` and `text` in `models.py`**

Open `backend/models.py`. Change the top-of-file imports to add `timedelta` and SQLAlchemy `text`:

```python
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, ForeignKey,
    TIMESTAMP, Enum as SAEnum, UniqueConstraint, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from database import Base
```

- [ ] **Step 2: Add `expires_at` to `Token` and `must_change_password` to `User`**

In `backend/models.py`, update the `Token` class (around line 114):

```python
class Token(Base):
    __tablename__ = "tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(Text, unique=True, nullable=False, default=lambda: secrets.token_hex(32))
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    expires_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc) + timedelta(hours=24),
        server_default=text("NOW() + INTERVAL '24 hours'"),
    )

    user = relationship("User", back_populates="tokens")
```

Update the `User` class (around line 101), adding `must_change_password` after `created_at`:

```python
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(UserRole, nullable=False, default="contributor")
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    must_change_password = Column(Boolean, nullable=False, default=False, server_default="false")

    tokens = relationship("Token", back_populates="user", cascade="all, delete-orphan")
    client_access = relationship("UserClientAccess", back_populates="user", cascade="all, delete-orphan")
```

- [ ] **Step 3: Write a failing test for the new columns**

Open `backend/tests/test_auth_models.py` and replace its content:

```python
import pytest
from sqlalchemy import inspect


@pytest.mark.asyncio
async def test_auth_tables_exist(seeded_engine):
    async with seeded_engine.connect() as conn:
        table_names = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )
    assert "users" in table_names
    assert "tokens" in table_names
    assert "user_client_access" in table_names


@pytest.mark.asyncio
async def test_token_has_expires_at_column(seeded_engine):
    async with seeded_engine.connect() as conn:
        columns = await conn.run_sync(
            lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("tokens")]
        )
    assert "expires_at" in columns


@pytest.mark.asyncio
async def test_user_has_must_change_password_column(seeded_engine):
    async with seeded_engine.connect() as conn:
        columns = await conn.run_sync(
            lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("users")]
        )
    assert "must_change_password" in columns
```

- [ ] **Step 4: Run the new tests to verify they fail**

```bash
cd backend
pytest tests/test_auth_models.py::test_token_has_expires_at_column tests/test_auth_models.py::test_user_has_must_change_password_column -v
```

Expected: FAIL (columns do not exist yet in the test DB — the schema is recreated on the next test run after the model change).

- [ ] **Step 5: Run the full test suite to confirm the model change takes effect**

```bash
pytest tests/test_auth_models.py -v
```

Expected: All 3 tests PASS (the `seeded_engine` fixture drops and recreates all tables, picking up the new columns).

- [ ] **Step 6: Commit**

```bash
git add backend/models.py backend/tests/test_auth_models.py
git commit -m "feat: add Token.expires_at and User.must_change_password columns"
```

---

## Task 2: Enforce sliding token expiry in `get_current_user`

**Files:**
- Modify: `backend/auth_deps.py`
- Test: `backend/tests/test_auth_deps.py`

- [ ] **Step 1: Write failing tests for expiry enforcement**

Replace the content of `backend/tests/test_auth_deps.py`:

```python
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from models import Token


@pytest.mark.asyncio
async def test_invalid_token_returns_401(client):
    response = await client.get(
        "/api/clients",
        headers={"Authorization": "Bearer invalid_token_xyz"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_returns_401(client, db):
    reg = await client.post("/api/auth/register", json={"username": "expiry_user", "password": "password1"})
    token_value = reg.json()["token"]

    # Expire the token directly in the DB
    result = await db.execute(select(Token).where(Token.token == token_value))
    token_row = result.scalar_one()
    token_row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db.commit()

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_value}"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_valid_token_slides_expiry(client, db):
    reg = await client.post("/api/auth/register", json={"username": "slide_user", "password": "password1"})
    token_value = reg.json()["token"]

    # Set expiry to 1 hour from now (instead of 24)
    result = await db.execute(select(Token).where(Token.token == token_value))
    token_row = result.scalar_one()
    one_hour_from_now = datetime.now(timezone.utc) + timedelta(hours=1)
    token_row.expires_at = one_hour_from_now
    await db.commit()

    # Make an authenticated request
    await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_value}"})

    # Expiry should have been extended to ~24h from now
    await db.refresh(token_row)
    assert token_row.expires_at > one_hour_from_now
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_auth_deps.py::test_expired_token_returns_401 tests/test_auth_deps.py::test_valid_token_slides_expiry -v
```

Expected: FAIL — expiry is not yet checked.

- [ ] **Step 3: Update `get_current_user` in `auth_deps.py`**

Replace the content of `backend/auth_deps.py`:

```python
from datetime import datetime, timezone, timedelta
from uuid import UUID
from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, Token, UserClientAccess

TOKEN_TTL_HOURS = 24


async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_value = authorization[7:]
    result = await db.execute(select(Token).where(Token.token == token_value))
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if token.expires_at < datetime.now(timezone.utc):
        await db.delete(token)
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    token.expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    await db.commit()
    user_result = await db.execute(select(User).where(User.id == token.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def check_client_access(user: User, client_id: UUID, db: AsyncSession) -> None:
    """Raises 403 if the user does not have edit access to the given client."""
    if user.role == "admin":
        return
    result = await db.execute(
        select(UserClientAccess).where(
            UserClientAccess.user_id == user.id,
            UserClientAccess.client_id == client_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="No edit access to this client")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_auth_deps.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Run the full auth test suite to catch regressions**

```bash
pytest tests/test_auth.py tests/test_seed_admin.py -v
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/auth_deps.py backend/tests/test_auth_deps.py
git commit -m "feat: enforce sliding 24h token expiry in get_current_user"
```

---

## Task 3: Schema updates — `must_change_password` and `current_password`

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Update `TokenOut`, `MeOut`, and `ChangePasswordRequest` in `schemas.py`**

In `backend/schemas.py`, find the Auth section and make these three changes:

Replace `TokenOut`:
```python
class TokenOut(BaseModel):
    token: str
    user: UserOut
    client_access_ids: list[UUID]
    must_change_password: bool
```

Replace `MeOut`:
```python
class MeOut(BaseModel):
    id: UUID
    username: str
    role: str
    client_access_ids: list[UUID]
    must_change_password: bool
```

Replace `ChangePasswordRequest`:
```python
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str
```

- [ ] **Step 2: Run the test suite to see which tests now fail due to the schema change**

```bash
pytest tests/test_auth.py -v
```

Expected: `test_change_password_succeeds`, `test_change_password_mismatch_returns_422`, `test_change_password_too_short_returns_422`, and `test_change_password_requires_auth` will FAIL because they don't send `current_password`. Also `test_register_creates_user`, `test_login_returns_token`, `test_me_returns_user_info` may fail if `must_change_password` is not yet returned from endpoints. That's expected — we fix it in the next task.

- [ ] **Step 3: Commit schemas only**

```bash
git add backend/schemas.py
git commit -m "feat: add must_change_password to TokenOut/MeOut, add current_password to ChangePasswordRequest"
```

---

## Task 4: Seed update + auth router updates + fix existing tests

**Files:**
- Modify: `backend/seed_data.py`
- Modify: `backend/routers/auth.py`
- Modify: `backend/tests/test_auth.py`

- [ ] **Step 1: Update `seed_admin_user` to set `must_change_password=True`**

In `backend/seed_data.py`, replace the `seed_admin_user` function:

```python
async def seed_admin_user(session: AsyncSession) -> None:
    """Insert admin user with role='admin' if not already present."""
    result = await session.execute(select(User).where(User.username == "admin"))
    if result.scalar_one_or_none() is None:
        session.add(User(
            username="admin",
            password_hash=hash_password("admin"),
            role="admin",
            must_change_password=True,
        ))
```

- [ ] **Step 2: Update `_build_token_out` in `auth.py` to include `must_change_password`**

In `backend/routers/auth.py`, replace `_build_token_out`:

```python
async def _build_token_out(user: User, db: AsyncSession) -> TokenOut:
    """Create a new token for the user, return TokenOut with client_access_ids."""
    token = Token(user_id=user.id)
    db.add(token)
    await db.flush()
    access_result = await db.execute(
        select(UserClientAccess.client_id).where(UserClientAccess.user_id == user.id)
    )
    client_access_ids = [row[0] for row in access_result.all()]
    await db.commit()
    return TokenOut(
        token=token.token,
        user=user,
        client_access_ids=client_access_ids,
        must_change_password=user.must_change_password,
    )
```

- [ ] **Step 3: Update `me` endpoint to include `must_change_password`**

In `backend/routers/auth.py`, replace the `me` endpoint:

```python
@router.get("/me", response_model=MeOut)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access_result = await db.execute(
        select(UserClientAccess.client_id).where(UserClientAccess.user_id == current_user.id)
    )
    client_access_ids = [row[0] for row in access_result.all()]
    return MeOut(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        client_access_ids=client_access_ids,
        must_change_password=current_user.must_change_password,
    )
```

- [ ] **Step 4: Update `change_password` endpoint — current-password check + token invalidation + clear flag**

In `backend/routers/auth.py`, replace the `change_password` endpoint. Add `authorization: str = Header(None)` to the signature so we can identify the current token for the exclusion:

```python
@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    authorization: str = Header(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    # Invalidate all other sessions
    current_token_value = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    result = await db.execute(select(Token).where(Token.user_id == current_user.id))
    for token in result.scalars().all():
        if token.token != current_token_value:
            await db.delete(token)
    await db.commit()
```

- [ ] **Step 5: Write new failing tests for the updated `change_password` endpoint**

Add these tests to the end of `backend/tests/test_auth.py`:

```python
@pytest.mark.asyncio
async def test_change_password_wrong_current_returns_400(client):
    reg = await client.post("/api/auth/register", json={"username": "wrongcurrent", "password": "oldpassword"})
    token = reg.json()["token"]
    response = await client.patch(
        "/api/auth/me/password",
        json={"current_password": "WRONG", "new_password": "newpassword1", "confirm_password": "newpassword1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_change_password_invalidates_other_tokens(client):
    reg = await client.post("/api/auth/register", json={"username": "invalidatetest", "password": "oldpassword"})
    token_a = reg.json()["token"]
    # Log in again to get a second token
    login = await client.post("/api/auth/login", json={"username": "invalidatetest", "password": "oldpassword"})
    token_b = login.json()["token"]

    # Change password using token_a
    await client.patch(
        "/api/auth/me/password",
        json={"current_password": "oldpassword", "new_password": "newpassword1", "confirm_password": "newpassword1"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    # token_b should now be invalid
    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_b}"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_clears_must_change_password(client, db):
    from sqlalchemy import select
    from models import User as UserModel

    reg = await client.post("/api/auth/register", json={"username": "mustclear_user", "password": "oldpassword"})
    token = reg.json()["token"]

    # Manually set must_change_password=True directly in the DB
    result = await db.execute(select(UserModel).where(UserModel.username == "mustclear_user"))
    user_row = result.scalar_one()
    user_row.must_change_password = True
    await db.commit()

    # Confirm the flag is visible via /me
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["must_change_password"] is True

    # Change password — the current token is preserved (only others are invalidated)
    await client.patch(
        "/api/auth/me/password",
        json={"current_password": "oldpassword", "new_password": "newpassword1", "confirm_password": "newpassword1"},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Flag should now be False
    me2 = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me2.json()["must_change_password"] is False


@pytest.mark.asyncio
async def test_login_returns_must_change_password(client):
    reg = await client.post("/api/auth/register", json={"username": "mustchange_check", "password": "pw123456"})
    assert reg.json()["must_change_password"] is False


@pytest.mark.asyncio
async def test_me_returns_must_change_password(client):
    reg = await client.post("/api/auth/register", json={"username": "me_mustchange", "password": "pw123456"})
    token = reg.json()["token"]
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["must_change_password"] is False
```

- [ ] **Step 6: Update the existing `change_password` tests to include `current_password`**

In `backend/tests/test_auth.py`, find and replace the four existing change-password tests:

```python
@pytest.mark.asyncio
async def test_change_password_succeeds(client):
    reg = await client.post("/api/auth/register", json={"username": "pwchange", "password": "oldpassword"})
    token = reg.json()["token"]
    response = await client.patch(
        "/api/auth/me/password",
        json={"current_password": "oldpassword", "new_password": "newpassword1", "confirm_password": "newpassword1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204
    old_login = await client.post("/api/auth/login", json={"username": "pwchange", "password": "oldpassword"})
    assert old_login.status_code == 401
    new_login = await client.post("/api/auth/login", json={"username": "pwchange", "password": "newpassword1"})
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_change_password_mismatch_returns_422(client):
    reg = await client.post("/api/auth/register", json={"username": "pwmismatch", "password": "oldpassword"})
    token = reg.json()["token"]
    response = await client.patch(
        "/api/auth/me/password",
        json={"current_password": "oldpassword", "new_password": "newpassword1", "confirm_password": "differentpassword"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_change_password_too_short_returns_422(client):
    reg = await client.post("/api/auth/register", json={"username": "pwshort", "password": "oldpassword"})
    token = reg.json()["token"]
    response = await client.patch(
        "/api/auth/me/password",
        json={"current_password": "oldpassword", "new_password": "short", "confirm_password": "short"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_change_password_requires_auth(client):
    response = await client.patch(
        "/api/auth/me/password",
        json={"current_password": "x", "new_password": "newpassword1", "confirm_password": "newpassword1"},
    )
    assert response.status_code == 401
```

- [ ] **Step 7: Run the full auth test suite**

```bash
pytest tests/test_auth.py tests/test_seed_admin.py -v
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/seed_data.py backend/routers/auth.py backend/tests/test_auth.py
git commit -m "feat: add must_change_password flow, current-password verification, and token invalidation on password change"
```

---

## Task 5: Gate `POST /clients` to admins

**Files:**
- Modify: `backend/routers/clients.py`
- Modify: `backend/tests/test_clients.py`

- [ ] **Step 1: Write a failing test for contributor client creation**

Add this test to `backend/tests/test_clients.py`:

```python
@pytest.mark.asyncio
async def test_contributor_cannot_create_client(client):
    reg = await client.post("/api/auth/register", json={"username": "contrib_create", "password": "pw"})
    contrib_token = reg.json()["token"]
    response = await client.post(
        "/api/clients",
        json={"code": "NOPE", "name": "Should Fail"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pytest tests/test_clients.py::test_contributor_cannot_create_client -v
```

Expected: FAIL — currently returns 201.

- [ ] **Step 3: Swap `get_current_user` for `require_admin` on `create_client`**

In `backend/routers/clients.py`, update the `create_client` function signature:

```python
@router.post("/clients", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
```

Also ensure `require_admin` is imported at the top of `clients.py`:

```python
from auth_deps import get_current_user, check_client_access, require_admin
```

- [ ] **Step 4: Run the full clients test suite**

```bash
pytest tests/test_clients.py -v
```

Expected: All tests PASS (existing tests use `authed_client` which is logged in as admin).

- [ ] **Step 5: Commit**

```bash
git add backend/routers/clients.py backend/tests/test_clients.py
git commit -m "feat: restrict POST /clients to admin users"
```

---

## Task 6: Frontend — API types and `AuthContext` update

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 1: Add `must_change_password` to API types and update `changePassword` in `auth.ts`**

Replace the content of `frontend/src/api/auth.ts`:

```typescript
const BASE = '/api/auth'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'contributor'
}

export interface TokenResponse {
  token: string
  user: AuthUser
  client_access_ids: string[]
  must_change_password: boolean
}

export interface MeResponse {
  id: string
  username: string
  role: 'admin' | 'contributor'
  client_access_ids: string[]
  must_change_password: boolean
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const register = (username: string, password: string) =>
  authRequest<TokenResponse>('/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

export const login = (username: string, password: string) =>
  authRequest<TokenResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

export const logout = () =>
  authRequest<void>('/logout', { method: 'POST' })

export const getMe = () =>
  authRequest<MeResponse>('/me')

export const changePassword = (currentPassword: string, newPassword: string, confirmPassword: string) =>
  authRequest<void>('/me/password', {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  })
```

- [ ] **Step 2: Update `AuthContext.tsx` to store and persist `must_change_password`**

Replace the content of `frontend/src/context/AuthContext.tsx`:

```typescript
import { createContext, useContext, useState, ReactNode } from 'react'
import type { AuthUser } from '../api/auth'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  clientAccess: string[]
  mustChangePassword: boolean
  login: (token: string, user: AuthUser, clientAccess: string[], mustChangePassword: boolean) => void
  logout: () => void
  addClientAccess: (clientId: string) => void
  hasEditAccess: (clientId: string) => boolean
  isAdmin: boolean
  clearMustChangePassword: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('auth_token')
  )
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  })
  const [clientAccess, setClientAccess] = useState<string[]>(() => {
    const raw = localStorage.getItem('auth_client_access')
    return raw ? JSON.parse(raw) : []
  })
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(
    () => localStorage.getItem('auth_must_change_password') === 'true'
  )

  function login(newToken: string, newUser: AuthUser, newClientAccess: string[], newMustChangePassword: boolean) {
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    localStorage.setItem('auth_client_access', JSON.stringify(newClientAccess))
    localStorage.setItem('auth_must_change_password', String(newMustChangePassword))
    setToken(newToken)
    setUser(newUser)
    setClientAccess(newClientAccess)
    setMustChangePassword(newMustChangePassword)
  }

  function addClientAccess(clientId: string) {
    setClientAccess(prev => {
      if (prev.includes(clientId)) return prev
      const updated = [...prev, clientId]
      localStorage.setItem('auth_client_access', JSON.stringify(updated))
      return updated
    })
  }

  function logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    localStorage.removeItem('auth_must_change_password')
    setToken(null)
    setUser(null)
    setClientAccess([])
    setMustChangePassword(false)
  }

  function clearMustChangePassword() {
    localStorage.setItem('auth_must_change_password', 'false')
    setMustChangePassword(false)
  }

  function hasEditAccess(clientId: string): boolean {
    if (user?.role === 'admin') return true
    return clientAccess.includes(clientId)
  }

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      user, token, clientAccess, mustChangePassword,
      login, logout, addClientAccess, hasEditAccess, isAdmin, clearMustChangePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

- [ ] **Step 3: Fix call sites of `login()` that now require the 4th argument**

Search for all places `login(` is called in the frontend:

```bash
grep -rn "login(" frontend/src --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Open each file that calls `login(...)` (likely `LoginPage.tsx` and `RegisterPage.tsx`) and add `must_change_password` as the fourth argument. For example in `LoginPage.tsx`:

```typescript
// Before
login(data.token, data.user, data.client_access_ids)

// After
login(data.token, data.user, data.client_access_ids, data.must_change_password)
```

Do the same in `RegisterPage.tsx`.

- [ ] **Step 4: Run TypeScript check**

```bash
cd frontend && npm run build 2>&1 | head -40
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/context/AuthContext.tsx
# also add any login/register page changes
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "feat: propagate must_change_password through auth context and API types"
```

---

## Task 7: Frontend — `ProtectedRoute` first-login gate

**Files:**
- Modify: `frontend/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Update `ProtectedRoute` to redirect to `/account` when `must_change_password` is true**

Replace the content of `frontend/src/components/ProtectedRoute.tsx`:

```typescript
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  adminOnly?: boolean
}

export function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { token, isAdmin, mustChangePassword } = useAuth()
  const { pathname } = useLocation()
  if (!token) return <Navigate to="/login" replace />
  if (mustChangePassword && pathname !== '/account') return <Navigate to="/account" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd frontend && npm run build 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProtectedRoute.tsx
git commit -m "feat: redirect to /account when must_change_password is true"
```

---

## Task 8: Frontend — `AccountPage` current-password field and first-login banner

**Files:**
- Modify: `frontend/src/pages/AccountPage.tsx`

- [ ] **Step 1: Update `AccountPage` with current-password field, first-login banner, and clear flag on success**

Replace the content of `frontend/src/pages/AccountPage.tsx`:

```typescript
import { useState, FormEvent } from 'react'
import { changePassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function AccountPage() {
  const { mustChangePassword, clearMustChangePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
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
      await changePassword(currentPassword, newPassword, confirmPassword)
      clearMustChangePassword()
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('400')) {
        setError('Current password is incorrect')
      } else {
        setError('Failed to change password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginBottom: 20 }}>Account</h2>
      {mustChangePassword && (
        <div className="glass-card" style={{ padding: '12px 20px', marginBottom: 16, borderLeft: '3px solid var(--warn, #f59e0b)' }}>
          <p style={{ margin: 0, fontSize: 14 }}>You must set a new password before continuing.</p>
        </div>
      )}
      <div className="glass-card" style={{ padding: 28 }}>
        <h3 style={{ marginBottom: 20, fontSize: 16 }}>Change Password</h3>
        {success && (
          <p style={{ color: 'var(--ok)', marginBottom: 12 }}>Password updated successfully.</p>
        )}
        {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="current-password">Current Password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
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

- [ ] **Step 2: Run TypeScript check**

```bash
cd frontend && npm run build 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 3: Run full backend test suite to confirm no regressions**

```bash
cd backend && pytest -v
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AccountPage.tsx
git commit -m "feat: add current-password field and first-login banner to AccountPage"
```

---

## Final verification

- [ ] Start both services and log in as `admin` / `admin`
- [ ] Verify you are redirected to `/account` and see the "You must set a new password" banner
- [ ] Verify you can't navigate away until you change the password
- [ ] Enter `admin` as current password, set a new password — verify you land on the main app
- [ ] Log in again with the new password — verify `must_change_password` is false and no redirect occurs
- [ ] Open a second browser tab, log in as admin with the new password (second token) — change password in tab 1 — verify tab 2 gets 401 on next request
- [ ] Register a new contributor account and try `POST /api/clients` — verify 403
- [ ] Run `pytest` one final time to confirm all backend tests green
