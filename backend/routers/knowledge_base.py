import aiofiles
from uuid import UUID
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import KnowledgeDocument, KbCategory, Client, User
from schemas import KnowledgeDocumentOut
from auth_deps import get_current_user, check_client_access
from storage import knowledge_dir, unique_filename

router = APIRouter(tags=["knowledge"])


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
        cat_result = await db.execute(
            select(KbCategory.id).where(KbCategory.slug == category)
        )
        cat_id = cat_result.scalar_one_or_none()
        if cat_id:
            stmt = stmt.where(KnowledgeDocument.kb_category_id == cat_id)
        else:
            return []
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
    cat_result = await db.execute(select(KbCategory).where(KbCategory.slug == category))
    kb_cat = cat_result.scalar_one_or_none()
    if not kb_cat:
        raise HTTPException(status_code=422, detail=f"Unknown category: {category}")

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
        kb_category_id=kb_cat.id,
        name=name,
        description=description,
        filename=file.filename or "upload",
        file_path=str(dest_path),
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        uploaded_by=current_user.id,
    )
    db.add(doc)
    try:
        await db.commit()
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise
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

    await db.delete(doc)
    await db.commit()
    file_path = Path(doc.file_path)
    if file_path.exists():
        file_path.unlink()
