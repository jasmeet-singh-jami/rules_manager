from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from database import get_db
from models import RuleType, Rule, User
from schemas import (
    RuleTypeOut,
    RuleTypeCreate,
    RuleTypeUpdate,
    RuleTypeReorderItem,
)
from auth_deps import require_admin
from seed_data import SEEDED_RULE_TYPE_SLUGS

router = APIRouter(tags=["rule-types"])


@router.get("/rule-types", response_model=list[RuleTypeOut])
async def list_rule_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RuleType).order_by(RuleType.pipeline_stage))
    return result.scalars().all()


@router.post("/rule-types", response_model=RuleTypeOut, status_code=status.HTTP_201_CREATED)
async def create_rule_type(
    body: RuleTypeCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(RuleType).where(RuleType.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already exists")

    if body.pipeline_stage is None:
        max_result = await db.execute(select(func.max(RuleType.pipeline_stage)))
        current_max = max_result.scalar() or 0
        pipeline_stage = current_max + 1
    else:
        pipeline_stage = body.pipeline_stage

    rt = RuleType(
        slug=body.slug,
        name=body.name,
        drl_package=body.drl_package,
        pipeline_stage=pipeline_stage,
    )
    db.add(rt)
    await db.commit()
    await db.refresh(rt)
    return rt


@router.patch("/rule-types/{rt_id}", response_model=RuleTypeOut)
async def update_rule_type(
    rt_id: UUID,
    body: RuleTypeUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RuleType).where(RuleType.id == rt_id))
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=404, detail="Rule type not found")

    if body.name is not None:
        rt.name = body.name
    if body.pipeline_stage is not None:
        rt.pipeline_stage = body.pipeline_stage

    await db.commit()
    await db.refresh(rt)
    return rt


@router.post("/rule-types/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_rule_types(
    items: list[RuleTypeReorderItem],
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not items:
        return

    stages = [it.pipeline_stage for it in items]
    if len(stages) != len(set(stages)):
        raise HTTPException(status_code=422, detail="pipeline_stage values must be unique")

    ids = [it.id for it in items]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="id values must be unique")

    found = await db.execute(select(RuleType.id).where(RuleType.id.in_(ids)))
    existing_ids = {row[0] for row in found.all()}
    missing = [str(i) for i in ids if i not in existing_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown rule type id(s): {missing}")

    for it in items:
        await db.execute(
            update(RuleType).where(RuleType.id == it.id).values(pipeline_stage=it.pipeline_stage)
        )
    await db.commit()


@router.delete("/rule-types/{rt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule_type(
    rt_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RuleType).where(RuleType.id == rt_id))
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=404, detail="Rule type not found")

    if rt.slug in SEEDED_RULE_TYPE_SLUGS:
        raise HTTPException(status_code=409, detail="Cannot delete a system-locked (seeded) rule type")

    count_result = await db.execute(
        select(func.count(Rule.id)).where(Rule.rule_type_id == rt_id)
    )
    attached = count_result.scalar() or 0
    if attached > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Rule type has {attached} attached rule(s); delete or migrate them first",
        )

    await db.delete(rt)
    await db.commit()
