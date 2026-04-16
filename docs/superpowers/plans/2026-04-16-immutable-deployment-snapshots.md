# Immutable Deployment Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze rule-type metadata at deployment creation time so that exporting any deployment always produces the same ZIP, regardless of subsequent edits, deletions, or additions.

**Architecture:** Add two nullable JSONB columns — `rule_type_snapshot` on `DeploymentRuleSnapshot` and `rule_types_snapshot` on `Deployment` — populated at creation time. The export endpoint then reads only from those frozen columns, making zero live `Rule`/`RuleType` queries.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy async, PostgreSQL (asyncpg), pytest-asyncio, httpx AsyncClient.

---

## Files

- Modify: `backend/models.py` — add two JSONB columns
- Modify: `backend/routers/deployments.py` — update `create_deployment` and `export_deployment`
- Modify: `backend/tests/test_deployments.py` — add five new immutability tests

---

### Task 1: Add schema columns to models

**Files:**
- Modify: `backend/models.py:85-95` (DeploymentRuleSnapshot), `backend/models.py:71-83` (Deployment)

- [ ] **Step 1: Add `rule_type_snapshot` to `DeploymentRuleSnapshot`**

In `backend/models.py`, inside `class DeploymentRuleSnapshot`, add after `drl_block`:

```python
rule_type_snapshot = Column(JSONB, nullable=True)
```

The class body becomes:

```python
class DeploymentRuleSnapshot(Base):
    __tablename__ = "deployment_rule_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("rules.id", ondelete="SET NULL"), nullable=True)
    rule_snapshot = Column(JSONB, nullable=False)
    drl_block = Column(Text, nullable=False)
    rule_type_snapshot = Column(JSONB, nullable=True)

    deployment = relationship("Deployment", back_populates="snapshots")
    rule = relationship("Rule", back_populates="snapshots")
```

- [ ] **Step 2: Add `rule_types_snapshot` to `Deployment`**

In `backend/models.py`, inside `class Deployment`, add after `created_at`:

```python
rule_types_snapshot = Column(JSONB, nullable=True)
```

The class body becomes:

```python
class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(20), nullable=False)
    status = Column(DeploymentStatus, nullable=False, default="draft")
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=utcnow, nullable=False)
    rule_types_snapshot = Column(JSONB, nullable=True)

    client = relationship("Client", back_populates="deployments")
    snapshots = relationship("DeploymentRuleSnapshot", back_populates="deployment", cascade="all, delete-orphan")
```

- [ ] **Step 3: Recreate the test database**

The `seeded_engine` fixture does `drop_all` / `create_all` at the start of every pytest session, so the new columns will appear automatically. No manual migration needed.

Run one test to confirm the schema applies cleanly:

```bash
cd backend && pytest tests/test_deployments.py::test_create_deployment -v
```

Expected: `PASSED`

- [ ] **Step 4: Commit**

```bash
git add backend/models.py
git commit -m "feat: add rule_type_snapshot and rule_types_snapshot columns for immutable deployments"
```

---

### Task 2: Write failing tests for create_deployment snapshot storage

**Files:**
- Modify: `backend/tests/test_deployments.py`

- [ ] **Step 1: Write two failing tests**

Append to `backend/tests/test_deployments.py`:

