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
