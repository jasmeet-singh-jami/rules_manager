import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport

TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/test_polycloud_rm",
)


def pytest_collection_modifyitems(items):
    """Force all async tests into session loop scope so they share the session-scoped engine.
    asyncpg connections are loop-bound; without this, function-scoped test loops conflict
    with the session-scoped seeded_engine fixture on Python 3.10 / pytest-asyncio 0.24."""
    for item in items:
        if item.get_closest_marker("asyncio") is not None:
            item.add_marker(pytest.mark.asyncio(loop_scope="session"), append=False)


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def seeded_engine():
    from database import Base
    from seed_data import seed_rule_types

    eng = create_async_engine(TEST_DB_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(eng, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        await seed_rule_types(session)
        await session.commit()

    yield eng
    await eng.dispose()


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def clean_tables(seeded_engine):
    """Delete all data except rule_types between tests."""
    from database import Base

    yield

    async with seeded_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            if table.name != "rule_types":
                await conn.execute(table.delete())


@pytest_asyncio.fixture(loop_scope="session")
async def db(seeded_engine):
    factory = async_sessionmaker(seeded_engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture(loop_scope="session")
async def client(db, seeded_engine):
    import sys
    sys.path.insert(0, ".")
    from main import app
    from database import get_db

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