```python
@pytest.mark.asyncio
async def test_create_deployment_stores_rule_type_snapshot(authed_client, db):
    from sqlalchemy import select as sa_select
    from models import DeploymentRuleSnapshot
    import uuid

    c_id, _ = await _setup(authed_client)
    dep_resp = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()

    snap_result = await db.execute(
        sa_select(DeploymentRuleSnapshot).where(
            DeploymentRuleSnapshot.deployment_id == dep_resp["id"]
        )
    )
    snaps = snap_result.scalars().all()
    assert len(snaps) == 1
    assert snaps[0].rule_type_snapshot is not None
    assert snaps[0].rule_type_snapshot["slug"] == "alert_classifier"
    assert "drl_package" in snaps[0].rule_type_snapshot


@pytest.mark.asyncio
async def test_create_deployment_stores_rule_types_snapshot(authed_client, db):
    from sqlalchemy import select as sa_select
    from models import Deployment

    c_id, _ = await _setup(authed_client)
    dep_resp = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()

    dep_result = await db.execute(
        sa_select(Deployment).where(Deployment.id == dep_resp["id"])
    )
    dep = dep_result.scalar_one()
    assert dep.rule_types_snapshot is not None
    assert isinstance(dep.rule_types_snapshot, list)
    slugs = [rt["slug"] for rt in dep.rule_types_snapshot]
    assert "alert_classifier" in slugs
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && pytest tests/test_deployments.py::test_create_deployment_stores_rule_type_snapshot tests/test_deployments.py::test_create_deployment_stores_rule_types_snapshot -v
```

Expected: both `FAILED` — `snaps[0].rule_type_snapshot` is `None` (column exists but is never populated yet).

---

### Task 3: Implement create_deployment snapshot storage

**Files:**
- Modify: `backend/routers/deployments.py:58-102`

- [ ] **Step 1: Fetch all RuleTypes before the rule loop and build a lookup map**

In `create_deployment`, insert after `await db.flush()` (after line `await db.flush()`) and before the `rules_result` query:

```python
rt_result = await db.execute(select(RuleType).order_by(RuleType.pipeline_stage))
all_rts = rt_result.scalars().all()
rt_map = {str(rt.id): _rt_to_dict(rt) for rt in all_rts}
```

- [ ] **Step 2: Store `rule_type_snapshot` on each snapshot and `rule_types_snapshot` on the deployment**

Replace the `for rule in enabled_rules` block and the lines after it with:

```python
for rule in enabled_rules:
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
        rule_type_snapshot=rt_map.get(str(rule.rule_type_id)),
    )
    db.add(snapshot)

deployment.rule_types_snapshot = sorted(rt_map.values(), key=lambda x: x["pipeline_stage"])

await db.commit()
await db.refresh(deployment)
return deployment
```

- [ ] **Step 3: Run the new tests to confirm they pass**

```bash
cd backend && pytest tests/test_deployments.py::test_create_deployment_stores_rule_type_snapshot tests/test_deployments.py::test_create_deployment_stores_rule_types_snapshot -v
```

Expected: both `PASSED`

- [ ] **Step 4: Run the full deployments test suite to confirm no regressions**

```bash
cd backend && pytest tests/test_deployments.py -v
```

Expected: all `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/routers/deployments.py
git commit -m "feat: snapshot rule-type metadata at deployment creation time"
```

---

### Task 4: Write failing tests for export immutability

**Files:**
- Modify: `backend/tests/test_deployments.py`

- [ ] **Step 1: Write three failing immutability tests**

Append to `backend/tests/test_deployments.py`:

```python
@pytest.mark.asyncio
async def test_export_uses_snapshotted_rule_type_metadata(authed_client, db):
    from sqlalchemy import update as sa_update
    from models import RuleType

    c_id, _ = await _setup(authed_client)
    dep = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()

    rt_resp = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rt_resp if r["slug"] == "alert_classifier")
    original_package = rt["drl_package"]

    await db.execute(
        sa_update(RuleType)
        .where(RuleType.id == rt["id"])
        .values(drl_package="com.mutated.package")
    )
    await db.commit()

    try:
        response = await authed_client.get(f"/api/deployments/{dep['id']}/export")
        assert response.status_code == 200
        buf = io.BytesIO(response.content)
        with zipfile.ZipFile(buf) as zf:
            content = zf.read("alert_classifier.drl").decode("utf-8")
        assert f"package {original_package}" in content
        assert "com.mutated.package" not in content
    finally:
        await db.execute(
            sa_update(RuleType)
            .where(RuleType.id == rt["id"])
            .values(drl_package=original_package)
        )
        await db.commit()


@pytest.mark.asyncio
async def test_export_survives_rule_deletion(authed_client):
    c_id, rule_id = await _setup(authed_client)
    dep = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()

    del_resp = await authed_client.delete(f"/api/rules/{rule_id}")
    assert del_resp.status_code == 204

    response = await authed_client.get(f"/api/deployments/{dep['id']}/export")
    assert response.status_code == 200
    buf = io.BytesIO(response.content)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "DeployRule_1" in content


@pytest.mark.asyncio
async def test_export_excludes_rule_types_added_after_deployment(authed_client, db):
    import uuid as _uuid
    from models import RuleType

    c_id, _ = await _setup(authed_client)
    dep = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()

    new_rt = RuleType(
        id=_uuid.uuid4(),
        slug="post_deploy_type",
        name="Post Deploy Type",
        pipeline_stage=99,
        drl_package="com.post.deploy",
        drl_imports="",
        drl_functions=None,
    )
    db.add(new_rt)
    await db.commit()

    try:
        response = await authed_client.get(f"/api/deployments/{dep['id']}/export")
        assert response.status_code == 200
        buf = io.BytesIO(response.content)
        with zipfile.ZipFile(buf) as zf:
            names = zf.namelist()
        assert "post_deploy_type.drl" not in names
    finally:
        await db.delete(new_rt)
        await db.commit()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && pytest tests/test_deployments.py::test_export_uses_snapshotted_rule_type_metadata tests/test_deployments.py::test_export_survives_rule_deletion tests/test_deployments.py::test_export_excludes_rule_types_added_after_deployment -v
```

Expected: all three `FAILED` — the export still does live lookups so mutations affect output and `post_deploy_type.drl` appears.

---

### Task 5: Rewrite export_deployment to use snapshots only

**Files:**
- Modify: `backend/routers/deployments.py:118-179`

- [ ] **Step 1: Replace the two live-lookup blocks in `export_deployment`**

Replace the entire section from `rt_rules: dict[str, tuple[dict, list[dict]]] = {}` through the end of `all_rts` loop (current lines 135–166) with:

```python
rt_rules: dict[str, tuple[dict, list[dict]]] = {}

for snap in snapshots:
    rule_dict = snap.rule_snapshot
    rt_snapshot = snap.rule_type_snapshot
    if rt_snapshot is None:
        continue
    rt_id = rt_snapshot["id"]
    if rt_id not in rt_rules:
        rt_rules[rt_id] = (rt_snapshot, [])
    rt_rules[rt_id][1].append({
        "name": rule_dict["name"],
        "condition_raw": rule_dict.get("condition_raw") or "",
        "action_raw": rule_dict.get("action_raw") or "",
    })

for rt_snapshot in (dep.rule_types_snapshot or []):
    rt_id = rt_snapshot["id"]
    if rt_id not in rt_rules:
        rt_rules[rt_id] = (rt_snapshot, [])
```

The `sorted_pairs` block and `generate_drl_bundle` call below remain unchanged.

- [ ] **Step 2: Run the three immutability tests to confirm they pass**

```bash
cd backend && pytest tests/test_deployments.py::test_export_uses_snapshotted_rule_type_metadata tests/test_deployments.py::test_export_survives_rule_deletion tests/test_deployments.py::test_export_excludes_rule_types_added_after_deployment -v
```

Expected: all three `PASSED`

- [ ] **Step 3: Run the full test suite**

```bash
cd backend && pytest -v
```

Expected: all tests `PASSED`

- [ ] **Step 4: Commit**

```bash
git add backend/routers/deployments.py backend/tests/test_deployments.py
git commit -m "feat: make deployment export immutable by reading from frozen snapshots"
```

---

### Task 6: Push

- [ ] **Push to remote**

```bash
git push origin master
```
