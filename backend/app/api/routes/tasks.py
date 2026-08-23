from fastapi import APIRouter, status
from pydantic import BaseModel

from app.core.task_manager import task_manager

router = APIRouter(tags=["tasks"])


class CancelTaskResponse(BaseModel):
    cancelled: bool
    task_id: str


@router.post(
    "/{task_id}/cancel",
    response_model=CancelTaskResponse,
    status_code=status.HTTP_200_OK,
)
async def cancel_task(task_id: str):
    """Mark a running backend task as cancelled."""
    await task_manager.cancel(task_id)
    return CancelTaskResponse(cancelled=True, task_id=task_id)
