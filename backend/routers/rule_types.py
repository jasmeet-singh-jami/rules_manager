from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import RuleType
from schemas import RuleTypeOut

router = APIRouter(tags=["rule-types"])


@router.get("/rule-types", response_model=list[RuleTypeOut])
async def list_rule_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RuleType).order_by(RuleType.pipeline_stage))
    return result.scalars().all()
