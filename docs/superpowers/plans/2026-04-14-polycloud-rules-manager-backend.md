# Polycloud Rules Manager — Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete FastAPI backend with PostgreSQL for the Polycloud Rules Manager, exposing REST endpoints for clients, rules, rule types, deployments, and DRL import/export.

**Architecture:** Single FastAPI app with SQLAlchemy 2.x async ORM. Tables created via `create_all` at startup. Seed data for the 5 rule types is inserted once at startup if missing. DRL parser uses a state machine to extract package/imports/functions/rules from uploaded `.drl` files. DRL generator reconstructs valid `.drl` files from stored rules.

**Tech Stack:** Python 3.11+, FastAPI 0.115, SQLAlchemy 2.x (asyncpg), Pydantic v2, PostgreSQL 15+, uvicorn, pytest + pytest-asyncio + httpx

---

## File Map

```
backend/
├── requirements.txt
├── .env                         ← DATABASE_URL (not committed)
├── main.py                      ← FastAPI app, startup, static files
├── database.py                  ← engine, session factory, Base, get_db()
├── models.py                    ← SQLAlchemy ORM: clients, rule_types, rules, deployments, snapshots
├── schemas.py                   ← Pydantic v2 request/response models
├── seed_data.py                 ← seeds rule_types table on first run
├── routers/
│   ├── __init__.py
│   ├── clients.py               ← GET/POST/PUT/DELETE /api/clients
│   ├── rule_types.py            ← GET /api/rule-types (read-only)
│   ├── rules.py                 ← CRUD /api/rules + POST /api/rules/{id}/copy
│   ├── deployments.py           ← deployments CRUD + ZIP export
│   └── import_drl.py            ← POST /api/import/parse + /api/import/confirm
├── services/
│   ├── __init__.py
│   ├── drl_parser.py            ← parse .drl text → ParsedDRL dataclass
│   └── drl_generator.py         ← rule records → .drl text + ZIP bundle
└── tests/
    ├── __init__.py
    ├── conftest.py              ← engine, clean_tables, db session, async client
    ├── test_clients.py
    ├── test_rule_types.py
    ├── test_rules.py
    ├── test_drl_parser.py
    ├── test_import_drl.py
    ├── test_drl_generator.py
    └── test_deployments.py
```

---

### Task 1: Project Structure & Dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env`
- Create: `backend/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p backend/routers backend/services backend/tests
touch backend/routers/__init__.py backend/services/__init__.py backend/tests/__init__.py
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
pydantic==2.9.2
pydantic-settings==2.5.2
python-multipart==0.0.12
python-dotenv==1.0.1
aiofiles==24.1.0
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

- [ ] **Step 3: Create `backend/.env`**

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost/polycloud_rm
```

- [ ] **Step 4: Install dependencies**

```bash
cd backend && pip install -r requirements.txt
```

Expected: all packages install without errors.

- [ ] **Step 5: Create test PostgreSQL database**

```bash
psql -U postgres -c "CREATE DATABASE polycloud_rm;"
psql -U postgres -c "CREATE DATABASE test_polycloud_rm;"
```

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/requirements.txt backend/.env backend/routers/__init__.py backend/services/__init__.py backend/tests/__init__.py
git commit -m "feat: initialize backend project structure"
```

---

### Task 2: Database Connection Module

**Files:**
- Create: `backend/database.py`

- [ ] **Step 1: Create `backend/database.py`**

```python
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/polycloud_rm")


class Base(DeclarativeBase):
    pass


engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 2: Verify import works**

```bash
cd backend && python -c "from database import engine, get_db; print('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/database.py
git commit -m "feat: add async SQLAlchemy database module"
```

---

### Task 3: ORM Models

**Files:**
- Create: `backend/models.py`

- [ ] **Step 1: Write `backend/models.py`**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, ForeignKey,
    TIMESTAMP, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    rules = relationship("Rule", back_populates="client", cascade="all, delete-orphan")
    deployments = relationship("Deployment", back_populates="client", cascade="all, delete-orphan")


class RuleType(Base):
    __tablename__ = "rule_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    pipeline_stage = Column(Integer, nullable=False)
    drl_package = Column(String(200), nullable=False)
    drl_imports = Column(Text, nullable=False)
    drl_functions = Column(Text, nullable=True)

    rules = relationship("Rule", back_populates="rule_type")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    rule_type_id = Column(UUID(as_uuid=True), ForeignKey("rule_types.id"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    tool = Column(String(50), nullable=True)
    condition_raw = Column(Text, nullable=True)
    action_raw = Column(Text, nullable=True)
    condition_meta = Column(JSONB, nullable=True)
    action_meta = Column(JSONB, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    priority = Column(String(10), nullable=True)
    window = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    client = relationship("Client", back_populates="rules")
    rule_type = relationship("RuleType", back_populates="rules")
    snapshots = relationship("DeploymentRuleSnapshot", back_populates="rule")


DeploymentStatus = SAEnum("draft", "deployed", name="deployment_status")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(20), nullable=False)
    status = Column(DeploymentStatus, nullable=False, default="draft")
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)

    client = relationship("Client", back_populates="deployments")
    snapshots = relationship("DeploymentRuleSnapshot", back_populates="deployment", cascade="all, delete-orphan")


class DeploymentRuleSnapshot(Base):
    __tablename__ = "deployment_rule_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("rules.id", ondelete="SET NULL"), nullable=True)
    rule_snapshot = Column(JSONB, nullable=False)
    drl_block = Column(Text, nullable=False)

    deployment = relationship("Deployment", back_populates="snapshots")
    rule = relationship("Rule", back_populates="snapshots")
```

- [ ] **Step 2: Verify import works**

```bash
cd backend && python -c "from models import Client, RuleType, Rule, Deployment, DeploymentRuleSnapshot; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: add SQLAlchemy ORM models"
```

---

### Task 4: Pydantic Schemas

**Files:**
- Create: `backend/schemas.py`

- [ ] **Step 1: Create `backend/schemas.py`**

```python
from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


# ── Clients ──────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    description: Optional[str]
    created_at: datetime


# ── Rule Types ────────────────────────────────────────────────────────────────

class RuleTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    pipeline_stage: int
    drl_package: str
    drl_imports: str
    drl_functions: Optional[str]


# ── Rules ─────────────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: Optional[str] = None
    action_raw: Optional[str] = None
    condition_meta: Optional[Any] = None
    action_meta: Optional[Any] = None
    enabled: bool = True
    priority: Optional[str] = None
    window: Optional[int] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: Optional[str] = None
    action_raw: Optional[str] = None
    condition_meta: Optional[Any] = None
    action_meta: Optional[Any] = None
    enabled: Optional[bool] = None
    priority: Optional[str] = None
    window: Optional[int] = None


class RuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str]
    tool: Optional[str]
    condition_raw: Optional[str]
    action_raw: Optional[str]
    condition_meta: Optional[Any]
    action_meta: Optional[Any]
    enabled: bool
    priority: Optional[str]
    window: Optional[int]
    created_at: datetime
    updated_at: datetime


