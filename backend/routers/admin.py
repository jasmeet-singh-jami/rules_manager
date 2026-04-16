from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User, UserClientAccess
from schemas import UserWithClientsOut, AdminResetPasswordRequest
from auth_deps import require_admin
from security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserWithClientsOut])
async def list_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users_result = await db.execute(select(User).order_by(User.created_at))
    users = users_result.scalars().all()

    access_result = await db.execute(select(UserClientAccess))
    access_rows = access_result.scalars().all()

    access_map: dict[str, list[UUID]] = {}
    for row in access_rows:
        key = str(row.user_id)
        access_map.setdefault(key, []).append(row.client_id)

    return [
        UserWithClientsOut(
            id=u.id,
            username=u.username,
            role=u.role,
            client_ids=access_map.get(str(u.id), []),
        )
        for u in users
    ]


@router.post(
    "/users/{user_id}/clients/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def grant_client_access(
    user_id: UUID,
    client_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    access = UserClientAccess(user_id=user_id, client_id=client_id)
    db.add(access)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # Already exists — idempotent, treat as success


@router.delete(
    "/users/{user_id}/clients/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_client_access(
    user_id: UUID,
    client_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserClientAccess).where(
            UserClientAccess.user_id == user_id,
            UserClientAccess.client_id == client_id,
        )
    )
    access = result.scalar_one_or_none()
    if access:
        await db.delete(access)
        await db.commit()


@router.patch(
    "/users/{user_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reset_user_password(
    user_id: UUID,
    body: AdminResetPasswordRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
