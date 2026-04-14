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
