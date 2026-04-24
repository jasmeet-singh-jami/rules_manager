from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import Client, User, UserClientAccess, ClientAccessRequest
from schemas import ClientCreate, ClientUpdate, ClientOut, AccessRequestOut
from auth_deps import get_current_user, check_client_access

router = APIRouter(tags=["clients"])


@router.get("/clients", response_model=list[ClientOut])
async def list_clients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Client).order_by(Client.created_at)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/clients", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = Client(**body.model_dump())
    db.add(client)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Client code already exists")
    # Auto-grant creator full edit access
    db.add(UserClientAccess(user_id=current_user.id, client_id=client.id))
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/clients/{client_id}", response_model=ClientOut)
async def get_client(
    client_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: UUID,
    body: ClientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_client_access(current_user, client_id, db)
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_client_access(current_user, client_id, db)
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
    await db.commit()


@router.post(
    "/clients/{client_id}/request-access",
    response_model=AccessRequestOut,
    status_code=status.HTTP_201_CREATED,
)
async def request_client_access(
    client_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_result = await db.execute(select(Client).where(Client.id == client_id))
    client = client_result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Admins and users who already have access don't need to request
    if current_user.role == "admin":
        raise HTTPException(status_code=400, detail="Admins have implicit access to all clients")

    existing_access = await db.execute(
        select(UserClientAccess).where(
            UserClientAccess.user_id == current_user.id,
            UserClientAccess.client_id == client_id,
        )
    )
    if existing_access.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have access to this client")

    # Prevent duplicate pending requests
    existing_req = await db.execute(
        select(ClientAccessRequest).where(
            ClientAccessRequest.user_id == current_user.id,
            ClientAccessRequest.client_id == client_id,
            ClientAccessRequest.status == "pending",
        )
    )
    if existing_req.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already have a pending request for this client")

    req = ClientAccessRequest(user_id=current_user.id, client_id=client_id)
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return AccessRequestOut(
        id=req.id,
        user_id=req.user_id,
        username=current_user.username,
        client_id=req.client_id,
        client_name=client.name,
        client_code=client.code,
        status=req.status,
        requested_at=req.requested_at,
    )


@router.get("/access-requests/me", response_model=list[AccessRequestOut])
async def get_my_access_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ClientAccessRequest)
        .where(ClientAccessRequest.user_id == current_user.id)
        .order_by(ClientAccessRequest.requested_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    client_ids = {r.client_id for r in rows}
    clients_map: dict = {}
    if client_ids:
        c_rows = (await db.execute(select(Client).where(Client.id.in_(client_ids)))).scalars().all()
        clients_map = {c.id: c for c in c_rows}

    return [
        AccessRequestOut(
            id=r.id,
            user_id=r.user_id,
            username=current_user.username,
            client_id=r.client_id,
            client_name=clients_map[r.client_id].name if r.client_id in clients_map else "",
            client_code=clients_map[r.client_id].code if r.client_id in clients_map else "",
            status=r.status,
            requested_at=r.requested_at,
            reviewed_at=r.reviewed_at,
        )
        for r in rows
    ]
