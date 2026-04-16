from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User, Token, UserClientAccess
from schemas import UserCreate, LoginRequest, TokenOut, MeOut, ChangePasswordRequest
from auth_deps import get_current_user
from security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


async def _build_token_out(user: User, db: AsyncSession) -> TokenOut:
    """Create a new token for the user, return TokenOut with client_access_ids."""
    token = Token(user_id=user.id)
    db.add(token)
    await db.flush()
    access_result = await db.execute(
        select(UserClientAccess.client_id).where(UserClientAccess.user_id == user.id)
    )
    client_access_ids = [row[0] for row in access_result.all()]
    await db.commit()
    return TokenOut(
        token=token.token,
        user=user,
        client_access_ids=client_access_ids,
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role="contributor",
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Username already taken")
    return await _build_token_out(user, db)


@router.post("/login", response_model=TokenOut)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return await _build_token_out(user, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_value = authorization[7:]
    result = await db.execute(select(Token).where(Token.token == token_value))
    token = result.scalar_one_or_none()
    if token:
        await db.delete(token)
        await db.commit()


@router.get("/me", response_model=MeOut)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access_result = await db.execute(
        select(UserClientAccess.client_id).where(UserClientAccess.user_id == current_user.id)
    )
    client_access_ids = [row[0] for row in access_result.all()]
    return MeOut(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        client_access_ids=client_access_ids,
    )


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
