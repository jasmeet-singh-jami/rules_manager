import pytest
from sqlalchemy import inspect


@pytest.mark.asyncio
async def test_auth_tables_exist(seeded_engine):
    async with seeded_engine.connect() as conn:
        table_names = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )
    assert "users" in table_names
    assert "tokens" in table_names
    assert "user_client_access" in table_names


@pytest.mark.asyncio
async def test_token_has_expires_at_column(seeded_engine):
    async with seeded_engine.connect() as conn:
        columns = await conn.run_sync(
            lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("tokens")]
        )
    assert "expires_at" in columns


@pytest.mark.asyncio
async def test_user_has_must_change_password_column(seeded_engine):
    async with seeded_engine.connect() as conn:
        columns = await conn.run_sync(
            lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("users")]
        )
    assert "must_change_password" in columns
