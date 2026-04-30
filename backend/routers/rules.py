from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, String

from database import get_db
from models import Rule, Client, RuleType, User, DrlFunction, DrlImport
from schemas import RuleCreate, RuleUpdate, RuleOut, RuleCopyRequest, RuleExportRequest
from auth_deps import get_current_user, check_client_access
from services.drl_generator import generate_drl_bundle
from services.drl_condition_renderer import render_condition, normalize_condition

router = APIRouter(tags=["rules"])


async def _validate_builder_meta(
    condition_meta: object,
    condition_raw: Optional[str],
    rule_type_id: UUID,
    db: AsyncSession,
) -> None:
    """Raise 422 when condition_meta is builder mode and re-render doesn't match condition_raw."""
    if not isinstance(condition_meta, dict):
        return
    if condition_meta.get("mode") != "builder":
        return

    rt_result = await db.execute(select(RuleType).where(RuleType.id == rule_type_id))
    rt = rt_result.scalar_one_or_none()
    if not rt or not rt.builder_config:
        return

    try:
        rendered = render_condition(condition_meta, rt.builder_config)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"condition_meta render error: {exc}") from exc

    if normalize_condition(rendered) != normalize_condition(condition_raw or ""):
        raise HTTPException(
            status_code=422,
            detail={
                "msg": "condition_meta and condition_raw are out of sync",
                "expected": rendered,
                "got": condition_raw,
            },
        )


@router.get("/rules", response_model=list[RuleOut])
async def list_rules(
    client_id: Optional[UUID] = Query(None),
    rule_type: Optional[str] = Query(None),
    tool: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Rule)
    conditions = []
    if client_id:
        conditions.append(Rule.client_id == client_id)
    if rule_type:
        rt_result = await db.execute(
            select(RuleType).where(
                or_(RuleType.slug == rule_type, RuleType.id.cast(String) == rule_type)
            )
        )
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
async def create_rule(
    body: RuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_client_access(current_user, body.client_id, db)
    await _validate_builder_meta(body.condition_meta, body.condition_raw, body.rule_type_id, db)
    rule = Rule(**body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/rules/{rule_id}", response_model=RuleOut)
async def get_rule(
    rule_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/rules/{rule_id}", response_model=RuleOut)
async def update_rule(
    rule_id: UUID,
    body: RuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await check_client_access(current_user, rule.client_id, db)
    patch = body.model_dump(exclude_none=True)
    meta_to_check = patch.get("condition_meta", rule.condition_meta)
    raw_to_check = patch.get("condition_raw", rule.condition_raw)
    await _validate_builder_meta(meta_to_check, raw_to_check, rule.rule_type_id, db)
    for field, value in patch.items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await check_client_access(current_user, rule.client_id, db)
    await db.delete(rule)
    await db.commit()


@router.post("/rules/export")
async def export_rules(
    body: RuleExportRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.rule_ids:
        raise HTTPException(status_code=400, detail="No rule IDs provided")

    rules_result = await db.execute(
        select(Rule).where(Rule.id.in_(body.rule_ids))
    )
    rules = rules_result.scalars().all()

    # Group rules by rule_type_id
    rt_id_to_rules: dict[str, list[Rule]] = {}
    for rule in rules:
        key = str(rule.rule_type_id)
        rt_id_to_rules.setdefault(key, []).append(rule)

    # Fetch rule types in pipeline_stage order
    rt_result = await db.execute(
        select(RuleType)
        .where(RuleType.id.in_([r.rule_type_id for r in rules]))
        .order_by(RuleType.pipeline_stage)
    )
    rule_types = rt_result.scalars().all()

    entries: list[tuple[dict, list[dict], list[dict], list[dict]]] = []
    for rt in rule_types:
        funcs_result = await db.execute(select(DrlFunction).where(DrlFunction.rule_type_id == rt.id))
        imps_result = await db.execute(select(DrlImport).where(DrlImport.rule_type_id == rt.id))
        funcs = [{"name": f.name, "body": f.body} for f in funcs_result.scalars().all()]
        imps = [{"statement": i.statement, "kind": i.kind, "is_shared": i.is_shared} for i in imps_result.scalars().all()]
        rt_dict = {
            "id": str(rt.id),
            "slug": rt.slug,
            "drl_package": rt.drl_package,
            "pipeline_stage": rt.pipeline_stage,
        }
        rule_dicts = [
            {
                "name": r.name,
                "condition_raw": r.condition_raw or "",
                "action_raw": r.action_raw or "",
                "required_function_names": r.required_function_names or [],
                "required_import_statements": r.required_import_statements or [],
            }
            for r in rt_id_to_rules.get(str(rt.id), [])
        ]
        entries.append((rt_dict, funcs, imps, rule_dicts))

    zip_bytes = generate_drl_bundle(entries)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="rules_export.zip"'},
    )


@router.post("/rules/{rule_id}/copy", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
async def copy_rule(
    rule_id: UUID,
    body: RuleCopyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Rule not found")
    client_result = await db.execute(select(Client).where(Client.id == body.target_client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Target client not found")
    await check_client_access(current_user, body.target_client_id, db)
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
        window=original.window,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy
