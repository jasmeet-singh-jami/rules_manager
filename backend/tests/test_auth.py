import pytest


@pytest.mark.asyncio
async def test_register_creates_user(client):
    response = await client.post("/api/auth/register", json={
        "username": "alice",
        "password": "secret123"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["username"] == "alice"
    assert data["user"]["role"] == "contributor"
    assert "token" in data
    assert isinstance(data["client_access_ids"], list)


@pytest.mark.asyncio
async def test_register_duplicate_username_returns_409(client):
    payload = {"username": "bob", "password": "pw"}
    await client.post("/api/auth/register", json=payload)
    response = await client.post("/api/auth/register", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login_returns_token(client):
    await client.post("/api/auth/register", json={"username": "carol", "password": "pw"})
    response = await client.post("/api/auth/login", json={"username": "carol", "password": "pw"})
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["username"] == "carol"


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    await client.post("/api/auth/register", json={"username": "dave", "password": "correct"})
    response = await client.post("/api/auth/login", json={"username": "dave", "password": "wrong"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_user_returns_401(client):
    response = await client.post("/api/auth/login", json={"username": "ghost", "password": "pw"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout_invalidates_token(client):
    reg = await client.post("/api/auth/register", json={"username": "eve", "password": "pw"})
    token = reg.json()["token"]
    logout_resp = await client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert logout_resp.status_code == 204
    me_resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_info(client):
    reg = await client.post("/api/auth/register", json={"username": "frank", "password": "pw"})
    token = reg.json()["token"]
    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "frank"
    assert data["role"] == "contributor"
    assert "client_access_ids" in data
