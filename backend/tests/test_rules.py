import pytest


async def _make_client(authed_client, code="INFY"):
    r = await authed_client.post("/api/clients", json={"code": code, "name": code})
    return r.json()["id"]


async def _get_rule_type_id(authed_client, slug="alert_classifier"):
    r = await authed_client.get("/api/rule-types")
    for rt in r.json():
        if rt["slug"] == slug:
            return rt["id"]
    raise ValueError(f"Rule type {slug!r} not found")


@pytest.mark.asyncio
async def test_list_rules_empty(authed_client):
    response = await authed_client.get("/api/rules")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_rule(authed_client):
    client_id = await _make_client(authed_client)
    rt_id = await _get_rule_type_id(authed_client)
    payload = {
        "client_id": client_id,
        "rule_type_id": rt_id,
        "name": "TestRule_1",
        "condition_raw": "alert:IPPAlert(sourceId == \"LM\")",
        "action_raw": "alert.setServiceName(\"svc\");",
        "tool": "LogicMonitor",
    }
    response = await authed_client.post("/api/rules", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "TestRule_1"
    assert data["tool"] == "LogicMonitor"


@pytest.mark.asyncio
async def test_get_rule(authed_client):
    client_id = await _make_client(authed_client)
    rt_id = await _get_rule_type_id(authed_client)
    created = (await authed_client.post("/api/rules", json={
        "client_id": client_id, "rule_type_id": rt_id, "name": "R1"
    })).json()
    response = await authed_client.get(f"/api/rules/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "R1"


@pytest.mark.asyncio
async def test_filter_rules_by_client(authed_client):
    c1 = await _make_client(authed_client, "C1")
    c2 = await _make_client(authed_client, "C2")
    rt_id = await _get_rule_type_id(authed_client)
    await authed_client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "RuleC1"})
    await authed_client.post("/api/rules", json={"client_id": c2, "rule_type_id": rt_id, "name": "RuleC2"})
    response = await authed_client.get(f"/api/rules?client_id={c1}")
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "RuleC1"


@pytest.mark.asyncio
async def test_filter_rules_by_tool(authed_client):
    c1 = await _make_client(authed_client)
    rt_id = await _get_rule_type_id(authed_client)
    await authed_client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "R_LM", "tool": "LogicMonitor"})
    await authed_client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "R_TI", "tool": "Tivoli"})
    response = await authed_client.get("/api/rules?tool=LogicMonitor")
    data = response.json()
    assert all(r["tool"] == "LogicMonitor" for r in data)


@pytest.mark.asyncio
async def test_filter_rules_by_rule_type_slug_and_id(authed_client):
    client_id = await _make_client(authed_client)
    alert_rt_id = await _get_rule_type_id(authed_client, "alert_classifier")
    noise_rt_id = await _get_rule_type_id(authed_client, "noise_suppression")

    await authed_client.post("/api/rules", json={"client_id": client_id, "rule_type_id": alert_rt_id, "name": "AlertOnly"})
    await authed_client.post("/api/rules", json={"client_id": client_id, "rule_type_id": noise_rt_id, "name": "NoiseOnly"})

    by_slug = await authed_client.get(f"/api/rules?client_id={client_id}&rule_type=alert_classifier")
    assert by_slug.status_code == 200
    assert [r["name"] for r in by_slug.json()] == ["AlertOnly"]

    by_id = await authed_client.get(f"/api/rules?client_id={client_id}&rule_type={noise_rt_id}")
    assert by_id.status_code == 200
    assert [r["name"] for r in by_id.json()] == ["NoiseOnly"]


@pytest.mark.asyncio
async def test_search_rules_by_name(authed_client):
    c1 = await _make_client(authed_client)
    rt_id = await _get_rule_type_id(authed_client)
    await authed_client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "UniqueAlpha_1"})
    await authed_client.post("/api/rules", json={"client_id": c1, "rule_type_id": rt_id, "name": "BetaRule_2"})
    response = await authed_client.get("/api/rules?search=UniqueAlpha")
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "UniqueAlpha_1"


