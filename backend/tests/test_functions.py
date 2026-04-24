import pytest
import uuid


@pytest.mark.asyncio
async def test_list_functions_for_rule_type(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    res = await authed_client.get(f"/api/rule-types/{rt['id']}/functions")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(f["name"] == "extractPort" for f in data)


@pytest.mark.asyncio
async def test_list_imports_for_rule_type(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "issue_correlation")
    res = await authed_client.get(f"/api/rule-types/{rt['id']}/imports")
    assert res.status_code == 200
    data = res.json()
    assert any("IPPGroupedAlerts" in i["statement"] for i in data)
    assert any(i["is_shared"] is True for i in data)


@pytest.mark.asyncio
async def test_create_function(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    body = {"name": "testFunc", "body": "function String testFunc() { return null; }"}
    res = await authed_client.post(f"/api/rule-types/{rt['id']}/functions", json=body)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "testFunc"
    assert data["rule_type_id"] == rt["id"]


@pytest.mark.asyncio
async def test_update_function(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/functions",
        json={"name": "editMe", "body": "function String editMe() { return \"old\"; }"}
    )).json()
    res = await authed_client.put(
        f"/api/rule-types/{rt['id']}/functions/{created['id']}",
        json={"body": "function String editMe() { return \"new\"; }"}
    )
    assert res.status_code == 200
    assert "new" in res.json()["body"]


@pytest.mark.asyncio
async def test_delete_function(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/functions",
        json={"name": "delMe", "body": "function String delMe() { return null; }"}
    )).json()
    res = await authed_client.delete(f"/api/rule-types/{rt['id']}/functions/{created['id']}")
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_create_import(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    body = {"statement": "import com.example.NewClass;", "kind": "import", "is_shared": False}
    res = await authed_client.post(f"/api/rule-types/{rt['id']}/imports", json=body)
    assert res.status_code == 201
    assert res.json()["statement"] == "import com.example.NewClass;"


@pytest.mark.asyncio
async def test_update_import_is_shared(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/imports",
        json={"statement": "import com.example.Toggleable;", "kind": "import", "is_shared": False}
    )).json()
    res = await authed_client.put(
        f"/api/rule-types/{rt['id']}/imports/{created['id']}",
        json={"is_shared": True}
    )
    assert res.status_code == 200
    assert res.json()["is_shared"] is True


@pytest.mark.asyncio
async def test_delete_import(authed_client):
    rts = (await authed_client.get("/api/rule-types")).json()
    rt = next(r for r in rts if r["slug"] == "alert_classifier")
    created = (await authed_client.post(
        f"/api/rule-types/{rt['id']}/imports",
        json={"statement": "import com.example.DeleteMe;", "kind": "import", "is_shared": False}
    )).json()
    res = await authed_client.delete(f"/api/rule-types/{rt['id']}/imports/{created['id']}")
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_list_functions_unknown_rule_type(authed_client):
    res = await authed_client.get(f"/api/rule-types/{uuid.uuid4()}/functions")
    assert res.status_code == 404
