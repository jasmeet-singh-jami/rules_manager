import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from models import Token


@pytest.mark.asyncio
async def test_invalid_token_returns_401(client):
    response = await client.get(
        "/api/clients",
        headers={"Authorization": "Bearer invalid_token_xyz"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_returns_401(client, db):
    reg = await client.post("/api/auth/register", json={"username": "expiry_user", "password": "password1"})
    token_value = reg.json()["token"]

    # Expire the token directly in the DB
    result = await db.execute(select(Token).where(Token.token == token_value))
    token_row = result.scalar_one()
    token_row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db.commit()

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_value}"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_valid_token_slides_expiry(client, db):
    reg = await client.post("/api/auth/register", json={"username": "slide_user", "password": "password1"})
    token_value = reg.json()["token"]

    # Set expiry to 1 hour from now (instead of 24)
    result = await db.execute(select(Token).where(Token.token == token_value))
    token_row = result.scalar_one()
    one_hour_from_now = datetime.now(timezone.utc) + timedelta(hours=1)
    token_row.expires_at = one_hour_from_now
    await db.commit()

    # Make an authenticated request
    await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_value}"})

    # Expiry should have been extended to ~24h from now
    await db.refresh(token_row)
    assert token_row.expires_at > one_hour_from_now
