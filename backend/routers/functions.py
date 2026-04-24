from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import DrlFunction, DrlImport, RuleType, User
from schemas import (
    DrlFunctionOut, DrlFunctionCreate, DrlFunctionUpdate,
    DrlImportOut, DrlImportCreate, DrlImportUpdate,
)
from auth_deps import get_current_user, require_admin

router = APIRouter(tags=["functions"])


async def _get_rt_or_404(rule_type_id: UUID, db: AsyncSession) -> RuleType:
    result = await db.execute(select(RuleType).where(RuleType.id == rule_type_id))
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=404, detail="Rule type not found")
    return rt


@router.get("/rule-types/{rule_type_id}/functions", response_model=list[DrlFunctionOut])
async def list_functions(
    rule_type_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    result = await db.execute(select(DrlFunction).where(DrlFunction.rule_type_id == rule_type_id))
    return result.scalars().all()


@router.post("/rule-types/{rule_type_id}/functions", response_model=DrlFunctionOut, status_code=status.HTTP_201_CREATED)
async def create_function(
    rule_type_id: UUID,
    body: DrlFunctionCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    func = DrlFunction(rule_type_id=rule_type_id, name=body.name, body=body.body)
    db.add(func)
    await db.commit()
    await db.refresh(func)
    return func


@router.put("/rule-types/{rule_type_id}/functions/{function_id}", response_model=DrlFunctionOut)
async def update_function(
    rule_type_id: UUID,
    function_id: UUID,
    body: DrlFunctionUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlFunction).where(DrlFunction.id == function_id, DrlFunction.rule_type_id == rule_type_id)
    )
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    if body.name is not None:
        func.name = body.name
    if body.body is not None:
        func.body = body.body
    await db.commit()
    await db.refresh(func)
    return func


@router.delete("/rule-types/{rule_type_id}/functions/{function_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_function(
    rule_type_id: UUID,
    function_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlFunction).where(DrlFunction.id == function_id, DrlFunction.rule_type_id == rule_type_id)
    )
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    await db.delete(func)
    await db.commit()


@router.get("/rule-types/{rule_type_id}/imports", response_model=list[DrlImportOut])
async def list_imports(
    rule_type_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    result = await db.execute(select(DrlImport).where(DrlImport.rule_type_id == rule_type_id))
    return result.scalars().all()


@router.post("/rule-types/{rule_type_id}/imports", response_model=DrlImportOut, status_code=status.HTTP_201_CREATED)
async def create_import(
    rule_type_id: UUID,
    body: DrlImportCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_rt_or_404(rule_type_id, db)
    imp = DrlImport(rule_type_id=rule_type_id, statement=body.statement, kind=body.kind, is_shared=body.is_shared)
    db.add(imp)
    await db.commit()
    await db.refresh(imp)
    return imp


@router.put("/rule-types/{rule_type_id}/imports/{import_id}", response_model=DrlImportOut)
async def update_import(
    rule_type_id: UUID,
    import_id: UUID,
    body: DrlImportUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlImport).where(DrlImport.id == import_id, DrlImport.rule_type_id == rule_type_id)
    )
    imp = result.scalar_one_or_none()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    if body.statement is not None:
        imp.statement = body.statement
    if body.kind is not None:
        imp.kind = body.kind
    if body.is_shared is not None:
        imp.is_shared = body.is_shared
    await db.commit()
    await db.refresh(imp)
    return imp


@router.delete("/rule-types/{rule_type_id}/imports/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_import(
    rule_type_id: UUID,
    import_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DrlImport).where(DrlImport.id == import_id, DrlImport.rule_type_id == rule_type_id)
    )
    imp = result.scalar_one_or_none()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    await db.delete(imp)
    await db.commit()
