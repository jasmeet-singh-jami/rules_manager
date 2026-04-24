from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User, UserClientAccess, ClientAccessRequest, Client
from schemas import UserWithClientsOut, AdminResetPasswordRequest, AccessRequestOut, UserRoleUpdate
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


@router.patch(
    "/users/{user_id}/role",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in ("admin", "contributor"):
        raise HTTPException(status_code=422, detail="Role must be 'admin' or 'contributor'")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    user.role = body.role
    await db.commit()


@router.get("/access-requests", response_model=list[AccessRequestOut])
async def list_access_requests(
    req_status: str = Query("pending", alias="status"),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ClientAccessRequest)
        .where(ClientAccessRequest.status == req_status)
        .order_by(ClientAccessRequest.requested_at)
    )
    rows = (await db.execute(stmt)).scalars().all()

    user_ids = {r.user_id for r in rows}
    client_ids = {r.client_id for r in rows}
    reviewer_ids = {r.reviewed_by_id for r in rows if r.reviewed_by_id}

    users_map: dict = {}
    if user_ids | reviewer_ids:
        u_rows = (await db.execute(select(User).where(User.id.in_(user_ids | reviewer_ids)))).scalars().all()
        users_map = {u.id: u for u in u_rows}

    clients_map: dict = {}
    if client_ids:
        c_rows = (await db.execute(select(Client).where(Client.id.in_(client_ids)))).scalars().all()
        clients_map = {c.id: c for c in c_rows}

    return [
        AccessRequestOut(
            id=r.id,
            user_id=r.user_id,
            username=users_map[r.user_id].username if r.user_id in users_map else "",
            client_id=r.client_id,
            client_name=clients_map[r.client_id].name if r.client_id in clients_map else "",
            client_code=clients_map[r.client_id].code if r.client_id in clients_map else "",
            status=r.status,
            requested_at=r.requested_at,
            reviewed_at=r.reviewed_at,
            reviewed_by_username=(
                users_map[r.reviewed_by_id].username
                if r.reviewed_by_id and r.reviewed_by_id in users_map
                else None
            ),
        )
        for r in rows
    ]


@router.post(
    "/access-requests/{request_id}/approve",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def approve_access_request(
    request_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClientAccessRequest).where(ClientAccessRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    req.status = "approved"
    req.reviewed_at = datetime.now(timezone.utc)
    req.reviewed_by_id = admin.id

    access = UserClientAccess(user_id=req.user_id, client_id=req.client_id)
    db.add(access)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        req.status = "approved"
        req.reviewed_at = datetime.now(timezone.utc)
        req.reviewed_by_id = admin.id
        await db.commit()


@router.post(
    "/access-requests/{request_id}/deny",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deny_access_request(
    request_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClientAccessRequest).where(ClientAccessRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    req.status = "denied"
    req.reviewed_at = datetime.now(timezone.utc)
    req.reviewed_by_id = admin.id
    await db.commit()
