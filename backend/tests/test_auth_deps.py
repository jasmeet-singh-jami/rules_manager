import uuid
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
    username = f"expiry_user_{uuid.uuid4().hex[:8]}"
    reg = await client.post("/api/auth/register", json={"username": username, "password": "password1"})
    token_value = reg.json()["token"]

    result = await db.execute(select(Token).where(Token.token == token_value))
    token_row = result.scalar_one()
    token_row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db.commit()

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_value}"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_valid_token_slides_expiry(client, db):
    username = f"slide_user_{uuid.uuid4().hex[:8]}"
    reg = await client.post("/api/auth/register", json={"username": username, "password": "password1"})
    token_value = reg.json()["token"]

    result = await db.execute(select(Token).where(Token.token == token_value))
    token_row = result.scalar_one()
    one_hour_from_now = datetime.now(timezone.utc) + timedelta(hours=1)
    token_row.expires_at = one_hour_from_now
    await db.commit()

    await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_value}"})

    await db.refresh(token_row)
    twenty_three_hours_from_now = datetime.now(timezone.utc) + timedelta(hours=23)
    assert token_row.expires_at > twenty_three_hours_from_now
