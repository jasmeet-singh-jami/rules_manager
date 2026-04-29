import re
import aiofiles
from uuid import UUID
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import CronJob, ScriptCategory, Client, User
from schemas import CronJobOut
from auth_deps import get_current_user, check_client_access
from storage import cron_jobs_dir, unique_filename

router = APIRouter(tags=["cron-jobs"])


@router.get("/cron-jobs", response_model=list[CronJobOut])
async def list_cron_jobs(
    client_id: Optional[UUID] = None,
    script_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CronJob).order_by(CronJob.created_at.desc())
    if client_id:
        stmt = stmt.where(CronJob.client_id == client_id)
    if script_type:
        cat_result = await db.execute(
            select(ScriptCategory.id).where(ScriptCategory.slug == script_type)
        )
        cat_id = cat_result.scalar_one_or_none()
        if cat_id:
            stmt = stmt.where(CronJob.script_category_id == cat_id)
        else:
            return []
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/cron-jobs", response_model=CronJobOut, status_code=status.HTTP_201_CREATED)
async def upload_cron_job(
    client_id: UUID = Form(...),
    name: str = Form(...),
    description: str = Form(...),
    script: str = Form(...),
    script_type: str = Form("shell"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_result = await db.execute(select(Client).where(Client.id == client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    await check_client_access(current_user, client_id, db)

    cat_result = await db.execute(
        select(ScriptCategory).where(ScriptCategory.slug == script_type)
    )
    category = cat_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=422, detail=f"Unknown script type: {script_type}")

    slug = re.sub(r'[^\w\-]', '_', name.strip().lower().replace(' ', '_'))
    filename = f"{slug}{category.file_extension}"

    dest_dir = cron_jobs_dir(str(client_id))
    dest_name = unique_filename(filename)
    dest_path = dest_dir / dest_name

    content = script.encode("utf-8")
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(content)

    job = CronJob(
        client_id=client_id,
        script_category_id=category.id,
        name=name,
        description=description,
        filename=filename,
        file_path=str(dest_path),
        file_size=len(content),
        mime_type=category.mime_type,
        uploaded_by=current_user.id,
    )
    db.add(job)
    try:
        await db.commit()
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise
    await db.refresh(job)
    return job


@router.get("/cron-jobs/{job_id}/download")
async def download_cron_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CronJob).where(CronJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")

    if not Path(job.file_path).exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(path=job.file_path, filename=job.filename, media_type=job.mime_type)


@router.delete("/cron-jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cron_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CronJob).where(CronJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")

    await check_client_access(current_user, job.client_id, db)

    await db.delete(job)
    await db.commit()
    file_path = Path(job.file_path)
    if file_path.exists():
        file_path.unlink()