@pytest.mark.asyncio
async def test_update_rule(authed_client):
    c1 = await _make_client(authed_client)
    rt_id = await _get_rule_type_id(authed_client)
    created = (await authed_client.post("/api/rules", json={
        "client_id": c1, "rule_type_id": rt_id, "name": "OldName"
    })).json()
    response = await authed_client.put(f"/api/rules/{created['id']}", json={"name": "NewName"})
    assert response.status_code == 200
    assert response.json()["name"] == "NewName"


@pytest.mark.asyncio
async def test_delete_rule(authed_client):
    c1 = await _make_client(authed_client)
    rt_id = await _get_rule_type_id(authed_client)
    created = (await authed_client.post("/api/rules", json={
        "client_id": c1, "rule_type_id": rt_id, "name": "ToDelete"
    })).json()
    response = await authed_client.delete(f"/api/rules/{created['id']}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_copy_rule_to_another_client(authed_client):
    c1 = await _make_client(authed_client, "SRC")
    c2 = await _make_client(authed_client, "DST")
    rt_id = await _get_rule_type_id(authed_client)
    original = (await authed_client.post("/api/rules", json={
        "client_id": c1, "rule_type_id": rt_id, "name": "OriginalRule",
        "condition_raw": "when something", "action_raw": "then something"
    })).json()
    response = await authed_client.post(
        f"/api/rules/{original['id']}/copy",
        json={"target_client_id": c2}
    )
    assert response.status_code == 201
    copy = response.json()
    assert copy["client_id"] == c2
    assert "OriginalRule" in copy["name"]
    assert copy["id"] != original["id"]


@pytest.mark.asyncio
async def test_contributor_can_see_all_rules_from_all_clients(client, authed_client):
    """Contributors can read rules from all clients, not just their own."""
    admin_client_id = await _make_client(authed_client, "ADM")
    rt_id = await _get_rule_type_id(authed_client)
    await authed_client.post("/api/rules", json={"client_id": admin_client_id, "rule_type_id": rt_id, "name": "AdminRule"})

    reg = await client.post("/api/auth/register", json={"username": "rules_contrib_read", "password": "password123"})
    contrib_token = reg.json()["token"]
    own_client = await client.post(
        "/api/clients",
        json={"code": "OWNRULE", "name": "Own Rule Client"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    own_client_id = own_client.json()["id"]
    await client.post(
        "/api/rules",
        json={"client_id": own_client_id, "rule_type_id": rt_id, "name": "OwnRule"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )

    # Contributor sees ALL rules, including admin's
    listed = await client.get(
        "/api/rules",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert listed.status_code == 200
    names = {r["name"] for r in listed.json()}
    assert "AdminRule" in names
    assert "OwnRule" in names

    # Contributor can filter by any client (including one they can't edit)
    filtered = await client.get(
        f"/api/rules?client_id={admin_client_id}",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert filtered.status_code == 200
    assert filtered.json()[0]["name"] == "AdminRule"


@pytest.mark.asyncio
async def test_contributor_cannot_create_rule_for_inaccessible_client(client, authed_client):
    """Contributors get 403 when trying to write rules for a client they don't have access to."""
    admin_client_id = await _make_client(authed_client, "ADM2")
    rt_id = await _get_rule_type_id(authed_client)

    reg = await client.post("/api/auth/register", json={"username": "rules_contrib_write", "password": "password123"})
    contrib_token = reg.json()["token"]

    # Create is blocked
    create_resp = await client.post(
        "/api/rules",
        json={"client_id": admin_client_id, "rule_type_id": rt_id, "name": "HackRule"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert create_resp.status_code == 403

    # But reading is allowed
    read_resp = await client.get(
        f"/api/rules?client_id={admin_client_id}",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert read_resp.status_code == 200
