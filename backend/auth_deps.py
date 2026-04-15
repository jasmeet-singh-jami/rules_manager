from uuid import UUID
from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, Token, UserClientAccess


async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_value = authorization[7:]
    result = await db.execute(select(Token).where(Token.token == token_value))
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_result = await db.execute(select(User).where(User.id == token.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def check_client_access(user: User, client_id: UUID, db: AsyncSession) -> None:
    """Raises 403 if the user does not have edit access to the given client."""
    if user.role == "admin":
        return
    result = await db.execute(
        select(UserClientAccess).where(
            UserClientAccess.user_id == user.id,
            UserClientAccess.client_id == client_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="No edit access to this client")
