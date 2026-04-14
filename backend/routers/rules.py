from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from models import Rule, Client, RuleType
from schemas import RuleCreate, RuleUpdate, RuleOut, RuleCopyRequest

router = APIRouter(tags=["rules"])


@router.get("/rules", response_model=list[RuleOut])
async def list_rules(
    client_id: Optional[UUID] = Query(None),
    rule_type: Optional[str] = Query(None),
    tool: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Rule)
    conditions = []
    if client_id:
        conditions.append(Rule.client_id == client_id)
    if rule_type:
        rt_result = await db.execute(select(RuleType).where(RuleType.slug == rule_type))
        rt = rt_result.scalar_one_or_none()
        if rt:
            conditions.append(Rule.rule_type_id == rt.id)
    if tool:
        conditions.append(Rule.tool == tool)
    if search:
        conditions.append(Rule.name.ilike(f"%{search}%"))
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(Rule.created_at)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/rules", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(body: RuleCreate, db: AsyncSession = Depends(get_db)):
    rule = Rule(**body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/rules/{rule_id}", response_model=RuleOut)
async def get_rule(rule_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/rules/{rule_id}", response_model=RuleOut)
async def update_rule(rule_id: UUID, body: RuleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()


@router.post("/rules/{rule_id}/copy", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
async def copy_rule(rule_id: UUID, body: RuleCopyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Verify target client exists
    client_result = await db.execute(select(Client).where(Client.id == body.target_client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Target client not found")

    copy = Rule(
        client_id=body.target_client_id,
        rule_type_id=original.rule_type_id,
        name=f"{original.name}_copy",
        description=original.description,
        tool=original.tool,
        condition_raw=original.condition_raw,
        action_raw=original.action_raw,
        condition_meta=original.condition_meta,
        action_meta=original.action_meta,
        enabled=original.enabled,
        priority=original.priority,
        window=original.window,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy
