import pytest
import zipfile
import io


async def _setup(authed_client):
    """Create a client + rule type + one enabled rule. Return (client_id, rule_id)."""
    c = (await authed_client.post("/api/clients", json={"code": "DEP", "name": "Dep Client"})).json()
    rt = next(rt for rt in (await authed_client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    rule = (await authed_client.post("/api/rules", json={
        "client_id": c["id"],
        "rule_type_id": rt["id"],
        "name": "DeployRule_1",
        "condition_raw": 'alert:IPPAlert(sourceId == "LM")',
        "action_raw": 'alert.setServiceName("svc");',
        "enabled": True,
    })).json()
    return c["id"], rule["id"]


@pytest.mark.asyncio
async def test_list_deployments_empty(authed_client):
    c = (await authed_client.post("/api/clients", json={"code": "DC1", "name": "D1"})).json()
    response = await authed_client.get(f"/api/clients/{c['id']}/deployments")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_deployment(authed_client):
    c_id, _ = await _setup(authed_client)
    payload = {"client_id": c_id, "version": "v1.0", "notes": "First release"}
    response = await authed_client.post("/api/deployments", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["version"] == "v1.0"
    assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_create_deployment_snapshots_enabled_rules(authed_client):
    c_id, rule_id = await _setup(authed_client)
    dep = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()
    response = await authed_client.get(f"/api/deployments/{dep['id']}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_export_returns_zip(authed_client):
    c_id, _ = await _setup(authed_client)
    dep = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()
    response = await authed_client.get(f"/api/deployments/{dep['id']}/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    buf = io.BytesIO(response.content)
    with zipfile.ZipFile(buf) as zf:
        names = zf.namelist()
    assert "alert_classifier.drl" in names


@pytest.mark.asyncio
async def test_export_zip_contains_rule_content(authed_client):
    c_id, _ = await _setup(authed_client)
    dep = (await authed_client.post("/api/deployments", json={"client_id": c_id, "version": "v1.0"})).json()
    response = await authed_client.get(f"/api/deployments/{dep['id']}/export")
    buf = io.BytesIO(response.content)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "DeployRule_1" in content
    assert "when" in content
    assert "then" in content


@pytest.mark.asyncio
async def test_disabled_rules_not_exported(authed_client):
    c = (await authed_client.post("/api/clients", json={"code": "DIS", "name": "Dis"})).json()
    rt = next(rt for rt in (await authed_client.get("/api/rule-types")).json() if rt["slug"] == "alert_classifier")
    await authed_client.post("/api/rules", json={
        "client_id": c["id"], "rule_type_id": rt["id"],
        "name": "DisabledRule", "condition_raw": "x", "action_raw": "y", "enabled": False
    })
    dep = (await authed_client.post("/api/deployments", json={"client_id": c["id"], "version": "v1.0"})).json()
    response = await authed_client.get(f"/api/deployments/{dep['id']}/export")
    buf = io.BytesIO(response.content)
    with zipfile.ZipFile(buf) as zf:
        content = zf.read("alert_classifier.drl").decode("utf-8")
    assert "DisabledRule" not in content


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