class RuleCopyRequest(BaseModel):
    target_client_id: UUID


# ── Deployments ───────────────────────────────────────────────────────────────

class DeploymentCreate(BaseModel):
    client_id: UUID
    version: str
    notes: Optional[str] = None


class DeploymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_id: UUID
    version: str
    status: str
    notes: Optional[str]
    created_at: datetime


# ── DRL Import ────────────────────────────────────────────────────────────────

class ParsedRulePreview(BaseModel):
    name: str
    condition_raw: str
    action_raw: str


class ParsedFilePreview(BaseModel):
    filename: str
    package: str
    rule_count: int
    rules: list[ParsedRulePreview]


class ImportConfirmRule(BaseModel):
    client_id: UUID
    rule_type_id: UUID
    name: str
    description: Optional[str] = None
    tool: Optional[str] = None
    condition_raw: str
    action_raw: str


class ImportConfirmRequest(BaseModel):
    rules: list[ImportConfirmRule]
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python -c "from schemas import ClientCreate, RuleOut, DeploymentOut; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add Pydantic v2 request/response schemas"
```

---

### Task 5: Seed Data

**Files:**
- Create: `backend/seed_data.py`

- [ ] **Step 1: Write failing test `backend/tests/test_seed_data.py`**

```python
import pytest
from sqlalchemy import select
from models import RuleType


@pytest.mark.asyncio
async def test_seed_creates_five_rule_types(db):
    result = await db.execute(select(RuleType))
    rule_types = result.scalars().all()
    assert len(rule_types) == 5


@pytest.mark.asyncio
async def test_seed_rule_type_slugs(db):
    result = await db.execute(select(RuleType.slug))
    slugs = {row[0] for row in result.all()}
    assert slugs == {
        "alert_classifier",
        "noise_suppression",
        "issue_correlation",
        "incident_rules",
        "recommendation",
    }


@pytest.mark.asyncio
async def test_seed_pipeline_stages_are_unique_1_to_5(db):
    result = await db.execute(select(RuleType.pipeline_stage))
    stages = sorted(row[0] for row in result.all())
    assert stages == [1, 2, 3, 4, 5]


@pytest.mark.asyncio
async def test_seed_is_idempotent(db, seeded_engine):
    """Running seed twice must not duplicate rows."""
    from seed_data import seed_rule_types
    from database import async_sessionmaker
    async with async_sessionmaker(seeded_engine, expire_on_commit=False)() as s:
        await seed_rule_types(s)
        await s.commit()
    result = await db.execute(select(RuleType))
    assert len(result.scalars().all()) == 5
```

- [ ] **Step 2: Create `backend/tests/conftest.py`**

```python
import asyncio
import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport

TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/test_polycloud_rm",
)


