from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Rule, User
from schemas import ParsedFilePreview, ImportConfirmRequest
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
        rules=[
            {"name": r.name, "condition_raw": r.condition_raw, "action_raw": r.action_raw}
            for r in parsed.rules
        ],
    )


@router.post("/import/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_import(
    body: ImportConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify access for every unique client_id in the request
    checked_client_ids: set = set()
    for r in body.rules:
        if r.client_id not in checked_client_ids:
            await check_client_access(current_user, r.client_id, db)
            checked_client_ids.add(r.client_id)

    rule_ids = []
    for r in body.rules:
        rule = Rule(**r.model_dump())
        db.add(rule)
        await db.flush()
        rule_ids.append(str(rule.id))
    await db.commit()
    return {"imported": len(rule_ids), "rule_ids": rule_ids}
