from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from database import get_db
from models import ScriptCategory, CronJob, User
from schemas import (
    ScriptCategoryOut,
    ScriptCategoryCreate,
    ScriptCategoryUpdate,
    CategoryReorderItem,
)
from auth_deps import get_current_user, require_admin

router = APIRouter(tags=["script-categories"])


@router.get("/script-categories", response_model=list[ScriptCategoryOut])
async def list_script_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScriptCategory).order_by(ScriptCategory.sort_order))
    return result.scalars().all()


@router.post("/script-categories", response_model=ScriptCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_script_category(
    body: ScriptCategoryCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(ScriptCategory).where(ScriptCategory.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already exists")

    if body.sort_order is None:
        max_result = await db.execute(select(func.max(ScriptCategory.sort_order)))
        current_max = max_result.scalar() or 0
        sort_order = current_max + 1
    else:
        sort_order = body.sort_order

    cat = ScriptCategory(
        slug=body.slug,
        name=body.name,
        file_extension=body.file_extension,
        mime_type=body.mime_type,
        sort_order=sort_order,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/script-categories/{cat_id}", response_model=ScriptCategoryOut)
async def update_script_category(
    cat_id: UUID,
    body: ScriptCategoryUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScriptCategory).where(ScriptCategory.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.name is not None:
        cat.name = body.name
    if body.file_extension is not None:
        cat.file_extension = body.file_extension
    if body.mime_type is not None:
        cat.mime_type = body.mime_type
    if body.sort_order is not None:
        cat.sort_order = body.sort_order

    await db.commit()
    await db.refresh(cat)
    return cat


@router.post("/script-categories/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_script_categories(
    items: list[CategoryReorderItem],
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not items:
        return

    sort_orders = [it.sort_order for it in items]
    if len(sort_orders) != len(set(sort_orders)):
        raise HTTPException(status_code=422, detail="sort_order values must be unique")

    ids = [it.id for it in items]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="id values must be unique")

    found = await db.execute(select(ScriptCategory.id).where(ScriptCategory.id.in_(ids)))
    existing_ids = {row[0] for row in found.all()}
    missing = [str(i) for i in ids if i not in existing_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown category id(s): {missing}")

    for it in items:
        await db.execute(
            update(ScriptCategory).where(ScriptCategory.id == it.id).values(sort_order=it.sort_order)
        )
    await db.commit()


@router.delete("/script-categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script_category(
    cat_id: UUID,
    reassign_to: Optional[UUID] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScriptCategory).where(ScriptCategory.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if reassign_to == cat_id:
        raise HTTPException(status_code=422, detail="reassign_to cannot equal the category being deleted")

    count_result = await db.execute(
        select(func.count(CronJob.id)).where(CronJob.script_category_id == cat_id)
    )
    attached = count_result.scalar() or 0

    if attached > 0:
        if reassign_to is None:
            raise HTTPException(
                status_code=409,
                detail=f"Category has {attached} attached cron job(s); provide reassign_to query param",
            )
        target_result = await db.execute(select(ScriptCategory).where(ScriptCategory.id == reassign_to))
        if not target_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="reassign_to category not found")
        await db.execute(
            update(CronJob)
            .where(CronJob.script_category_id == cat_id)
            .values(script_category_id=reassign_to)
        )

    await db.delete(cat)
    await db.commit()