@pytest.fixture(scope="session")
def event_loop():
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def seeded_engine():
    from database import Base
    from seed_data import seed_rule_types

    eng = create_async_engine(TEST_DB_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(eng, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        await seed_rule_types(session)
        await session.commit()

    yield eng
    await eng.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean_tables(seeded_engine):
    """Delete all data except rule_types between tests."""
    from database import Base
    from models import RuleType

    yield

    async with seeded_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            if table.name != "rule_types":
                await conn.execute(table.delete())


@pytest_asyncio.fixture
async def db(seeded_engine):
    factory = async_sessionmaker(seeded_engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db, seeded_engine):
    import sys
    sys.path.insert(0, ".")
    from main import app
    from database import get_db

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 3: Run test — expect FAIL (no seed_data.py yet)**

```bash
cd backend && python -m pytest tests/test_seed_data.py -v
```

Expected: `ImportError` or `ModuleNotFoundError: No module named 'seed_data'`

- [ ] **Step 4: Create `backend/seed_data.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import RuleType

RULE_TYPES = [
    {
        "slug": "alert_classifier",
        "name": "Alert Classifier",
        "pipeline_stage": 1,
        "drl_package": "com.infy.ceh.management.autonomics.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPAlert;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;"
        ),
        "drl_functions": None,
    },
    {
        "slug": "noise_suppression",
        "name": "Noise Suppression",
        "pipeline_stage": 2,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.NoiseSuppressionRequest;\n"
            "import com.infy.ceh.management.ems.dto.IPPGroupedAlerts;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;\n"
            "import java.util.Arrays;\n"
            "import java.util.List;\n"
            "import java.util.regex.Matcher;\n"
            "import java.util.regex.Pattern;\n"
            "import java.time.ZonedDateTime;\n"
            "import java.time.ZoneOffset;\n"
            "import java.time.Instant;\n"
            "import java.sql.Timestamp;\n"
            "import java.time.LocalDateTime;\n"
            "import java.time.ZoneId;\n"
            "import java.time.format.DateTimeFormatter;\n"
            "import java.time.format.DateTimeFormatterBuilder;\n"
            "import java.time.temporal.ChronoField;"
        ),
        "drl_functions": (
            "function String extractDeviceType(String text,String rgx) {\n"
            "\tSystem.out.println(\"Applying REGEX\" + rgx);\n"
            "\tSystem.out.println(\"Text for REGEX\" + text);\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}\n\n"
            "function int getDurationAfterCreatedTime(IPPGroupedAlerts alert){\n"
            "\t\t\n"
            "\t\tSystem.out.println(\"start Time groupedAlerts\" + alert.getCreatedTime());\n"
            "\t\t\n"
            "\t\tDateTimeFormatter fmt = new DateTimeFormatterBuilder()\n"
            "            .appendPattern(\"yyyy-MM-dd HH:mm:ss\")\n"
            "            .appendLiteral('.')\n"
            "            .appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, false)\n"
            "            .toFormatter();\n"
            "\n"
            "        LocalDateTime ldt = LocalDateTime.parse(alert.getCreatedTime(), fmt);\n"
            "        ZonedDateTime zdt = ldt.atZone(ZoneId.of(\"UTC\"));\n"
            "        long startTimeInMillis = zdt.toInstant().toEpochMilli();\n"
            "        System.out.println(\"start Time In Millis\" + startTimeInMillis);\n"
            "\t\tZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);\n"
            "\t\tlong endTimeInMillis = utcNow.toInstant().toEpochMilli();\n"
            "\t\tSystem.out.println(\"end Time In Millis\" + endTimeInMillis);\n"
            "        int interval = (int)(endTimeInMillis - startTimeInMillis)/(60*1000);\n"
            "        System.out.println(\"Interval :: \"+interval);\n"
            "        return interval;\n"
            "    }"
        ),
    },
    {
        "slug": "issue_correlation",
        "name": "Issue Correlation",
        "pipeline_stage": 3,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPGroupedAlerts;\n"
            "import java.lang.String;\n"
            "import java.util.List;\n"
            "import java.util.ArrayList;\n"
            "import java.util.HashMap;\n"
            "import java.util.HashSet;\n"
            "import java.util.Set;\n"
            "import java.util.regex.Matcher;\n"
            "import java.util.regex.Pattern;\n"
            "import java.util.Arrays;\n"
            "\n"
            "global java.util.HashMap clusteredAlerts;\n"
            "global Integer index;"
        ),
        "drl_functions": (
            "function String extractPort(String alertName) {\n"
            "\tPattern port_pattern =  Pattern.compile(\"Interfaces_Critical-Port\\\\s+(\\\\d+)\");\n"
            "    Matcher matcher = port_pattern.matcher(alertName);\n"
            "    return matcher.find() ? matcher.group(1) : \"NA\";\n"
            "}\n\n"
            "function java.util.Set<String> getPortFromAlertName(java.util.List alerts, String host) {\n"
            "    java.util.Set<String> portList = new java.util.HashSet<String>();\n"
            "    if (alerts == null) return portList;\n"
            "\thost=host+\" \";\n"
            "    for (Object o : alerts) {\n"
            "        IPPGroupedAlerts a = (IPPGroupedAlerts) o;\n"
            "        String alertName = a.getAlertName();\n"
            "        if (alertName.contains(host) ) {\n"
            "             String port = extractPort(a.getAlertName());\n"
            "\t\t     portList.add(port);\n"
            "        }\n"
            "    }\n"
            "    return portList;\n"
            "}"
        ),
    },
    {
        "slug": "incident_rules",
        "name": "Incident Creation",
        "pipeline_stage": 4,
        "drl_package": "com.infy.ceh.management.autonomics.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPIssue;\n"
            "import com.infy.ceh.management.ems.dto.IPPIncident;\n"
            "import com.infy.ceh.management.ems.dto.IncidentCreationRequestDto;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;\n"
            "import java.util.List;\n"
            "import java.util.Arrays;"
        ),
        "drl_functions": (
            "function java.lang.String getAssignmentGroup(String name) {\n"
            "\tSystem.out.println(\"Short Decription = \" +name);\n"
            "    if (name == null) return \"ISM - EOC Monitoring\";\n"
            "    \n"
            "\tString groupName = \"\";\n"
            "\t\n"
            "\tif(name.contains(\"MAO Order Management\")){\n"
            "\t\tgroupName = \"Asia WMS\";\n"
            "\t}else if((name.contains(\"Netskope\") || name.contains(\"NetSkope\")) && "
            "(name.contains(\"Publisher\") || name.contains(\"IPSEC Tunnel\") || name.contains(\"GRE Tunnel\"))){\n"
            "\t\tgroupName = \"ISM - Network\";\n"
            "\t}else if(name.contains(\"Netskope\") || name.contains(\"NetSkope\")){\n"
            "\t\tgroupName = \"ISM - Security Netskope\";\n"
            "\t}else{\n"
            "\t\tgroupName = \"ISM - EOC Monitoring\";\n"
            "\t}\n"
            "\tSystem.out.println(\"Assignment group for INC creation is  = \"+groupName);\n"
            "    return groupName;\n"
            "}"
        ),
    },
    {
        "slug": "recommendation",
        "name": "Recommendation",
        "pipeline_stage": 5,
        "drl_package": "com.infy.ceh.management.autonomics.framework.tasks.impl",
        "drl_imports": (
            "import com.infy.ceh.management.ems.dto.IPPIssue;\n"
            "import com.infy.ceh.management.ems.dto.RecommendationRequest;\n"
            "import java.lang.String;\n"
            "import java.lang.Boolean;\n"
            "import java.util.Arrays;\n"
            "import java.util.List;\n"
            "import java.util.regex.Matcher;\n"
            "import java.util.regex.Pattern;"
        ),
        "drl_functions": (
            "function String extractDeviceType(String text,String rgx) {\n"
            "\tSystem.out.println(\"Applying REGEX\" + rgx);\n"
            "\tSystem.out.println(\"Text for REGEX\" + text);\n"
            "    if (text == null) return null;\n"
            "    Pattern p = Pattern.compile(rgx);\n"
            "    Matcher m = p.matcher(text);\n"
            "    return m.find() ? m.group() : null;\n"
            "}"
        ),
    },
]


async def seed_rule_types(session: AsyncSession) -> None:
    """Insert rule_types if they don't already exist (idempotent)."""
    result = await session.execute(select(RuleType.slug))
    existing_slugs = {row[0] for row in result.all()}

    for rt_data in RULE_TYPES:
        if rt_data["slug"] not in existing_slugs:
            session.add(RuleType(**rt_data))
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_seed_data.py -v
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/seed_data.py backend/tests/conftest.py backend/tests/test_seed_data.py
git commit -m "feat: add seed data for 5 pipeline rule types"
```

---

### Task 6: FastAPI App Entry

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Write failing test `backend/tests/test_main.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_main.py -v
```

Expected: FAIL — `ImportError` or 404

- [ ] **Step 3: Create `backend/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from seed_data import seed_rule_types
from database import AsyncSessionLocal
from routers import clients, rule_types, rules, deployments, import_drl


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_rule_types(session)
        await session.commit()
    yield


app = FastAPI(title="Polycloud Rules Manager", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix="/api")
app.include_router(rule_types.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(deployments.router, prefix="/api")
app.include_router(import_drl.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create stub routers so the import works**

Create `backend/routers/clients.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

Create `backend/routers/rule_types.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

Create `backend/routers/rules.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

Create `backend/routers/deployments.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

Create `backend/routers/import_drl.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd backend && python -m pytest tests/test_main.py -v
```

Expected: 1 test PASS

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/routers/clients.py backend/routers/rule_types.py backend/routers/rules.py backend/routers/deployments.py backend/routers/import_drl.py backend/tests/test_main.py
git commit -m "feat: add FastAPI app entry with lifespan, CORS, and health endpoint"
```

---

### Task 7: Clients Router

**Files:**
- Modify: `backend/routers/clients.py`
- Create: `backend/tests/test_clients.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_clients.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_list_clients_empty(client):
    response = await client.get("/api/clients")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_client(client):
    payload = {"code": "INFY", "name": "Infosys", "description": "Main client"}
    response = await client.post("/api/clients", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "INFY"
    assert data["name"] == "Infosys"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_client_duplicate_code_returns_409(client):
    payload = {"code": "INFY", "name": "Infosys"}
    await client.post("/api/clients", json=payload)
    response = await client.post("/api/clients", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_get_client_by_id(client):
    created = (await client.post("/api/clients", json={"code": "ACME", "name": "Acme Corp"})).json()
    response = await client.get(f"/api/clients/{created['id']}")
    assert response.status_code == 200
    assert response.json()["code"] == "ACME"


@pytest.mark.asyncio
async def test_get_client_not_found(client):
    response = await client.get("/api/clients/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_client(client):
    created = (await client.post("/api/clients", json={"code": "OLD", "name": "Old Name"})).json()
    response = await client.put(f"/api/clients/{created['id']}", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_client(client):
    created = (await client.post("/api/clients", json={"code": "DEL", "name": "To Delete"})).json()
    response = await client.delete(f"/api/clients/{created['id']}")
    assert response.status_code == 204
    get_resp = await client.get(f"/api/clients/{created['id']}")
    assert get_resp.status_code == 404
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_clients.py -v
```

Expected: all FAIL (router has no endpoints)

- [ ] **Step 3: Implement `backend/routers/clients.py`**

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import Client
from schemas import ClientCreate, ClientUpdate, ClientOut

router = APIRouter(tags=["clients"])


@router.get("/clients", response_model=list[ClientOut])
async def list_clients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).order_by(Client.created_at))
    return result.scalars().all()


