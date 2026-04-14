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
