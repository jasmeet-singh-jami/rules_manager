import aiofiles
from uuid import UUID
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import KnowledgeDocument, Client, User, UserClientAccess
from schemas import KnowledgeDocumentOut
from auth_deps import get_current_user, check_client_access
from storage import knowledge_dir, unique_filename

router = APIRouter(tags=["knowledge"])

VALID_CATEGORIES = {"integrations", "automations", "issues"}


@router.get("/knowledge", response_model=list[KnowledgeDocumentOut])
async def list_knowledge_docs(
    client_id: Optional[UUID] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())
    if client_id:
        stmt = stmt.where(KnowledgeDocument.client_id == client_id)
    if category:
        stmt = stmt.where(KnowledgeDocument.category == category)
    if current_user.role != "admin":
        access_result = await db.execute(
            select(UserClientAccess.client_id).where(UserClientAccess.user_id == current_user.id)
        )
        allowed = {row[0] for row in access_result}
        stmt = stmt.where(KnowledgeDocument.client_id.in_(allowed))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/knowledge", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_doc(
    client_id: UUID = Form(...),
    category: str = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {sorted(VALID_CATEGORIES)}")

    client_result = await db.execute(select(Client).where(Client.id == client_id))
    if not client_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    await check_client_access(current_user, client_id, db)

    dest_dir = knowledge_dir(str(client_id))
    dest_name = unique_filename(file.filename or "upload")
    dest_path = dest_dir / dest_name

    content = await file.read()
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(content)

    doc = KnowledgeDocument(
        client_id=client_id,
        category=category,
        name=name,
        description=description,
        filename=file.filename or "upload",
        file_path=str(dest_path),
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/knowledge/{doc_id}/download")
async def download_knowledge_doc(
    doc_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role != "admin":
        access_result = await db.execute(
            select(UserClientAccess).where(
                UserClientAccess.user_id == current_user.id,
                UserClientAccess.client_id == doc.client_id,
            )
        )
        if not access_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied")

    if not Path(doc.file_path).exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(path=doc.file_path, filename=doc.filename, media_type=doc.mime_type)


@router.delete("/knowledge/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_doc(
    doc_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await check_client_access(current_user, doc.client_id, db)

    file_path = Path(doc.file_path)
    await db.delete(doc)
    await db.commit()
    if file_path.exists():
        file_path.unlink()
