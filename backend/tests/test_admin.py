import pytest


@pytest.mark.asyncio
async def test_list_users_requires_admin(client):
    """Non-admin cannot list users."""
    reg = await client.post("/api/auth/register", json={"username": "non_admin", "password": "pw"})
    token = reg.json()["token"]
    response = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_users_as_admin(authed_client):
    response = await authed_client.get("/api/admin/users")
    assert response.status_code == 200
    data = response.json()
    assert any(u["username"] == "admin" for u in data)


@pytest.mark.asyncio
async def test_grant_and_revoke_client_access(authed_client, client):
    # Create a client
    c = (await authed_client.post("/api/clients", json={"code": "ACME", "name": "Acme"})).json()
    # Register a contributor
    reg = await client.post("/api/auth/register", json={"username": "contrib1", "password": "pw"})
    user_id = reg.json()["user"]["id"]

    # Grant access
    grant = await authed_client.post(f"/api/admin/users/{user_id}/clients/{c['id']}")
    assert grant.status_code == 204

    # Verify access list updated
    users = (await authed_client.get("/api/admin/users")).json()
    user_data = next(u for u in users if u["username"] == "contrib1")
    assert c["id"] in user_data["client_ids"]

    # Revoke access
    revoke = await authed_client.delete(f"/api/admin/users/{user_id}/clients/{c['id']}")
    assert revoke.status_code == 204

    users2 = (await authed_client.get("/api/admin/users")).json()
    user_data2 = next(u for u in users2 if u["username"] == "contrib1")
    assert c["id"] not in user_data2["client_ids"]


@pytest.mark.asyncio
async def test_grant_access_nonexistent_user(authed_client):
    c = (await authed_client.post("/api/clients", json={"code": "XYZ", "name": "XYZ Corp"})).json()
    response = await authed_client.post(
        f"/api/admin/users/00000000-0000-0000-0000-000000000001/clients/{c['id']}"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_reset_password_succeeds(authed_client, client):
    reg = await client.post("/api/auth/register", json={"username": "resetme", "password": "oldpassword"})
    user_id = reg.json()["user"]["id"]
    response = await authed_client.patch(
        f"/api/admin/users/{user_id}/password",
        json={"new_password": "newpassword1"},
    )
    assert response.status_code == 204
    # Old password no longer works
    old_login = await client.post("/api/auth/login", json={"username": "resetme", "password": "oldpassword"})
    assert old_login.status_code == 401
    # New password works
    new_login = await client.post("/api/auth/login", json={"username": "resetme", "password": "newpassword1"})
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_admin_reset_password_nonexistent_user_returns_404(authed_client):
    response = await authed_client.patch(
        "/api/admin/users/00000000-0000-0000-0000-000000000001/password",
        json={"new_password": "newpassword1"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_reset_password_requires_admin(client):
    reg = await client.post("/api/auth/register", json={"username": "notadmin3", "password": "oldpassword"})
    user_id = reg.json()["user"]["id"]
    token = reg.json()["token"]
    response = await client.patch(
        f"/api/admin/users/{user_id}/password",
        json={"new_password": "newpassword1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_reset_password_too_short_returns_422(authed_client, client):
    reg = await client.post("/api/auth/register", json={"username": "resetshort", "password": "oldpassword"})
    user_id = reg.json()["user"]["id"]
    response = await authed_client.patch(
        f"/api/admin/users/{user_id}/password",
        json={"new_password": "short"},
    )
    assert response.status_code == 422
