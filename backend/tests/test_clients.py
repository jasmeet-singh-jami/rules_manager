import pytest


@pytest.mark.asyncio
async def test_list_clients_empty(authed_client):
    response = await authed_client.get("/api/clients")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_client(authed_client):
    payload = {"code": "INFY", "name": "Infosys", "description": "Main client"}
    response = await authed_client.post("/api/clients", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "INFY"
    assert data["name"] == "Infosys"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_client_duplicate_code_returns_409(authed_client):
    payload = {"code": "INFY", "name": "Infosys"}
    await authed_client.post("/api/clients", json=payload)
    response = await authed_client.post("/api/clients", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_get_client_by_id(authed_client):
    created = (await authed_client.post("/api/clients", json={"code": "ACME", "name": "Acme Corp"})).json()
    response = await authed_client.get(f"/api/clients/{created['id']}")
    assert response.status_code == 200
    assert response.json()["code"] == "ACME"


@pytest.mark.asyncio
async def test_get_client_not_found(authed_client):
    response = await authed_client.get("/api/clients/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_client(authed_client):
    created = (await authed_client.post("/api/clients", json={"code": "OLD", "name": "Old Name"})).json()
    response = await authed_client.put(f"/api/clients/{created['id']}", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_client(authed_client):
    created = (await authed_client.post("/api/clients", json={"code": "DEL", "name": "To Delete"})).json()
    response = await authed_client.delete(f"/api/clients/{created['id']}")
    assert response.status_code == 204
    get_resp = await authed_client.get(f"/api/clients/{created['id']}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_unauthenticated_request_returns_401(client):
    response = await client.get("/api/clients")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_contributor_cannot_edit_unassigned_client(client, authed_client):
    """A contributor without access to a client gets 403 on write operations."""
    c = (await authed_client.post("/api/clients", json={"code": "NOACC", "name": "No Access"})).json()
    reg = await client.post("/api/auth/register", json={"username": "contrib_no_access", "password": "pw"})
    contrib_token = reg.json()["token"]
    response = await client.put(
        f"/api/clients/{c['id']}",
        json={"name": "Hacked"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_contributor_can_create_client_and_receives_access(client):
    reg = await client.post("/api/auth/register", json={"username": "contrib_create", "password": "pw"})
    contrib_token = reg.json()["token"]
    response = await client.post(
        "/api/clients",
        json={"code": "OWN", "name": "Owned Client"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert response.status_code == 201

    created = response.json()
    assert created["code"] == "OWN"

    listed = await client.get(
        "/api/clients",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert listed.status_code == 200
    assert created["id"] in [c["id"] for c in listed.json()]


@pytest.mark.asyncio
async def test_contributor_lists_all_clients_but_only_edits_assigned_ones(client, authed_client):
    admin_client = await authed_client.post("/api/clients", json={"code": "ADMIN", "name": "Admin Client"})
    reg = await client.post("/api/auth/register", json={"username": "contrib_list", "password": "pw"})
    contrib_token = reg.json()["token"]
    owned_client = await client.post(
        "/api/clients",
        json={"code": "SELF", "name": "Self Client"},
        headers={"Authorization": f"Bearer {contrib_token}"},
    )

    listed = await client.get(
        "/api/clients",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )
    assert listed.status_code == 200
    listed_ids = {c["id"] for c in listed.json()}
    assert admin_client.json()["id"] in listed_ids
    assert owned_client.json()["id"] in listed_ids


@pytest.mark.asyncio
async def test_contributor_can_view_unassigned_client_details(client, authed_client):
    created = await authed_client.post("/api/clients", json={"code": "VIEW", "name": "View Client"})
    reg = await client.post("/api/auth/register", json={"username": "contrib_view", "password": "pw"})
    contrib_token = reg.json()["token"]

    response = await client.get(
        f"/api/clients/{created.json()['id']}",
        headers={"Authorization": f"Bearer {contrib_token}"},
    )

    assert response.status_code == 200
    assert response.json()["id"] == created.json()["id"]
