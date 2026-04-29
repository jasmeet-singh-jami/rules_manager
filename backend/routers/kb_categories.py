from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from database import get_db
from models import KbCategory, KnowledgeDocument, User
from schemas import (
    KbCategoryOut,
    KbCategoryCreate,
    KbCategoryUpdate,
    CategoryReorderItem,
)
from auth_deps import get_current_user, require_admin

router = APIRouter(tags=["kb-categories"])


@router.get("/kb-categories", response_model=list[KbCategoryOut])
async def list_kb_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KbCategory).order_by(KbCategory.sort_order))
    return result.scalars().all()


@router.post("/kb-categories", response_model=KbCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_kb_category(
    body: KbCategoryCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(KbCategory).where(KbCategory.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already exists")

    if body.sort_order is None:
        max_result = await db.execute(select(func.max(KbCategory.sort_order)))
        current_max = max_result.scalar() or 0
        sort_order = current_max + 1
    else:
        sort_order = body.sort_order

    cat = KbCategory(slug=body.slug, name=body.name, sort_order=sort_order)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.patch("/kb-categories/{cat_id}", response_model=KbCategoryOut)
async def update_kb_category(
    cat_id: UUID,
    body: KbCategoryUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KbCategory).where(KbCategory.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.name is not None:
        cat.name = body.name
    if body.sort_order is not None:
        cat.sort_order = body.sort_order

    await db.commit()
    await db.refresh(cat)
    return cat


@router.post("/kb-categories/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_kb_categories(
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

    found = await db.execute(select(KbCategory.id).where(KbCategory.id.in_(ids)))
    existing_ids = {row[0] for row in found.all()}
    missing = [str(i) for i in ids if i not in existing_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown category id(s): {missing}")

    for it in items:
        await db.execute(
            update(KbCategory).where(KbCategory.id == it.id).values(sort_order=it.sort_order)
        )
    await db.commit()


@router.delete("/kb-categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb_category(
    cat_id: UUID,
    reassign_to: Optional[UUID] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KbCategory).where(KbCategory.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if reassign_to == cat_id:
        raise HTTPException(status_code=422, detail="reassign_to cannot equal the category being deleted")

    count_result = await db.execute(
        select(func.count(KnowledgeDocument.id)).where(KnowledgeDocument.kb_category_id == cat_id)
    )
    attached = count_result.scalar() or 0

    if attached > 0:
        if reassign_to is None:
            raise HTTPException(
                status_code=409,
                detail=f"Category has {attached} attached document(s); provide reassign_to query param",
            )
        target_result = await db.execute(select(KbCategory).where(KbCategory.id == reassign_to))
        if not target_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="reassign_to category not found")
        await db.execute(
            update(KnowledgeDocument)
            .where(KnowledgeDocument.kb_category_id == cat_id)
            .values(kb_category_id=reassign_to)
        )

    await db.delete(cat)
    await db.commit()
