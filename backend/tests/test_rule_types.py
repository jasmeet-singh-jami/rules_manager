import uuid
import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from models import RuleType, Rule
from seed_data import SEEDED_RULE_TYPE_SLUGS


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def cleanup_non_seeded_rule_types(seeded_engine):
    yield
    factory = async_sessionmaker(seeded_engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as s:
        non_seeded_ids = (await s.execute(
            select(RuleType.id).where(~RuleType.slug.in_(SEEDED_RULE_TYPE_SLUGS))
        )).scalars().all()
        if non_seeded_ids:
            await s.execute(delete(Rule).where(Rule.rule_type_id.in_(non_seeded_ids)))
            await s.execute(delete(RuleType).where(RuleType.id.in_(non_seeded_ids)))
            await s.commit()


@pytest.mark.asyncio
async def test_list_rule_types_includes_all_seeded(client):
    response = await client.get("/api/rule-types")
    assert response.status_code == 200
    data = response.json()
    slugs = {rt["slug"] for rt in data}
    assert SEEDED_RULE_TYPE_SLUGS.issubset(slugs)


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


@pytest.mark.asyncio
async def test_rule_type_has_functions_relationship(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    assert "functions" in rt
    assert isinstance(rt["functions"], list)
    assert any(f["name"] == "extractPort" for f in rt["functions"])

@pytest.mark.asyncio
async def test_rule_type_has_imports_relationship(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    assert "imports" in rt
    assert isinstance(rt["imports"], list)
    assert any("IPPGroupedAlerts" in i["statement"] for i in rt["imports"])


@pytest.mark.asyncio
async def test_seeded_rule_type_marked_system_locked(client):
    rts = (await client.get("/api/rule-types")).json()
    seeded = next(r for r in rts if r["slug"] == "alert_classifier")
    assert seeded["is_system_locked"] is True


# ── CRUD: helpers ────────────────────────────────────────────────────────────

def _slug(prefix: str = "rt") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


async def _create_rt(authed_client, **overrides):
    body = {
        "slug": _slug(),
        "name": "Custom Stage",
        "drl_package": "com.test.custom",
    }
    body.update(overrides)
    return await authed_client.post("/api/rule-types", json=body)


async def _register_contributor(client):
    username = f"rt_contrib_{uuid.uuid4().hex[:6]}"
    reg = await client.post("/api/auth/register", json={"username": username, "password": "pw"})
    return reg.json()["token"]


# ── CRUD: auth ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_rule_type_requires_admin(client):
    token = await _register_contributor(client)
    r = await client.post(
        "/api/rule-types",
        json={"slug": _slug(), "name": "X", "drl_package": "com.test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_patch_rule_type_requires_admin(client, authed_client):
    rt = (await _create_rt(authed_client)).json()
    token = await _register_contributor(client)
    r = await client.patch(
        f"/api/rule-types/{rt['id']}",
        json={"name": "Renamed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_delete_rule_type_requires_admin(client, authed_client):
    rt = (await _create_rt(authed_client)).json()
    token = await _register_contributor(client)
    r = await client.delete(
        f"/api/rule-types/{rt['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


# ── CRUD: create ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_rule_type_basic(authed_client):
    slug = _slug()
    r = await authed_client.post(
        "/api/rule-types",
        json={"slug": slug, "name": "Custom", "drl_package": "com.custom.pkg"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["slug"] == slug
    assert data["drl_package"] == "com.custom.pkg"
    assert data["is_system_locked"] is False
    assert isinstance(data["pipeline_stage"], int)


@pytest.mark.asyncio
async def test_create_rule_type_auto_pipeline_stage(authed_client):
    listing = await authed_client.get("/api/rule-types")
    existing_max = max((rt["pipeline_stage"] for rt in listing.json()), default=0)
    r = await _create_rt(authed_client)
    assert r.status_code == 201
    assert r.json()["pipeline_stage"] == existing_max + 1


@pytest.mark.asyncio
async def test_create_rule_type_duplicate_slug_returns_409(authed_client):
    slug = _slug()
    first = await _create_rt(authed_client, slug=slug)
    assert first.status_code == 201
    second = await _create_rt(authed_client, slug=slug)
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_create_rule_type_invalid_slug_returns_422(authed_client):
    r = await _create_rt(authed_client, slug="Bad Slug!")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_rule_type_empty_drl_package_returns_422(authed_client):
    r = await _create_rt(authed_client, drl_package="   ")
    assert r.status_code == 422


# ── CRUD: patch ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_rule_type_renames(authed_client):
    rt = (await _create_rt(authed_client)).json()
    r = await authed_client.patch(f"/api/rule-types/{rt['id']}", json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


@pytest.mark.asyncio
async def test_patch_rule_type_slug_immutable(authed_client):
    rt = (await _create_rt(authed_client)).json()
    r = await authed_client.patch(
        f"/api/rule-types/{rt['id']}",
        json={"slug": _slug()},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_rule_type_drl_package_immutable(authed_client):
    rt = (await _create_rt(authed_client)).json()
    r = await authed_client.patch(
        f"/api/rule-types/{rt['id']}",
        json={"drl_package": "com.evil.hack"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_rule_type_unknown_returns_404(authed_client):
    r = await authed_client.patch(
        f"/api/rule-types/{uuid.uuid4()}",
        json={"name": "X"},
    )
    assert r.status_code == 404


# ── CRUD: reorder ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reorder_rule_types_happy_path(authed_client):
    a = (await _create_rt(authed_client, pipeline_stage=4001)).json()
    b = (await _create_rt(authed_client, pipeline_stage=4002)).json()
    r = await authed_client.post(
        "/api/rule-types/reorder",
        json=[{"id": a["id"], "pipeline_stage": 4012}, {"id": b["id"], "pipeline_stage": 4011}],
    )
    assert r.status_code == 204
    listing = {rt["id"]: rt["pipeline_stage"] for rt in (await authed_client.get("/api/rule-types")).json()}
    assert listing[a["id"]] == 4012
    assert listing[b["id"]] == 4011


@pytest.mark.asyncio
async def test_reorder_rule_types_duplicate_stage_returns_422(authed_client):
    a = (await _create_rt(authed_client, pipeline_stage=4101)).json()
    b = (await _create_rt(authed_client, pipeline_stage=4102)).json()
    r = await authed_client.post(
        "/api/rule-types/reorder",
        json=[{"id": a["id"], "pipeline_stage": 4200}, {"id": b["id"], "pipeline_stage": 4200}],
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_reorder_rule_types_unknown_id_returns_404(authed_client):
    r = await authed_client.post(
        "/api/rule-types/reorder",
        json=[{"id": str(uuid.uuid4()), "pipeline_stage": 1}],
    )
    assert r.status_code == 404


# ── CRUD: delete ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_rule_type_happy_path(authed_client):
    rt = (await _create_rt(authed_client)).json()
    r = await authed_client.delete(f"/api/rule-types/{rt['id']}")
    assert r.status_code == 204
    listing = await authed_client.get("/api/rule-types")
    assert all(item["id"] != rt["id"] for item in listing.json())


@pytest.mark.asyncio
async def test_delete_rule_type_seeded_returns_409(authed_client):
    listing = (await authed_client.get("/api/rule-types")).json()
    seeded = next(rt for rt in listing if rt["slug"] in SEEDED_RULE_TYPE_SLUGS)
    r = await authed_client.delete(f"/api/rule-types/{seeded['id']}")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_rule_type_with_attached_rules_returns_409(authed_client):
    rt = (await _create_rt(authed_client)).json()
    client_resp = await authed_client.post("/api/clients", json={"code": f"RT{uuid.uuid4().hex[:4]}", "name": "RT"})
    client_id = client_resp.json()["id"]
    rule = await authed_client.post(
        "/api/rules",
        json={
            "client_id": client_id,
            "rule_type_id": rt["id"],
            "name": "Attached rule",
            "condition_raw": "$a:Object()",
            "action_raw": "System.out.println(\"hi\");",
        },
    )
    assert rule.status_code == 201

    r = await authed_client.delete(f"/api/rule-types/{rt['id']}")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_rule_type_unknown_returns_404(authed_client):
    r = await authed_client.delete(f"/api/rule-types/{uuid.uuid4()}")
    assert r.status_code == 404
