# Knowledge Base & Cron Jobs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Knowledge Base (per-client document library with 3 categories) and Cron Jobs (per-client flat file store) as new sidebar sections, each backed by dedicated DB tables, filesystem storage, and frontend pages.

**Architecture:** Two independent DB tables (`knowledge_documents`, `cron_jobs`), two new FastAPI routers (`/api/knowledge`, `/api/cron-jobs`), files written to a configurable `UPLOADS_DIR` env var path, and two new React pages wired into the existing sidebar/routing pattern.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL (asyncpg), aiofiles, React 18, TypeScript, react-router-dom v7, vitest + @testing-library/react

---

## File Map

**Backend — created:**
- `backend/storage.py` — `get_uploads_dir()` config helper, per-feature directory builders, unique filename generator
- `backend/routers/knowledge_base.py` — list, upload, download, delete for KB documents
- `backend/routers/cron_jobs.py` — list, upload, download, delete for cron jobs
- `backend/tests/test_knowledge_base.py` — integration tests (written before implementation)
- `backend/tests/test_cron_jobs.py` — integration tests (written before implementation)

**Backend — modified:**
- `backend/requirements.txt` — add `aiofiles==24.1.0`
- `backend/models.py` — append `KbCategory` enum, `KnowledgeDocument` model, `CronJob` model
- `backend/schemas.py` — append `KnowledgeDocumentOut`, `CronJobOut`
- `backend/main.py` — import and register two new routers

**Frontend — created:**
- `frontend/src/pages/KnowledgeBase.tsx`
- `frontend/src/pages/CronJobs.tsx`
- `frontend/src/pages/KnowledgeBase.test.tsx`
- `frontend/src/pages/CronJobs.test.tsx`

**Frontend — modified:**
- `frontend/src/api/client.ts` — `KnowledgeDocument`, `CronJob` interfaces + 8 API functions
- `frontend/src/components/layout/Sidebar.tsx` — KB and Cron Jobs nav items, KB categories sub-nav
- `frontend/src/App.tsx` — routes for `/knowledge/:category` and `/cron-jobs`

---

### Task 1: Add aiofiles dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add aiofiles to requirements.txt**

Open `backend/requirements.txt` and append after the last line:

```text
aiofiles==24.1.0
```

- [ ] **Step 2: Install the dependency**

```bash
cd backend
pip install aiofiles==24.1.0
```

Expected: `Successfully installed aiofiles-24.1.0`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add aiofiles dependency for async file I/O"
```

---

### Task 2: DB models

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Append `KbCategory` enum and two model classes at the end of `backend/models.py`**

```python
KbCategory = SAEnum("integrations", "automations", "issues", name="kb_category")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    category = Column(KbCategory, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    client = relationship("Client")


class CronJob(Base):
    __tablename__ = "cron_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    client = relationship("Client")
```

- [ ] **Step 2: Commit**

```bash
git add backend/models.py
git commit -m "feat: add KnowledgeDocument and CronJob models"
```

---

### Task 3: Pydantic schemas

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Append two output schemas at the end of `backend/schemas.py`**

```python
# ── Knowledge Base ────────────────────────────────────────────────────────────

class KnowledgeDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_id: UUID
    category: str
    name: str
    description: Optional[str]
    filename: str
    file_size: int
    mime_type: str
    uploaded_by: Optional[UUID]
    created_at: datetime


# ── Cron Jobs ─────────────────────────────────────────────────────────────────

class CronJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_id: UUID
    name: str
    description: Optional[str]
    filename: str
    file_size: int
    mime_type: str
    uploaded_by: Optional[UUID]
    created_at: datetime
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add KnowledgeDocumentOut and CronJobOut schemas"
```

---

### Task 4: Storage utility

**Files:**
- Create: `backend/storage.py`

- [ ] **Step 1: Create `backend/storage.py`**

```python
import os
import uuid
from pathlib import Path


def get_uploads_dir() -> Path:
    """Reads UPLOADS_DIR from env each call so tests can override via monkeypatch."""
    return Path(os.getenv("UPLOADS_DIR", "./uploads"))


def knowledge_dir(client_id: str) -> Path:
    d = get_uploads_dir() / "knowledge" / client_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def cron_jobs_dir(client_id: str) -> Path:
    d = get_uploads_dir() / "cron_jobs" / client_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def unique_filename(original: str) -> str:
    return f"{uuid.uuid4()}_{original}"
```

- [ ] **Step 2: Commit**

```bash
git add backend/storage.py
git commit -m "feat: add configurable file storage utility"
```

---

### Task 5: Write Knowledge Base backend tests (failing)

**Files:**
- Create: `backend/tests/test_knowledge_base.py`

- [ ] **Step 1: Create the test file**

```python
import io
import pytest


async def _make_client(authed_client, code="INFY"):
    r = await authed_client.post("/api/clients", json={"code": code, "name": code})
    return r.json()["id"]


async def _upload_doc(authed_client, client_id, tmp_path, monkeypatch, category="integrations"):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    content = b"test document content"
    r = await authed_client.post(
        "/api/knowledge",
        data={"client_id": client_id, "category": category, "name": "Test Doc"},
        files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
    )
    return r, content


@pytest.mark.asyncio
async def test_list_knowledge_docs_empty(authed_client):
    r = await authed_client.get("/api/knowledge")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_upload_knowledge_doc(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_doc(authed_client, client_id, tmp_path, monkeypatch)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Test Doc"
    assert data["category"] == "integrations"
    assert data["filename"] == "test.txt"
    assert data["file_size"] == len(content)
    assert data["client_id"] == client_id


@pytest.mark.asyncio
async def test_upload_invalid_category(authed_client, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    client_id = await _make_client(authed_client)
    r = await authed_client.post(
        "/api/knowledge",
        data={"client_id": client_id, "category": "invalid", "name": "Doc"},
        files={"file": ("f.txt", io.BytesIO(b"x"), "text/plain")},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_list_knowledge_docs_filtered_by_client(authed_client, tmp_path, monkeypatch):
    c1 = await _make_client(authed_client, "C1")
    c2 = await _make_client(authed_client, "C2")
    await _upload_doc(authed_client, c1, tmp_path, monkeypatch)
    await _upload_doc(authed_client, c2, tmp_path, monkeypatch)
    r = await authed_client.get(f"/api/knowledge?client_id={c1}")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["client_id"] == c1


@pytest.mark.asyncio
async def test_list_knowledge_docs_filtered_by_category(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    await _upload_doc(authed_client, client_id, tmp_path, monkeypatch, category="integrations")
    await _upload_doc(authed_client, client_id, tmp_path, monkeypatch, category="issues")
    r = await authed_client.get("/api/knowledge?category=integrations")
    assert r.status_code == 200
    assert all(d["category"] == "integrations" for d in r.json())


@pytest.mark.asyncio
async def test_download_knowledge_doc(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_doc(authed_client, client_id, tmp_path, monkeypatch)
    doc_id = r.json()["id"]
    dl = await authed_client.get(f"/api/knowledge/{doc_id}/download")
    assert dl.status_code == 200
    assert dl.content == content


@pytest.mark.asyncio
async def test_download_nonexistent_doc(authed_client):
    r = await authed_client.get("/api/knowledge/00000000-0000-0000-0000-000000000000/download")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_knowledge_doc(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, _ = await _upload_doc(authed_client, client_id, tmp_path, monkeypatch)
    doc_id = r.json()["id"]
    del_r = await authed_client.delete(f"/api/knowledge/{doc_id}")
    assert del_r.status_code == 204
    list_r = await authed_client.get(f"/api/knowledge?client_id={client_id}")
    assert all(d["id"] != doc_id for d in list_r.json())


@pytest.mark.asyncio
async def test_delete_nonexistent_doc(authed_client):
    r = await authed_client.delete("/api/knowledge/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests — expect failure (routes don't exist yet)**

```bash
cd backend
pytest tests/test_knowledge_base.py -v
```

Expected: tests `FAILED` with 404 or 405 — the `/api/knowledge` routes are not registered yet.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_knowledge_base.py
git commit -m "test: add failing Knowledge Base integration tests"
```

---

### Task 6: Knowledge Base router + register in main.py

**Files:**
- Create: `backend/routers/knowledge_base.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create `backend/routers/knowledge_base.py`**

```python
import aiofiles
from uuid import UUID
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import KnowledgeDocument, Client, User, UserClientAccess
from schemas import KnowledgeDocumentOut
from auth_deps import get_current_user, check_client_access
from storage import knowledge_dir, unique_filename

router = APIRouter(tags=["knowledge"])

VALID_CATEGORIES = {"integrations", "automations", "issues"}


@router.get("/knowledge", response_model=list[KnowledgeDocumentOut])
async def list_knowledge_docs(
    client_id: Optional[UUID] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())
    if client_id:
        stmt = stmt.where(KnowledgeDocument.client_id == client_id)
    if category:
        stmt = stmt.where(KnowledgeDocument.category == category)
    if current_user.role != "admin":
        access_result = await db.execute(
            select(UserClientAccess.client_id).where(UserClientAccess.user_id == current_user.id)
        )
        allowed = {row[0] for row in access_result}
        stmt = stmt.where(KnowledgeDocument.client_id.in_(allowed))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/knowledge", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_doc(
    client_id: UUID = Form(...),
    category: str = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {sorted(VALID_CATEGORIES)}")

    client_result = await db.execute(select(Client).where(Client.id == client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    await check_client_access(current_user, client_id, db)

    dest_dir = knowledge_dir(str(client_id))
    dest_name = unique_filename(file.filename or "upload")
    dest_path = dest_dir / dest_name

    content = await file.read()
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(content)

    doc = KnowledgeDocument(
        client_id=client_id,
        category=category,
        name=name,
        description=description,
        filename=file.filename or "upload",
        file_path=str(dest_path),
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/knowledge/{doc_id}/download")
async def download_knowledge_doc(
    doc_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role != "admin":
        access_result = await db.execute(
            select(UserClientAccess).where(
                UserClientAccess.user_id == current_user.id,
                UserClientAccess.client_id == doc.client_id,
            )
        )
        if not access_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied")

    if not Path(doc.file_path).exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(path=doc.file_path, filename=doc.filename, media_type=doc.mime_type)


@router.delete("/knowledge/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_doc(
    doc_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await check_client_access(current_user, doc.client_id, db)

    file_path = Path(doc.file_path)
    await db.delete(doc)
    await db.commit()
    if file_path.exists():
        file_path.unlink()
```

- [ ] **Step 2: Register the router in `backend/main.py`**

Change the import line from:

```python
from routers import clients, rule_types, rules, deployments, import_drl, auth, admin, functions
```

To:

```python
from routers import clients, rule_types, rules, deployments, import_drl, auth, admin, functions, knowledge_base
```

After `app.include_router(functions.router, prefix="/api")`, add:

```python
app.include_router(knowledge_base.router, prefix="/api")
```

- [ ] **Step 3: Run the KB tests — expect all pass**

```bash
cd backend
pytest tests/test_knowledge_base.py -v
```

Expected: all 9 tests `PASSED`.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/knowledge_base.py backend/main.py
git commit -m "feat: add Knowledge Base router with upload, download, delete"
```

---

### Task 7: Write Cron Jobs backend tests (failing)

**Files:**
- Create: `backend/tests/test_cron_jobs.py`

- [ ] **Step 1: Create the test file**

```python
import io
import pytest


async def _make_client(authed_client, code="INFY"):
    r = await authed_client.post("/api/clients", json={"code": code, "name": code})
    return r.json()["id"]


async def _upload_job(authed_client, client_id, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    content = b"#!/bin/bash\necho hello"
    r = await authed_client.post(
        "/api/cron-jobs",
        data={"client_id": client_id, "name": "Nightly Sync"},
        files={"file": ("sync.sh", io.BytesIO(content), "application/x-sh")},
    )
    return r, content


@pytest.mark.asyncio
async def test_list_cron_jobs_empty(authed_client):
    r = await authed_client.get("/api/cron-jobs")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_upload_cron_job(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Nightly Sync"
    assert data["filename"] == "sync.sh"
    assert data["file_size"] == len(content)
    assert data["client_id"] == client_id


@pytest.mark.asyncio
async def test_list_cron_jobs_filtered_by_client(authed_client, tmp_path, monkeypatch):
    c1 = await _make_client(authed_client, "C1")
    c2 = await _make_client(authed_client, "C2")
    await _upload_job(authed_client, c1, tmp_path, monkeypatch)
    await _upload_job(authed_client, c2, tmp_path, monkeypatch)
    r = await authed_client.get(f"/api/cron-jobs?client_id={c1}")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["client_id"] == c1


@pytest.mark.asyncio
async def test_download_cron_job(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, content = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    job_id = r.json()["id"]
    dl = await authed_client.get(f"/api/cron-jobs/{job_id}/download")
    assert dl.status_code == 200
    assert dl.content == content


@pytest.mark.asyncio
async def test_download_nonexistent_cron_job(authed_client):
    r = await authed_client.get("/api/cron-jobs/00000000-0000-0000-0000-000000000000/download")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_cron_job(authed_client, tmp_path, monkeypatch):
    client_id = await _make_client(authed_client)
    r, _ = await _upload_job(authed_client, client_id, tmp_path, monkeypatch)
    job_id = r.json()["id"]
    del_r = await authed_client.delete(f"/api/cron-jobs/{job_id}")
    assert del_r.status_code == 204
    list_r = await authed_client.get(f"/api/cron-jobs?client_id={client_id}")
    assert all(j["id"] != job_id for j in list_r.json())


@pytest.mark.asyncio
async def test_delete_nonexistent_cron_job(authed_client):
    r = await authed_client.delete("/api/cron-jobs/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend
pytest tests/test_cron_jobs.py -v
```

Expected: tests `FAILED` — 404 because `/api/cron-jobs` is not registered yet.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_cron_jobs.py
git commit -m "test: add failing Cron Jobs integration tests"
```

---

### Task 8: Cron Jobs router + register in main.py

**Files:**
- Create: `backend/routers/cron_jobs.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create `backend/routers/cron_jobs.py`**

```python
import aiofiles
from uuid import UUID
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import CronJob, Client, User, UserClientAccess
from schemas import CronJobOut
from auth_deps import get_current_user, check_client_access
from storage import cron_jobs_dir, unique_filename

router = APIRouter(tags=["cron-jobs"])


@router.get("/cron-jobs", response_model=list[CronJobOut])
async def list_cron_jobs(
    client_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CronJob).order_by(CronJob.created_at.desc())
    if client_id:
        stmt = stmt.where(CronJob.client_id == client_id)
    if current_user.role != "admin":
        access_result = await db.execute(
            select(UserClientAccess.client_id).where(UserClientAccess.user_id == current_user.id)
        )
        allowed = {row[0] for row in access_result}
        stmt = stmt.where(CronJob.client_id.in_(allowed))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/cron-jobs", response_model=CronJobOut, status_code=status.HTTP_201_CREATED)
async def upload_cron_job(
    client_id: UUID = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_result = await db.execute(select(Client).where(Client.id == client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    await check_client_access(current_user, client_id, db)

    dest_dir = cron_jobs_dir(str(client_id))
    dest_name = unique_filename(file.filename or "upload")
    dest_path = dest_dir / dest_name

    content = await file.read()
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(content)

    job = CronJob(
        client_id=client_id,
        name=name,
        description=description,
        filename=file.filename or "upload",
        file_path=str(dest_path),
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        uploaded_by=current_user.id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.get("/cron-jobs/{job_id}/download")
async def download_cron_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CronJob).where(CronJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")

    if current_user.role != "admin":
        access_result = await db.execute(
            select(UserClientAccess).where(
                UserClientAccess.user_id == current_user.id,
                UserClientAccess.client_id == job.client_id,
            )
        )
        if not access_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied")

    if not Path(job.file_path).exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(path=job.file_path, filename=job.filename, media_type=job.mime_type)


@router.delete("/cron-jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cron_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CronJob).where(CronJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")

    await check_client_access(current_user, job.client_id, db)

    file_path = Path(job.file_path)
    await db.delete(job)
    await db.commit()
    if file_path.exists():
        file_path.unlink()
```

- [ ] **Step 2: Register in `backend/main.py`**

Change the import line to:

```python
from routers import clients, rule_types, rules, deployments, import_drl, auth, admin, functions, knowledge_base, cron_jobs
```

After `app.include_router(knowledge_base.router, prefix="/api")`, add:

```python
app.include_router(cron_jobs.router, prefix="/api")
```

- [ ] **Step 3: Run both test files — expect all pass**

```bash
cd backend
pytest tests/test_cron_jobs.py tests/test_knowledge_base.py -v
```

Expected: all tests `PASSED`.

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
cd backend
pytest -v
```

Expected: all tests `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/cron_jobs.py backend/main.py
git commit -m "feat: add Cron Jobs router with upload, download, delete"
```

---

### Task 9: Frontend API layer

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add `KnowledgeDocument` and `CronJob` interfaces after the `Deployment` interface**

```typescript
export interface KnowledgeDocument {
  id: string
  client_id: string
  category: string
  name: string
  description: string | null
  filename: string
  file_size: number
  mime_type: string
  uploaded_by: string | null
  created_at: string
}

export interface CronJob {
  id: string
  client_id: string
  name: string
  description: string | null
  filename: string
  file_size: number
  mime_type: string
  uploaded_by: string | null
  created_at: string
}
```

- [ ] **Step 2: Append API functions at the end of `frontend/src/api/client.ts`**

```typescript
// ── Knowledge Base ────────────────────────────────────────────────────────────

export interface KnowledgeDocFilters {
  client_id?: string
  category?: string
}

export const getKnowledgeDocs = (filters: KnowledgeDocFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.client_id) params.set('client_id', filters.client_id)
  if (filters.category) params.set('category', filters.category)
  const qs = params.toString()
  return request<KnowledgeDocument[]>(`/knowledge${qs ? `?${qs}` : ''}`)
}

export const uploadKnowledgeDoc = async (params: {
  client_id: string
  category: string
  name: string
  description?: string
  file: File
}): Promise<KnowledgeDocument> => {
  const form = new FormData()
  form.append('client_id', params.client_id)
  form.append('category', params.category)
  form.append('name', params.name)
  if (params.description) form.append('description', params.description)
  form.append('file', params.file)
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/knowledge`, { method: 'POST', body: form, headers })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<KnowledgeDocument>
}

export const downloadKnowledgeDoc = (id: string): Promise<Response> => {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}/knowledge/${id}/download`, { headers })
}

export const deleteKnowledgeDoc = (id: string) =>
  request<void>(`/knowledge/${id}`, { method: 'DELETE' })

// ── Cron Jobs ─────────────────────────────────────────────────────────────────

export const getCronJobs = (client_id?: string) => {
  const qs = client_id ? `?client_id=${client_id}` : ''
  return request<CronJob[]>(`/cron-jobs${qs}`)
}

export const uploadCronJob = async (params: {
  client_id: string
  name: string
  description?: string
  file: File
}): Promise<CronJob> => {
  const form = new FormData()
  form.append('client_id', params.client_id)
  form.append('name', params.name)
  if (params.description) form.append('description', params.description)
  form.append('file', params.file)
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/cron-jobs`, { method: 'POST', body: form, headers })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_client_access')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<CronJob>
}

export const downloadCronJob = (id: string): Promise<Response> => {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}/cron-jobs/${id}/download`, { headers })
}

export const deleteCronJob = (id: string) =>
  request<void>(`/cron-jobs/${id}`, { method: 'DELETE' })
```

- [ ] **Step 3: Type-check**

```bash
cd frontend
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add KnowledgeDocument and CronJob API types and functions"
```

---

### Task 10: Sidebar updates

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update the `WORKSPACE` array to include both new entries**

Replace the existing `WORKSPACE` constant with:

```typescript
const WORKSPACE: NavEntry[] = [
  { to: '/', icon: 'home', label: 'Overview' },
  { to: '/rules', icon: 'rules', label: 'Rules' },
  { to: '/deployments', icon: 'deploy', label: 'Deployments' },
  { to: '/knowledge', icon: 'folder', label: 'Knowledge Base' },
  { to: '/cron-jobs', icon: 'clock', label: 'Cron Jobs' },
  { to: '/clients', icon: 'clients', label: 'Clients' },
  { to: '/import', icon: 'import', label: 'Import DRL' },
]
```

- [ ] **Step 2: Add `onKnowledgePage` flag and static category list after the existing `onRulesPage` line**

After `const onRulesPage = location.pathname.startsWith('/rules')`, add:

```typescript
const onKnowledgePage = location.pathname.startsWith('/knowledge')

const KB_CATEGORIES = [
  { slug: 'integrations', label: 'Integrations' },
  { slug: 'automations', label: 'Automations' },
  { slug: 'issues', label: 'Issues' },
]
```

- [ ] **Step 3: Add the KB categories sub-nav block in the JSX**

In the JSX, after the closing `}` of the `{onRulesPage && (...)}` block, add:

```tsx
{onKnowledgePage && (
  <div className="sidebar-section">
    <div className="sidebar-section-label">Categories</div>
    <div className="nav-sub">
      {KB_CATEGORIES.map(cat => {
        const isActive = location.pathname === `/knowledge/${cat.slug}`
        return (
          <NavLink
            key={cat.slug}
            to={`/knowledge/${cat.slug}`}
            className={() => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="grow truncate">{cat.label}</span>
          </NavLink>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add Knowledge Base and Cron Jobs to sidebar nav"
```

---

### Task 11: KnowledgeBase page

**Files:**
- Create: `frontend/src/pages/KnowledgeBase.tsx`

- [ ] **Step 1: Create `frontend/src/pages/KnowledgeBase.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import {
  getKnowledgeDocs, uploadKnowledgeDoc, downloadKnowledgeDoc, deleteKnowledgeDoc,
  type KnowledgeDocument,
} from '../api/client'

const CATEGORY_LABELS: Record<string, string> = {
  integrations: 'Integrations',
  automations: 'Automations',
  issues: 'Issues',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function KnowledgeBase() {
  const { category = 'integrations' } = useParams<{ category: string }>()
  const { hasEditAccess } = useAuth()
  const { toast } = useToast()
  const { clients } = useClients()

  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ client_id: '', name: '', description: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    getKnowledgeDocs({ category, client_id: clientFilter || undefined })
      .then(d => { if (!cancel) setDocs(d) })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [category, clientFilter])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return ql
      ? docs.filter(d => d.name.toLowerCase().includes(ql) || d.filename.toLowerCase().includes(ql))
      : docs
  }, [docs, q])

  const editableClients = clients.filter(c => hasEditAccess(c.id))

  const openModal = () => {
    setForm({ client_id: editableClients[0]?.id ?? '', name: '', description: '' })
    setFile(null)
    setFormError('')
    setShowModal(true)
  }

  const handleUpload = async () => {
    if (!form.client_id) { setFormError('Select a client'); return }
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!file) { setFormError('Select a file'); return }
    setSaving(true)
    setFormError('')
    try {
      const doc = await uploadKnowledgeDoc({
        client_id: form.client_id,
        category,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        file,
      })
      setDocs(prev => [doc, ...prev])
      toast('Document uploaded', 'ok')
      setShowModal(false)
    } catch {
      setFormError('Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async (doc: KnowledgeDocument) => {
    setDownloading(doc.id)
    try {
      const res = await downloadKnowledgeDoc(doc.id)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Download failed', 'err')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteKnowledgeDoc(id)
      setDocs(prev => prev.filter(d => d.id !== id))
      toast('Document deleted', 'ok')
    } catch {
      toast('Delete failed', 'err')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Knowledge Base · {CATEGORY_LABELS[category] ?? category}</h1>
          <div className="page-sub">Client knowledge documents</div>
        </div>
        {editableClients.length > 0 && (
          <div className="page-actions">
            <button className="btn accent" onClick={openModal}>
              <Icon name="upload" /> Upload Document
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents…" />
        </div>
        <select className="select" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} documents</span>
      </div>

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th>Name</th>
              <th>Filename</th>
              <th>Size</th>
              <th className="col-updated">Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows count={4} cols={5} /> :
              filtered.length === 0 ? (
                <tr><td colSpan={5}>
                  <EmptyState icon="folder" title="No documents yet" body="Upload a document to get started." />
                </td></tr>
              ) : filtered.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <span className="cell-name">{doc.name}</span>
                    {doc.description && <div className="small muted">{doc.description}</div>}
                  </td>
                  <td className="small">{doc.filename}</td>
                  <td className="small muted">{formatBytes(doc.file_size)}</td>
                  <td><span className="muted small">{new Date(doc.created_at).toLocaleString()}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn ghost"
                        onClick={() => handleDownload(doc)}
                        disabled={downloading === doc.id}
                        title="Download"
                      >
                        <Icon name="download" />
                      </button>
                      {hasEditAccess(doc.client_id) && (
                        confirmDelete === doc.id ? (
                          <>
                            <button className="btn accent" onClick={() => handleDelete(doc.id)}>Confirm</button>
                            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn ghost" onClick={() => setConfirmDelete(doc.id)} title="Delete">
                            <Icon name="trash" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Upload Document</h2>
            {formError && <div className="callout danger small" style={{ marginBottom: 14 }}>{formError}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Client</label>
              <select
                className="select"
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              >
                <option value="">Select client…</option>
                {editableClients.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Name</label>
              <input
                type="text"
                placeholder="Document title"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Description</label>
              <input
                type="text"
                placeholder="Optional description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>File</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn accent" onClick={handleUpload} disabled={saving}>
                {saving ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors for `KnowledgeBase.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/KnowledgeBase.tsx
git commit -m "feat: add KnowledgeBase page with upload, download, delete"
```

---

### Task 12: KnowledgeBase test

**Files:**
- Create: `frontend/src/pages/KnowledgeBase.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { KnowledgeBase } from './KnowledgeBase'

vi.mock('../context/ClientContext', () => ({
  useClients: () => ({
    clients: [
      { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
    ],
  }),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    hasEditAccess: () => true,
  }),
}))

vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const { getKnowledgeDocs } = vi.hoisted(() => ({
  getKnowledgeDocs: vi.fn(async () => []),
}))

vi.mock('../api/client', () => ({
  getKnowledgeDocs,
  uploadKnowledgeDoc: vi.fn(),
  downloadKnowledgeDoc: vi.fn(),
  deleteKnowledgeDoc: vi.fn(),
}))

function renderPage(category = 'integrations') {
  return render(
    <MemoryRouter initialEntries={[`/knowledge/${category}`]}>
      <Routes>
        <Route path="/knowledge/:category" element={<KnowledgeBase />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('KnowledgeBase', () => {
  beforeEach(() => {
    getKnowledgeDocs.mockResolvedValue([])
  })

  it('renders the page title with category', async () => {
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText(/Knowledge Base · Integrations/i)).toBeInTheDocument())
  })

  it('shows empty state when no documents', async () => {
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText(/No documents yet/i)).toBeInTheDocument())
  })

  it('shows documents when loaded', async () => {
    getKnowledgeDocs.mockResolvedValue([{
      id: 'd1',
      client_id: 'c1',
      category: 'integrations',
      name: 'Splunk Guide',
      description: null,
      filename: 'splunk.pdf',
      file_size: 10240,
      mime_type: 'application/pdf',
      uploaded_by: null,
      created_at: new Date().toISOString(),
    }])
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText('Splunk Guide')).toBeInTheDocument())
    expect(screen.getByText('splunk.pdf')).toBeInTheDocument()
  })

  it('shows upload button for users with edit access', async () => {
    renderPage('integrations')
    await waitFor(() => expect(screen.getByText(/Upload Document/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd frontend
npm test -- KnowledgeBase
```

Expected: all 4 tests `PASSED`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/KnowledgeBase.test.tsx
git commit -m "test: add KnowledgeBase page tests"
```

---

### Task 13: CronJobs page

**Files:**
- Create: `frontend/src/pages/CronJobs.tsx`

- [ ] **Step 1: Create `frontend/src/pages/CronJobs.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import {
  getCronJobs, uploadCronJob, downloadCronJob, deleteCronJob,
  type CronJob,
} from '../api/client'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CronJobs() {
  const { hasEditAccess } = useAuth()
  const { toast } = useToast()
  const { clients } = useClients()

  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ client_id: '', name: '', description: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    getCronJobs(clientFilter || undefined)
      .then(j => { if (!cancel) setJobs(j) })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [clientFilter])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return ql
      ? jobs.filter(j => j.name.toLowerCase().includes(ql) || j.filename.toLowerCase().includes(ql))
      : jobs
  }, [jobs, q])

  const editableClients = clients.filter(c => hasEditAccess(c.id))

  const openModal = () => {
    setForm({ client_id: editableClients[0]?.id ?? '', name: '', description: '' })
    setFile(null)
    setFormError('')
    setShowModal(true)
  }

  const handleUpload = async () => {
    if (!form.client_id) { setFormError('Select a client'); return }
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!file) { setFormError('Select a file'); return }
    setSaving(true)
    setFormError('')
    try {
      const job = await uploadCronJob({
        client_id: form.client_id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        file,
      })
      setJobs(prev => [job, ...prev])
      toast('Cron job uploaded', 'ok')
      setShowModal(false)
    } catch {
      setFormError('Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async (job: CronJob) => {
    setDownloading(job.id)
    try {
      const res = await downloadCronJob(job.id)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = job.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Download failed', 'err')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id)
      setJobs(prev => prev.filter(j => j.id !== id))
      toast('Cron job deleted', 'ok')
    } catch {
      toast('Delete failed', 'err')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Cron Jobs</h1>
          <div className="page-sub">Client scheduled job scripts</div>
        </div>
        {editableClients.length > 0 && (
          <div className="page-actions">
            <button className="btn accent" onClick={openModal}>
              <Icon name="upload" /> Upload Cron Job
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search cron jobs…" />
        </div>
        <select className="select" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} cron jobs</span>
      </div>

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th>Name</th>
              <th>Filename</th>
              <th>Size</th>
              <th className="col-updated">Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows count={4} cols={5} /> :
              filtered.length === 0 ? (
                <tr><td colSpan={5}>
                  <EmptyState icon="clock" title="No cron jobs yet" body="Upload a cron job script to get started." />
                </td></tr>
              ) : filtered.map(job => (
                <tr key={job.id}>
                  <td>
                    <span className="cell-name">{job.name}</span>
                    {job.description && <div className="small muted">{job.description}</div>}
                  </td>
                  <td className="small">{job.filename}</td>
                  <td className="small muted">{formatBytes(job.file_size)}</td>
                  <td><span className="muted small">{new Date(job.created_at).toLocaleString()}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn ghost"
                        onClick={() => handleDownload(job)}
                        disabled={downloading === job.id}
                        title="Download"
                      >
                        <Icon name="download" />
                      </button>
                      {hasEditAccess(job.client_id) && (
                        confirmDelete === job.id ? (
                          <>
                            <button className="btn accent" onClick={() => handleDelete(job.id)}>Confirm</button>
                            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn ghost" onClick={() => setConfirmDelete(job.id)} title="Delete">
                            <Icon name="trash" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Upload Cron Job</h2>
            {formError && <div className="callout danger small" style={{ marginBottom: 14 }}>{formError}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Client</label>
              <select
                className="select"
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              >
                <option value="">Select client…</option>
                {editableClients.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Name</label>
              <input
                type="text"
                placeholder="e.g. Nightly Data Sync"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Description</label>
              <input
                type="text"
                placeholder="Optional description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>File</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn accent" onClick={handleUpload} disabled={saving}>
                {saving ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors for `CronJobs.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CronJobs.tsx
git commit -m "feat: add CronJobs page with upload, download, delete"
```

---

### Task 14: CronJobs test

**Files:**
- Create: `frontend/src/pages/CronJobs.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CronJobs } from './CronJobs'

vi.mock('../context/ClientContext', () => ({
  useClients: () => ({
    clients: [
      { id: 'c1', code: 'INFY', name: 'Infosys', description: null, created_at: '' },
    ],
  }),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    hasEditAccess: () => true,
  }),
}))

vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const { getCronJobs } = vi.hoisted(() => ({
  getCronJobs: vi.fn(async () => []),
}))

vi.mock('../api/client', () => ({
  getCronJobs,
  uploadCronJob: vi.fn(),
  downloadCronJob: vi.fn(),
  deleteCronJob: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <CronJobs />
    </MemoryRouter>
  )
}

describe('CronJobs', () => {
  beforeEach(() => {
    getCronJobs.mockResolvedValue([])
  })

  it('renders the page title', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Cron Jobs')).toBeInTheDocument())
  })

  it('shows empty state when no jobs', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/No cron jobs yet/i)).toBeInTheDocument())
  })

  it('shows jobs when loaded', async () => {
    getCronJobs.mockResolvedValue([{
      id: 'j1',
      client_id: 'c1',
      name: 'Nightly Sync',
      description: null,
      filename: 'sync.sh',
      file_size: 512,
      mime_type: 'application/x-sh',
      uploaded_by: null,
      created_at: new Date().toISOString(),
    }])
    renderPage()
    await waitFor(() => expect(screen.getByText('Nightly Sync')).toBeInTheDocument())
    expect(screen.getByText('sync.sh')).toBeInTheDocument()
  })

  it('shows upload button for users with edit access', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/Upload Cron Job/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd frontend
npm test -- CronJobs
```

Expected: all 4 tests `PASSED`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CronJobs.test.tsx
git commit -m "test: add CronJobs page tests"
```

---

### Task 15: App routes + full verification

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add imports to `frontend/src/App.tsx`**

Add after the existing page imports:

```typescript
import { KnowledgeBase } from './pages/KnowledgeBase'
import { CronJobs } from './pages/CronJobs'
```

- [ ] **Step 2: Add routes inside `createAppRouter()`, after the `deployments` route**

```tsx
{ path: 'knowledge', element: <Navigate to="/knowledge/integrations" replace /> },
{ path: 'knowledge/:category', element: <KnowledgeBase /> },
{ path: 'cron-jobs', element: <CronJobs /> },
```

- [ ] **Step 3: Run full frontend test suite**

```bash
cd frontend
npm test
```

Expected: all tests `PASSED`.

- [ ] **Step 4: Build to verify TypeScript compilation**

```bash
cd frontend
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Run full backend test suite**

```bash
cd backend
pytest -v
```

Expected: all tests `PASSED`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire Knowledge Base and Cron Jobs routes into the app"
```
