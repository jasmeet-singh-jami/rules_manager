from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Deployment, DeploymentRuleSnapshot, Rule, RuleType, Client, User
from schemas import DeploymentCreate, DeploymentOut
from services.drl_generator import generate_drl_bundle
from auth_deps import get_current_user, check_client_access

router = APIRouter(tags=["deployments"])


def _rule_to_dict(rule: Rule) -> dict:
    return {
        "id": str(rule.id),
        "rule_type_id": str(rule.rule_type_id),
        "name": rule.name,
        "description": rule.description,
        "tool": rule.tool,
        "condition_raw": rule.condition_raw,
        "action_raw": rule.action_raw,
        "condition_meta": rule.condition_meta,
        "action_meta": rule.action_meta,
        "enabled": rule.enabled,
        "priority": rule.priority,
        "window": rule.window,
    }


def _rt_to_dict(rt: RuleType) -> dict:
    return {
        "id": str(rt.id),
        "slug": rt.slug,
        "name": rt.name,
        "pipeline_stage": rt.pipeline_stage,
        "drl_package": rt.drl_package,
        "drl_imports": rt.drl_imports,
        "drl_functions": rt.drl_functions,
    }


@router.get("/clients/{client_id}/deployments", response_model=list[DeploymentOut])
async def list_deployments(
    client_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deployment)
        .where(Deployment.client_id == client_id)
        .order_by(Deployment.created_at.desc())
    )
    return result.scalars().all()


@router.post("/deployments", response_model=DeploymentOut, status_code=status.HTTP_201_CREATED)
async def create_deployment(
    body: DeploymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_client_access(current_user, body.client_id, db)
    client_result = await db.execute(select(Client).where(Client.id == body.client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    deployment = Deployment(
        client_id=body.client_id,
        version=body.version,
        notes=body.notes,
        status="draft",
    )
    db.add(deployment)
    await db.flush()

    rt_result = await db.execute(select(RuleType).order_by(RuleType.pipeline_stage))
    all_rts = rt_result.scalars().all()
    rt_map = {str(rt.id): _rt_to_dict(rt) for rt in all_rts}

    rules_result = await db.execute(
        select(Rule).where(Rule.client_id == body.client_id, Rule.enabled == True)
    )
    enabled_rules = rules_result.scalars().all()

    for rule in enabled_rules:
        drl_block = (
            f'rule "{rule.name}"\n'
            f"\twhen\n"
            + "\n".join(f"\t\t{line}" for line in (rule.condition_raw or "").splitlines())
            + "\n\tthen\n"
            + "\n".join(f"\t\t{line}" for line in (rule.action_raw or "").splitlines())
            + "\nend"
        )
        snapshot = DeploymentRuleSnapshot(
            deployment_id=deployment.id,
            rule_id=rule.id,
            rule_snapshot=_rule_to_dict(rule),
            drl_block=drl_block,
            rule_type_snapshot=rt_map.get(str(rule.rule_type_id)),
        )
        db.add(snapshot)

    deployment.rule_types_snapshot = sorted(rt_map.values(), key=lambda x: x["pipeline_stage"])

    await db.commit()
    await db.refresh(deployment)
    return deployment


@router.get("/deployments/{deployment_id}", response_model=DeploymentOut)
async def get_deployment(
    deployment_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Deployment).where(Deployment.id == deployment_id))
    dep = result.scalar_one_or_none()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return dep


@router.get("/deployments/{deployment_id}/export")
async def export_deployment(
    deployment_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dep_result = await db.execute(select(Deployment).where(Deployment.id == deployment_id))
    dep = dep_result.scalar_one_or_none()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    snap_result = await db.execute(
        select(DeploymentRuleSnapshot)
        .where(DeploymentRuleSnapshot.deployment_id == deployment_id)
    )
    snapshots = snap_result.scalars().all()

    rt_rules: dict[str, tuple[dict, list[dict]]] = {}

    for snap in snapshots:
        rule_dict = snap.rule_snapshot
        rt_id = rule_dict.get("rule_type_id", "")

        if rt_id not in rt_rules:
            if snap.rule_id:
                rule_result = await db.execute(select(Rule).where(Rule.id == snap.rule_id))
                rule_obj = rule_result.scalar_one_or_none()
                if rule_obj:
                    rt_result = await db.execute(
                        select(RuleType).where(RuleType.id == rule_obj.rule_type_id)
                    )
                    rt_obj = rt_result.scalar_one_or_none()
                    if rt_obj:
                        rt_id = str(rt_obj.id)
                        rt_rules[rt_id] = (_rt_to_dict(rt_obj), [])

        if rt_id in rt_rules:
            rt_rules[rt_id][1].append({
                "name": rule_dict["name"],
                "condition_raw": rule_dict.get("condition_raw") or "",
                "action_raw": rule_dict.get("action_raw") or "",
            })

    all_rt_result = await db.execute(select(RuleType).order_by(RuleType.pipeline_stage))
    all_rts = all_rt_result.scalars().all()
    for rt_obj in all_rts:
        rt_id = str(rt_obj.id)
        if rt_id not in rt_rules:
            rt_rules[rt_id] = (_rt_to_dict(rt_obj), [])

    sorted_pairs = sorted(
        [(rt_dict, rules) for rt_dict, rules in rt_rules.values()],
        key=lambda x: x[0]["pipeline_stage"],
    )

    zip_bytes = generate_drl_bundle(sorted_pairs)
    filename = f"deployment_{dep.version}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
