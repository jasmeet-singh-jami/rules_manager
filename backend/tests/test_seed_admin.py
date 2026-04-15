import pytest


@pytest.mark.asyncio
async def test_admin_login_works(client):
    """Seeded admin account can log in."""
    response = await client.post("/api/auth/login", json={
        "username": "admin",
        "password": "admin"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "admin"
    assert "token" in data
