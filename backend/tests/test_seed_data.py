import pytest
from sqlalchemy import select
from models import RuleType


@pytest.mark.asyncio
async def test_seed_creates_six_rule_types(db):
    result = await db.execute(select(RuleType))
    rule_types = result.scalars().all()
    assert len(rule_types) == 6


@pytest.mark.asyncio
async def test_seed_rule_type_slugs(db):
    result = await db.execute(select(RuleType.slug))
    slugs = {row[0] for row in result.all()}
    assert slugs == {
        "alert_classifier",
        "noise_suppression",
        "issue_correlation",
        "incident_rules",
        "recommendation",
        "email_ingestion",
    }


@pytest.mark.asyncio
async def test_seed_pipeline_stages_are_unique_1_to_6(db):
    result = await db.execute(select(RuleType.pipeline_stage))
    stages = sorted(row[0] for row in result.all())
    assert stages == [1, 2, 3, 4, 5, 6]


@pytest.mark.asyncio
async def test_seed_is_idempotent(db, seeded_engine):
    """Running seed twice must not duplicate rows."""
    from seed_data import seed_rule_types
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    factory = async_sessionmaker(seeded_engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as s:
        await seed_rule_types(s)
        await s.commit()
    result = await db.execute(select(RuleType))
    assert len(result.scalars().all()) == 6
