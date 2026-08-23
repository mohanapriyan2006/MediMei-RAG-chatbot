import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.memory import UserMemory
from app.schemas.memory import MemoryCreate, MemoryResponse, MemoryToggle

logger = logging.getLogger(__name__)
router = APIRouter(tags=["memories"])


@router.get("", response_model=List[MemoryResponse])
async def get_memories(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get all stored memories for the current user.
    """
    result = await db.execute(
        select(UserMemory)
        .filter(UserMemory.user_id == current_user.user_id)
        .order_by(UserMemory.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    request: MemoryCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Manually add a memory / preference for the current user.
    """
    content = request.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Memory content cannot be empty."
        )

    new_memory = UserMemory(
        user_id=current_user.user_id,
        content=content
    )
    db.add(new_memory)
    await db.commit()
    await db.refresh(new_memory)
    return new_memory


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a specific user memory.
    """
    result = await db.execute(
        select(UserMemory).filter(
            UserMemory.memory_id == memory_id,
            UserMemory.user_id == current_user.user_id
        )
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found or does not belong to user."
        )
    if memory.is_default:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Default greeting memory cannot be deleted."
        )

    await db.delete(memory)
    await db.commit()
    return


@router.post("/clear", status_code=status.HTTP_204_NO_CONTENT)
async def clear_memories(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Clear all stored memories for the current user.
    """
    result = await db.execute(
        select(UserMemory).filter(
            UserMemory.user_id == current_user.user_id,
            UserMemory.is_default.is_(False)
        )
    )
    memories = result.scalars().all()
    for m in memories:
        await db.delete(m)
    await db.commit()
    return


@router.post("/toggle", status_code=status.HTTP_200_OK)
async def toggle_memory(
    request: MemoryToggle,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Toggle the AI Memory feature status (enabled/disabled).
    """
    current_user.memory_enabled = request.memory_enabled
    db.add(current_user)
    await db.commit()
    return {"memory_enabled": current_user.memory_enabled}
