from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Rule, DrlFunction, DrlImport, User
from schemas import ParsedFilePreview, ParsedRulePreview, ImportConfirmRequest
from services.drl_parser import parse_drl
from auth_deps import get_current_user, check_client_access

router = APIRouter(tags=["import"])


@router.post("/import/parse", response_model=ParsedFilePreview)
async def parse_drl_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    if not file.filename.endswith(".drl"):
        raise HTTPException(status_code=422, detail="Only .drl files are accepted")
    content = (await file.read()).decode("utf-8", errors="replace")
    parsed = parse_drl(content)
    return ParsedFilePreview(
        filename=file.filename,
        package=parsed.package,
        rule_count=len(parsed.rules),
        functions=[{"name": f.name, "body": f.body} for f in parsed.functions],
        imports=[{"statement": i.statement, "kind": i.kind} for i in parsed.imports],
        rules=[
            ParsedRulePreview(
                name=r.name,
                condition_raw=r.condition_raw,
                action_raw=r.action_raw,
                required_function_names=r.required_function_names,
                required_import_statements=r.required_import_statements,
            )
            for r in parsed.rules
        ],
    )


@router.post("/import/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_import(
    body: ImportConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    checked_client_ids: set = set()
    for r in body.rules:
        if r.client_id not in checked_client_ids:
            await check_client_access(current_user, r.client_id, db)
            checked_client_ids.add(r.client_id)

    # Upsert functions
    existing_funcs = await db.execute(
        select(DrlFunction).where(DrlFunction.rule_type_id == body.rule_type_id)
    )
    func_by_name = {f.name: f for f in existing_funcs.scalars().all()}
    for f in body.functions:
        if f.name in func_by_name:
            func_by_name[f.name].body = f.body
        else:
            db.add(DrlFunction(rule_type_id=body.rule_type_id, name=f.name, body=f.body))

    # Upsert imports
    existing_imps = await db.execute(
        select(DrlImport).where(DrlImport.rule_type_id == body.rule_type_id)
    )
    existing_stmts = {i.statement for i in existing_imps.scalars().all()}
    for imp in body.imports:
        if imp.statement not in existing_stmts:
            db.add(DrlImport(rule_type_id=body.rule_type_id, statement=imp.statement, kind=imp.kind, is_shared=False))

    # Create rules
    rule_ids = []
    for r in body.rules:
        rule = Rule(
            client_id=r.client_id,
            rule_type_id=r.rule_type_id,
            name=r.name,
            description=r.description,
            tool=r.tool,
            condition_raw=r.condition_raw,
            action_raw=r.action_raw,
            required_function_names=r.required_function_names or [],
            required_import_statements=r.required_import_statements or [],
        )
        db.add(rule)
        await db.flush()
        rule_ids.append(str(rule.id))

    await db.commit()
    return {"imported": len(rule_ids), "rule_ids": rule_ids}