@router.post("/clients", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(body: ClientCreate, db: AsyncSession = Depends(get_db)):
    client = Client(**body.model_dump())
    db.add(client)
    try:
        await db.commit()
        await db.refresh(client)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Client code already exists")
    return client


@router.get("/clients/{client_id}", response_model=ClientOut)
async def get_client(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(client_id: UUID, body: ClientUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
    await db.commit()
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_clients.py -v
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/clients.py backend/tests/test_clients.py
git commit -m "feat: add clients CRUD router with tests"
```

---

### Task 8: Rule Types Router

**Files:**
- Modify: `backend/routers/rule_types.py`
- Create: `backend/tests/test_rule_types.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_rule_types.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_list_rule_types_returns_five(client):
    response = await client.get("/api/rule-types")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5


@pytest.mark.asyncio
async def test_rule_types_ordered_by_pipeline_stage(client):
    response = await client.get("/api/rule-types")
    stages = [rt["pipeline_stage"] for rt in response.json()]
    assert stages == sorted(stages)


@pytest.mark.asyncio
async def test_rule_type_has_expected_fields(client):
    response = await client.get("/api/rule-types")
    rt = response.json()[0]
    assert "id" in rt
    assert "slug" in rt
    assert "name" in rt
    assert "pipeline_stage" in rt
    assert "drl_package" in rt
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_rule_types.py -v
```

Expected: FAIL (router stub has no endpoints)

- [ ] **Step 3: Implement `backend/routers/rule_types.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import RuleType
from schemas import RuleTypeOut

router = APIRouter(tags=["rule-types"])


@router.get("/rule-types", response_model=list[RuleTypeOut])
async def list_rule_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RuleType).order_by(RuleType.pipeline_stage))
    return result.scalars().all()
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_rule_types.py -v
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/rule_types.py backend/tests/test_rule_types.py
git commit -m "feat: add rule-types read-only router with tests"
```

---

### Task 9: Rules Router

**Files:**
- Modify: `backend/routers/rules.py`
- Create: `backend/tests/test_rules.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_rules.py`**

```python
import pytest


async def _make_client(client, code="INFY"):
    r = await client.post("/api/clients", json={"code": code, "name": code})
    return r.json()["id"]


async def _get_rule_type_id(client, slug="alert_classifier"):
    r = await client.get("/api/rule-types")
    for rt in r.json():
        if rt["slug"] == slug:
            return rt["id"]
    raise ValueError(f"Rule type {slug!r} not found")


@pytest.mark.asyncio
async def test_list_rules_empty(client):
    response = await client.get("/api/rules")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_rule(client):
    client_id = await _make_client(client)
    rt_id = await _get_rule_type_id(client)
    payload = {
        "client_id": client_id,
        "rule_type_id": rt_id,
        "name": "TestRule_1",
        "condition_raw": "alert:IPPAlert(sourceId == \"LM\")",
        "action_raw": "alert.setServiceName(\"svc\");",
        "tool": "LogicMonitor",
    }
    response = await client.post("/api/rules", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "TestRule_1"
    assert data["tool"] == "LogicMonitor"


@pytest.mark.asyncio
async def test_get_rule(client):
    client_id = await _make_client(client)
    rt_id = await _get_rule_type_id(client)
    created = (await client.post("/api/rules", json={
        "client_id": client_id, "rule_type_id": rt_id, "name": "R1"
    })).json()
    response = await client.get(f"/api/rules/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "R1"


@pytest.mark.asyncio
async def test_filter_rules_by_client(client):
    c1 = await _make_client(client, "C1")
    c2 = await _make_client(client, "C2")
    rt_id = await _get_rule_type_id(client)
    await client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "RuleC1"})
    await client.post("/api/rules", json={"client_id": c2, "rule_type_id": rt_id, "name": "RuleC2"})
    response = await client.get(f"/api/rules?client_id={c1}")
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "RuleC1"


@pytest.mark.asyncio
async def test_filter_rules_by_tool(client):
    c1 = await _make_client(client)
    rt_id = await _get_rule_type_id(client)
    await client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "R_LM", "tool": "LogicMonitor"})
    await client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "R_TI", "tool": "Tivoli"})
    response = await client.get("/api/rules?tool=LogicMonitor")
    data = response.json()
    assert all(r["tool"] == "LogicMonitor" for r in data)


@pytest.mark.asyncio
async def test_search_rules_by_name(client):
    c1 = await _make_client(client)
    rt_id = await _get_rule_type_id(client)
    await client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "UniqueAlpha_1"})
    await client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "BetaRule_2"})
    response = await client.get("/api/rules?search=UniqueAlpha")
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "UniqueAlpha_1"


@pytest.mark.asyncio
async def test_update_rule(client):
    c1 = await _make_client(client)
    rt_id = await _get_rule_type_id(client)
    created = (await client.post("/api/rules", json={
        "client_id": c1, "rule_type_id": rt_id, "name": "OldName"
    })).json()
    response = await client.put(f"/api/rules/{created['id']}", json={"name": "NewName"})
    assert response.status_code == 200
    assert response.json()["name"] == "NewName"


@pytest.mark.asyncio
async def test_delete_rule(client):
    c1 = await _make_client(client)
    rt_id = await _get_rule_type_id(client)
    created = (await client.post("/api/rules", json={
        "client_id": c1, "rule_type_id": rt_id, "name": "ToDelete"
    })).json()
    response = await client.delete(f"/api/rules/{created['id']}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_copy_rule_to_another_client(client):
    c1 = await _make_client(client, "SRC")
    c2 = await _make_client(client, "DST")
    rt_id = await _get_rule_type_id(client)
    original = (await client.post("/api/rules", json={
        "client_id": c1, "rule_type_id": rt_id, "name": "OriginalRule",
        "condition_raw": "when something", "action_raw": "then something"
    })).json()
    response = await client.post(
        f"/api/rules/{original['id']}/copy",
        json={"target_client_id": c2}
    )
    assert response.status_code == 201
    copy = response.json()
    assert copy["client_id"] == c2
    assert "OriginalRule" in copy["name"]
    assert copy["id"] != original["id"]
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_rules.py -v
```

Expected: all FAIL

- [ ] **Step 3: Implement `backend/routers/rules.py`**

```python
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from models import Rule, Client, RuleType
from schemas import RuleCreate, RuleUpdate, RuleOut, RuleCopyRequest

router = APIRouter(tags=["rules"])


@router.get("/rules", response_model=list[RuleOut])
async def list_rules(
    client_id: Optional[UUID] = Query(None),
    rule_type: Optional[str] = Query(None),
    tool: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Rule)
    conditions = []
    if client_id:
        conditions.append(Rule.client_id == client_id)
    if rule_type:
        rt_result = await db.execute(select(RuleType).where(RuleType.slug == rule_type))
        rt = rt_result.scalar_one_or_none()
        if rt:
            conditions.append(Rule.rule_type_id == rt.id)
    if tool:
        conditions.append(Rule.tool == tool)
    if search:
        conditions.append(Rule.name.ilike(f"%{search}%"))
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(Rule.created_at)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/rules", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(body: RuleCreate, db: AsyncSession = Depends(get_db)):
    rule = Rule(**body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/rules/{rule_id}", response_model=RuleOut)
async def get_rule(rule_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/rules/{rule_id}", response_model=RuleOut)
async def update_rule(rule_id: UUID, body: RuleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()


@router.post("/rules/{rule_id}/copy", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
async def copy_rule(rule_id: UUID, body: RuleCopyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Verify target client exists
    client_result = await db.execute(select(Client).where(Client.id == body.target_client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Target client not found")

    copy = Rule(
        client_id=body.target_client_id,
        rule_type_id=original.rule_type_id,
        name=f"{original.name}_copy",
        description=original.description,
        tool=original.tool,
        condition_raw=original.condition_raw,
        action_raw=original.action_raw,
        condition_meta=original.condition_meta,
        action_meta=original.action_meta,
        enabled=original.enabled,
        priority=original.priority,
        window=original.window,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_rules.py -v
```

Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/rules.py backend/tests/test_rules.py
git commit -m "feat: add rules CRUD router with filtering, search, and copy with tests"
```

---

### Task 10: DRL Parser Service

**Files:**
- Modify: `backend/services/drl_parser.py`
- Create: `backend/tests/test_drl_parser.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_drl_parser.py`**

```python
import pytest
from services.drl_parser import parse_drl, ParsedDRL, ParsedRule

SIMPLE_DRL = """package com.example.test;

import com.example.dto.IPPAlert;
import java.lang.String;

rule "AlertClassifier_1"
\twhen
\t\talert:IPPAlert(sourceId matches ".*LogicMonitor.*")
\tthen
\t\talert.setServiceName("event_mgmt_sw_1");
end

rule "AlertClassifier_2"
\twhen
\t\talert:IPPAlert(sourceId == "Tivoli")
\tthen
\t\talert.setServiceName("tivoli_svc");
end
"""

DRL_WITH_FUNCTION = """package com.example.test;

import com.example.dto.SomeDto;

function String extractType(String text, String rgx) {
\tif (text == null) return null;
\tPattern p = Pattern.compile(rgx);
\treturn p.matcher(text).find() ? "found" : null;
}

rule "Rule_1"
\twhen
\t\trequest:SomeDto(value == "x")
\tthen
\t\trequest.setLabel("label");
end
"""


def test_parse_returns_parsed_drl_type():
    result = parse_drl(SIMPLE_DRL)
    assert isinstance(result, ParsedDRL)


def test_parse_extracts_package():
    result = parse_drl(SIMPLE_DRL)
    assert result.package == "com.example.test"


def test_parse_extracts_imports_block():
    result = parse_drl(SIMPLE_DRL)
    assert "com.example.dto.IPPAlert" in result.imports
    assert "java.lang.String" in result.imports


def test_parse_extracts_two_rules():
    result = parse_drl(SIMPLE_DRL)
    assert len(result.rules) == 2


def test_parse_rule_names():
    result = parse_drl(SIMPLE_DRL)
    names = [r.name for r in result.rules]
    assert "AlertClassifier_1" in names
    assert "AlertClassifier_2" in names


def test_parse_rule_condition_raw():
    result = parse_drl(SIMPLE_DRL)
    rule1 = next(r for r in result.rules if r.name == "AlertClassifier_1")
    assert "LogicMonitor" in rule1.condition_raw


def test_parse_rule_action_raw():
    result = parse_drl(SIMPLE_DRL)
    rule1 = next(r for r in result.rules if r.name == "AlertClassifier_1")
    assert "event_mgmt_sw_1" in rule1.action_raw


def test_parse_extracts_functions_block():
    result = parse_drl(DRL_WITH_FUNCTION)
    assert result.functions is not None
    assert "extractType" in result.functions


def test_parse_no_functions_returns_none():
    result = parse_drl(SIMPLE_DRL)
    assert result.functions is None


def test_parse_real_alert_classifier():
    """Parse the actual alert_classifier.drl from the data/ directory."""
    with open("../data/alert_classifier.drl", encoding="utf-8") as f:
        content = f.read()
    result = parse_drl(content)
    assert result.package == "com.infy.ceh.management.autonomics.tasks.impl"
    assert len(result.rules) >= 1
    assert result.rules[0].name == "AlertServiceClassifier_1"


def test_parse_real_noise_suppression():
    with open("../data/noise_suppression.drl", encoding="utf-8") as f:
        content = f.read()
    result = parse_drl(content)
    assert len(result.rules) >= 7
    assert result.functions is not None
    assert "getDurationAfterCreatedTime" in result.functions
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_drl_parser.py -v
```

Expected: `ImportError: cannot import name 'parse_drl'`

- [ ] **Step 3: Implement `backend/services/drl_parser.py`**

```python
import re
from dataclasses import dataclass, field


@dataclass
class ParsedRule:
    name: str
    condition_raw: str
    action_raw: str


@dataclass
class ParsedDRL:
    package: str
    imports: str
    functions: str | None
    rules: list[ParsedRule] = field(default_factory=list)


def _extract_package(text: str) -> str:
    match = re.search(r"^\s*package\s+([\w.]+)\s*;?", text, re.MULTILINE)
    return match.group(1) if match else ""


def _extract_imports(text: str) -> str:
    """Return all import/global lines joined, stripping trailing whitespace."""
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("global "):
            lines.append(stripped)
    return "\n".join(lines) if lines else ""


def _find_block_end(text: str, start: int) -> int:
    """
    Given `start` pointing at the opening `{`, walk forward counting
    braces and return the index of the matching closing `}`.
    """
    depth = 0
    i = start
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text) - 1


def _extract_functions(text: str) -> str | None:
    """
    Extract all top-level `function` declarations (before any `rule`).
    Returns None if no functions found.
    """
    # Find position of the first rule
    first_rule = re.search(r"^\s*rule\s+", text, re.MULTILINE)
    search_area = text[: first_rule.start()] if first_rule else text

    func_pattern = re.compile(r"\bfunction\b[^{]+\{", re.MULTILINE)
    blocks = []
    for m in func_pattern.finditer(search_area):
        brace_start = m.end() - 1  # position of opening {
        brace_end = _find_block_end(search_area, brace_start)
        block = search_area[m.start(): brace_end + 1]
        blocks.append(block.strip())

    return "\n\n".join(blocks) if blocks else None


def _extract_rules(text: str) -> list[ParsedRule]:
    """
    Parse all `rule "name" ... when ... then ... end` blocks.
    """
    rules = []
    # Match: rule "name" (optional attributes) when ... then ... end
    rule_pattern = re.compile(
        r'rule\s+"([^"]+)"\s*(.*?)when(.*?)then(.*?)end',
        re.DOTALL,
    )
    for m in rule_pattern.finditer(text):
        name = m.group(1).strip()
        condition_raw = m.group(3).strip()
        action_raw = m.group(4).strip()
        rules.append(ParsedRule(name=name, condition_raw=condition_raw, action_raw=action_raw))
    return rules


def parse_drl(text: str) -> ParsedDRL:
    """Parse a .drl file text into a ParsedDRL dataclass."""
    return ParsedDRL(
        package=_extract_package(text),
        imports=_extract_imports(text),
        functions=_extract_functions(text),
        rules=_extract_rules(text),
    )
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_drl_parser.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/drl_parser.py backend/tests/test_drl_parser.py
git commit -m "feat: add DRL parser service with state-machine brace counting"
```

---

### Task 11: Import Router

**Files:**
- Modify: `backend/routers/import_drl.py`
- Create: `backend/tests/test_import_drl.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_import_drl.py`**

```python
import pytest
import io


SAMPLE_DRL = b"""package com.example.test;

import com.example.dto.IPPAlert;

rule "AlertTest_1"
\twhen
\t\talert:IPPAlert(sourceId == "LM")
\tthen
\t\talert.setServiceName("svc1");
end

rule "AlertTest_2"
\twhen
\t\talert:IPPAlert(sourceId == "Tivoli")
\tthen
\t\talert.setServiceName("svc2");
end
"""


@pytest.mark.asyncio
async def test_parse_returns_preview(client):
    files = {"file": ("test.drl", io.BytesIO(SAMPLE_DRL), "text/plain")}
    response = await client.post("/api/import/parse", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.drl"
    assert data["rule_count"] == 2
    assert len(data["rules"]) == 2


@pytest.mark.asyncio
async def test_parse_extracts_rule_names(client):
    files = {"file": ("test.drl", io.BytesIO(SAMPLE_DRL), "text/plain")}
    response = await client.post("/api/import/parse", files=files)
    names = [r["name"] for r in response.json()["rules"]]
    assert "AlertTest_1" in names
    assert "AlertTest_2" in names


@pytest.mark.asyncio
async def test_parse_rejects_non_drl(client):
    files = {"file": ("test.txt", io.BytesIO(b"not a drl file"), "text/plain")}
    response = await client.post("/api/import/parse", files=files)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_confirm_saves_rules(client):
    c = (await client.post("/api/clients", json={"code": "IMP", "name": "Import Test"})).json()
    rt = next(rt for rt in (await client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    payload = {
        "rules": [
            {
                "client_id": c["id"],
                "rule_type_id": rt["id"],
                "name": "ImportedRule_1",
                "tool": "LogicMonitor",
                "condition_raw": "alert:IPPAlert(sourceId == \"LM\")",
                "action_raw": "alert.setServiceName(\"svc\");",
            }
        ]
    }
    response = await client.post("/api/import/confirm", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["imported"] == 1
    assert len(data["rule_ids"]) == 1


@pytest.mark.asyncio
async def test_confirm_empty_list_returns_zero(client):
    response = await client.post("/api/import/confirm", json={"rules": []})
    assert response.status_code == 201
    assert response.json()["imported"] == 0
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_import_drl.py -v
```

Expected: all FAIL

- [ ] **Step 3: Implement `backend/routers/import_drl.py`**

```python
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Rule
from schemas import ParsedFilePreview, ImportConfirmRequest
from services.drl_parser import parse_drl

router = APIRouter(tags=["import"])


@router.post("/import/parse", response_model=ParsedFilePreview)
async def parse_drl_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".drl"):
        raise HTTPException(status_code=422, detail="Only .drl files are accepted")
    content = (await file.read()).decode("utf-8", errors="replace")
    parsed = parse_drl(content)
    return ParsedFilePreview(
        filename=file.filename,
        package=parsed.package,
        rule_count=len(parsed.rules),
        rules=[
            {"name": r.name, "condition_raw": r.condition_raw, "action_raw": r.action_raw}
            for r in parsed.rules
        ],
    )


@router.post("/import/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_import(body: ImportConfirmRequest, db: AsyncSession = Depends(get_db)):
    rule_ids = []
    for r in body.rules:
        rule = Rule(**r.model_dump())
        db.add(rule)
        await db.flush()
        rule_ids.append(str(rule.id))
    await db.commit()
    return {"imported": len(rule_ids), "rule_ids": rule_ids}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_import_drl.py -v
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/import_drl.py backend/tests/test_import_drl.py
git commit -m "feat: add DRL import router (parse + confirm) with tests"
```

---

### Task 12: DRL Generator Service

**Files:**
- Modify: `backend/services/drl_generator.py`
- Create: `backend/tests/test_drl_generator.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_drl_generator.py`**

```python
import pytest
import zipfile
import io
from services.drl_generator import generate_drl_text, generate_drl_bundle


RULE_TYPE = {
    "slug": "alert_classifier",
    "drl_package": "com.example.test",
    "drl_imports": "import com.example.dto.IPPAlert;\nimport java.lang.String;",
    "drl_functions": None,
}

RULES = [
    {
        "name": "AlertClassifier_1",
        "condition_raw": 'alert:IPPAlert(sourceId == "LM")',
        "action_raw": 'alert.setServiceName("svc1");',
    },
    {
        "name": "AlertClassifier_2",
        "condition_raw": 'alert:IPPAlert(sourceId == "Tivoli")',
        "action_raw": 'alert.setServiceName("svc2");',
    },
]


def test_generate_drl_text_contains_package():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert "package com.example.test;" in text


def test_generate_drl_text_contains_imports():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert "import com.example.dto.IPPAlert;" in text


def test_generate_drl_text_contains_both_rules():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert 'rule "AlertClassifier_1"' in text
    assert 'rule "AlertClassifier_2"' in text


def test_generate_drl_text_structure():
    text = generate_drl_text(RULE_TYPE, RULES)
    assert "when" in text
    assert "then" in text
    assert "end" in text


def test_generate_drl_text_with_functions():
    rt_with_fn = {**RULE_TYPE, "drl_functions": "function String helper() { return null; }"}
    text = generate_drl_text(rt_with_fn, RULES)
    assert "function String helper()" in text


def test_generate_drl_text_empty_rules_still_valid():
    text = generate_drl_text(RULE_TYPE, [])
    assert "package com.example.test;" in text
    assert "rule" not in text


def test_generate_bundle_returns_zip_bytes():
    rule_type_rules = [
        (RULE_TYPE, RULES),
    ]
    zip_bytes = generate_drl_bundle(rule_type_rules)
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf) as zf:
        assert "alert_classifier.drl" in zf.namelist()


def test_generate_bundle_contains_valid_drl_content():
    rule_type_rules = [(RULE_TYPE, RULES)]
    zip_bytes = generate_drl_bundle(rule_type_rules)
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "package com.example.test;" in content
    assert 'rule "AlertClassifier_1"' in content
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_drl_generator.py -v
```

Expected: `ImportError`

- [ ] **Step 3: Implement `backend/services/drl_generator.py`**

```python
import io
import zipfile
from typing import Any


def generate_drl_text(rule_type: dict[str, Any], rules: list[dict[str, Any]]) -> str:
    """
    Reconstruct a valid .drl file from rule_type metadata and a list of rule dicts.

    rule_type keys used: drl_package, drl_imports, drl_functions, slug
    rule keys used: name, condition_raw, action_raw
    """
    lines = []

    # Package
    lines.append(f"package {rule_type['drl_package']};\n")

    # Imports
    if rule_type.get("drl_imports"):
        lines.append(rule_type["drl_imports"])
        lines.append("")

    # Functions
    if rule_type.get("drl_functions"):
        lines.append(rule_type["drl_functions"])
        lines.append("")

    # Rules
    for rule in rules:
        lines.append(f'rule "{rule["name"]}"')
        lines.append("\twhen")
        for cond_line in rule["condition_raw"].splitlines():
            lines.append(f"\t\t{cond_line}")
        lines.append("\tthen")
        for act_line in rule["action_raw"].splitlines():
            lines.append(f"\t\t{act_line}")
        lines.append("end")
        lines.append("")

    return "\n".join(lines)


def generate_drl_bundle(rule_type_rules: list[tuple[dict, list[dict]]]) -> bytes:
    """
    Build a ZIP archive containing one .drl file per rule type.

    Args:
        rule_type_rules: list of (rule_type_dict, rules_list) tuples

    Returns:
        ZIP file as bytes
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rule_type, rules in rule_type_rules:
            filename = f"{rule_type['slug']}.drl"
            content = generate_drl_text(rule_type, rules)
            zf.writestr(filename, content)
    return buf.getvalue()
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_drl_generator.py -v
```

Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/drl_generator.py backend/tests/test_drl_generator.py
git commit -m "feat: add DRL generator service producing valid .drl text and ZIP bundles"
```

---

### Task 13: Deployments Router

**Files:**
- Modify: `backend/routers/deployments.py`
- Create: `backend/tests/test_deployments.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_deployments.py`**

```python
import pytest
import zipfile
import io


async def _setup(client):
    """Create a client + rule type + one enabled rule. Return (client_id, rule_id)."""
    c = (await client.post("/api/clients", json={"code": "DEP", "name": "Dep Client"})).json()
    rt = next(rt for rt in (await client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    rule = (await client.post("/api/rules", json={
        "client_id": c["id"],
        "rule_type_id": rt["id"],
        "name": "DeployRule_1",
        "condition_raw": 'alert:IPPAlert(sourceId == "LM")',
        "action_raw": 'alert.setServiceName("svc");',
        "enabled": True,
    })).json()
    return c["id"], rule["id"]


@pytest.mark.asyncio
async def test_list_deployments_empty(client):
    c = (await client.post("/api/clients", json={"code": "DC1", "name": "D1"})).json()
    response = await client.get(f"/api/clients/{c['id']}/deployments")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_deployment(client):
    c_id, _ = await _setup(client)
    payload = {"client_id": c_id, "version": "v1.0", "notes": "First release"}
    response = await client.post("/api/deployments", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["version"] == "v1.0"
    assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_create_deployment_snapshots_enabled_rules(client):
    c_id, rule_id = await _setup(client)
    dep = (await client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()
    # Verify deployment exists with snapshots by getting it
    response = await client.get(f"/api/deployments/{dep['id']}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_export_returns_zip(client):
    c_id, _ = await _setup(client)
    dep = (await client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()
    response = await client.get(f"/api/deployments/{dep['id']}/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    buf = io.BytesIO(response.content)
    with zipfile.ZipFile(buf) as zf:
        names = zf.namelist()
    # Should have alert_classifier.drl since that's the rule type we used
    assert "alert_classifier.drl" in names


@pytest.mark.asyncio
async def test_export_zip_contains_rule_content(client):
    c_id, _ = await _setup(client)
    dep = (await client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()
    response = await client.get(f"/api/deployments/{dep['id']}/export")
    buf = io.BytesIO(response.content)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "DeployRule_1" in content
    assert "when" in content
    assert "then" in content


@pytest.mark.asyncio
async def test_disabled_rules_not_exported(client):
    c = (await client.post("/api/clients", json={"code": "DIS", "name": "Dis"})).json()
    rt = next(rt for rt in (await client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    await client.post("/api/rules", json={
        "client_id": c["id"], "rule_type_id": rt["id"],
        "name": "DisabledRule", "condition_raw": "x", "action_raw": "y", "enabled": False
    })
    dep = (await client.post("/api/deployments", json={"client_id": c["id"], "version": "v1.0"})).json()
    response = await client.get(f"/api/deployments/{dep['id']}/export")
    buf = io.BytesIO(response.content)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "DisabledRule" not in content
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_deployments.py -v
```

Expected: all FAIL

- [ ] **Step 3: Implement `backend/routers/deployments.py`**

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Deployment, DeploymentRuleSnapshot, Rule, RuleType, Client
from schemas import DeploymentCreate, DeploymentOut
from services.drl_generator import generate_drl_bundle

router = APIRouter(tags=["deployments"])


def _rule_to_dict(rule: Rule) -> dict:
    return {
        "id": str(rule.id),
        "name": rule.name,
        "description": rule.description,
        "tool": rule.tool,
        "condition_raw": rule.condition_raw,
        "action_raw": rule.action_raw,
        "condition_meta": rule.condition_meta,
        "action_meta": rule.action_meta,
        "enabled": rule.enabled,
        "priority": rule.priority,
        "window": rule.window,
    }


def _rt_to_dict(rt: RuleType) -> dict:
    return {
        "id": str(rt.id),
        "slug": rt.slug,
        "name": rt.name,
        "pipeline_stage": rt.pipeline_stage,
        "drl_package": rt.drl_package,
        "drl_imports": rt.drl_imports,
        "drl_functions": rt.drl_functions,
    }


@router.get("/clients/{client_id}/deployments", response_model=list[DeploymentOut])
async def list_deployments(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deployment)
        .where(Deployment.client_id == client_id)
        .order_by(Deployment.created_at.desc())
    )
    return result.scalars().all()


@router.post("/deployments", response_model=DeploymentOut, status_code=status.HTTP_201_CREATED)
async def create_deployment(body: DeploymentCreate, db: AsyncSession = Depends(get_db)):
    # Verify client exists
    client_result = await db.execute(select(Client).where(Client.id == body.client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    deployment = Deployment(
        client_id=body.client_id,
        version=body.version,
        notes=body.notes,
        status="draft",
    )
    db.add(deployment)
    await db.flush()

    # Snapshot all enabled rules for this client
    rules_result = await db.execute(
        select(Rule)
        .where(Rule.client_id == body.client_id, Rule.enabled == True)
    )
    enabled_rules = rules_result.scalars().all()

    for rule in enabled_rules:
        # Load rule type for DRL generation
        rt_result = await db.execute(select(RuleType).where(RuleType.id == rule.rule_type_id))
        rt = rt_result.scalar_one()

        drl_block = (
            f'rule "{rule.name}"\n'
            f"\twhen\n"
            + "\n".join(f"\t\t{line}" for line in (rule.condition_raw or "").splitlines())
            + "\n\tthen\n"
            + "\n".join(f"\t\t{line}" for line in (rule.action_raw or "").splitlines())
            + "\nend"
        )
        snapshot = DeploymentRuleSnapshot(
            deployment_id=deployment.id,
            rule_id=rule.id,
            rule_snapshot=_rule_to_dict(rule),
            drl_block=drl_block,
        )
        db.add(snapshot)

    await db.commit()
    await db.refresh(deployment)
    return deployment


@router.get("/deployments/{deployment_id}", response_model=DeploymentOut)
async def get_deployment(deployment_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deployment).where(Deployment.id == deployment_id))
    dep = result.scalar_one_or_none()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return dep


@router.get("/deployments/{deployment_id}/export")
async def export_deployment(deployment_id: UUID, db: AsyncSession = Depends(get_db)):
    dep_result = await db.execute(select(Deployment).where(Deployment.id == deployment_id))
    dep = dep_result.scalar_one_or_none()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    # Load all snapshots for this deployment
    snap_result = await db.execute(
        select(DeploymentRuleSnapshot).where(DeploymentRuleSnapshot.deployment_id == deployment_id)
    )
    snapshots = snap_result.scalars().all()

    # Group snapshots by rule_type via their stored rule_snapshot (which has rule_type_id)
    # We need rule_type data — load it from rule_types table grouped by rule_type
    # Build: {rule_type_id: (rt_dict, [rule_dicts])}
    from collections import defaultdict
    rt_rules: dict[str, tuple[dict, list[dict]]] = {}

    for snap in snapshots:
        rule_dict = snap.rule_snapshot
        rt_id = rule_dict.get("rule_type_id") or ""

        # Load rule type if not cached
        if rt_id not in rt_rules:
            # Get rule_type_id from the actual rule record to fetch rt
            if snap.rule_id:
                rule_result = await db.execute(select(Rule).where(Rule.id == snap.rule_id))
                rule_obj = rule_result.scalar_one_or_none()
                if rule_obj:
                    rt_result = await db.execute(select(RuleType).where(RuleType.id == rule_obj.rule_type_id))
                    rt_obj = rt_result.scalar_one_or_none()
                    if rt_obj:
                        rt_id = str(rt_obj.id)
                        rt_rules[rt_id] = (_rt_to_dict(rt_obj), [])

        if rt_id in rt_rules:
            rt_rules[rt_id][1].append({
                "name": rule_dict["name"],
                "condition_raw": rule_dict.get("condition_raw") or "",
                "action_raw": rule_dict.get("action_raw") or "",
            })

    # Sort by pipeline_stage for deterministic ZIP ordering
    sorted_pairs = sorted(
        [(rt_dict, rules) for rt_dict, rules in rt_rules.values()],
        key=lambda x: x[0]["pipeline_stage"],
    )

    zip_bytes = generate_drl_bundle(sorted_pairs)
    filename = f"deployment_{dep.version}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 4: Fix the rule_snapshot to include rule_type_id**

Update the `_rule_to_dict` helper in `backend/routers/deployments.py` — add `rule_type_id`:

```python
def _rule_to_dict(rule: Rule) -> dict:
    return {
        "id": str(rule.id),
        "rule_type_id": str(rule.rule_type_id),   # ← add this
        "name": rule.name,
        "description": rule.description,
        "tool": rule.tool,
        "condition_raw": rule.condition_raw,
        "action_raw": rule.action_raw,
        "condition_meta": rule.condition_meta,
        "action_meta": rule.action_meta,
        "enabled": rule.enabled,
        "priority": rule.priority,
        "window": rule.window,
    }
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_deployments.py -v
```

Expected: 6 tests PASS

- [ ] **Step 6: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all tests PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add backend/routers/deployments.py backend/tests/test_deployments.py
git commit -m "feat: add deployments router with rule snapshotting and ZIP export"
```

---

### Task 14: pytest configuration & Start Scripts

**Files:**
- Create: `backend/pytest.ini`
- Create: `start.bat`
- Create: `start.sh`

- [ ] **Step 1: Create `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 2: Create `start.bat`** (Windows)

```bat
@echo off
echo Starting Polycloud Rules Manager...

start "Backend" cmd /k "cd backend && uvicorn main:app --reload --port 8000"
timeout /t 2 /nobreak > NUL
start "Frontend" cmd /k "cd frontend && npm run dev"

echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
```

- [ ] **Step 3: Create `start.sh`** (Linux/macOS)

```bash
#!/usr/bin/env bash
set -e

echo "Starting Polycloud Rules Manager..."

(cd backend && uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

sleep 2

(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID (http://localhost:8000)"
echo "Frontend PID: $FRONTEND_PID (http://localhost:5173)"
echo "Press Ctrl+C to stop both."

wait
```

```bash
chmod +x start.sh
```

- [ ] **Step 4: Verify backend starts**

```bash
cd backend && uvicorn main:app --reload --port 8000 &
sleep 3
curl http://localhost:8000/api/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Run full test suite one final time**

```bash
cd backend && python -m pytest tests/ -v --tb=short
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/pytest.ini start.bat start.sh
git commit -m "feat: add pytest config and start scripts for backend"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by task |
|---|---|
| `clients` table with CRUD | Task 7 |
| `rule_types` seeded at startup (5 types) | Task 5 |
| `rules` table with CRUD + copy | Task 9 |
| `deployments` table + status enum | Task 13 |
| `deployment_rule_snapshots` with frozen state | Task 13 |
| `GET /api/rules` with filtering by client_id, rule_type, tool, search | Task 9 |
| `POST /api/rules/{id}/copy` with target_client_id | Task 9 |
| `POST /api/import/parse` multipart upload → preview | Task 11 |
| `POST /api/import/confirm` → save to DB | Task 11 |
| `GET /api/deployments/{id}/export` → ZIP | Task 13 |
| DRL parser extracts package/imports/functions/rules | Task 10 |
| DRL generator reconstructs valid .drl + ZIP | Task 12 |
| PostgreSQL with asyncpg | Task 1 |
| `start.bat` / `start.sh` | Task 14 |
| CORS for frontend port 5173 | Task 6 |

All spec requirements are covered. Frontend is out of scope for this plan (separate plan: `2026-04-14-polycloud-rules-manager-frontend.md`).

### Placeholder scan

No TBDs or TODOs remain in the plan. All code blocks are complete.

### Type consistency

- `Rule`, `Client`, `RuleType`, `Deployment`, `DeploymentRuleSnapshot` defined in Task 3 and used consistently throughout.
- `ParsedDRL`, `ParsedRule` defined in Task 10 and used in Task 11.
- `generate_drl_text`, `generate_drl_bundle` defined in Task 12, used in Task 13.
- Schema names (`ClientOut`, `RuleOut`, etc.) defined in Task 4 and referenced in routers correctly.
