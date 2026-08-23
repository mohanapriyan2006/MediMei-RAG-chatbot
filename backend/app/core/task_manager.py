import asyncio
import logging
from typing import Optional, Set

logger = logging.getLogger(__name__)


class TaskCancelledError(Exception):
    """Raised when a background task is cancelled by the user."""

    pass


class TaskManager:
    """In-memory registry of cancelled task IDs.

    Long-running services receive a task_id and should call
    :meth:`raise_if_cancelled` at safe boundaries. When a task is cancelled,
    the next checkpoint raises :class:`TaskCancelledError` so the work stops.
    """

    def __init__(self):
        self._cancelled: Set[str] = set()
        self._lock = asyncio.Lock()

    async def cancel(self, task_id: str) -> None:
        async with self._lock:
            self._cancelled.add(task_id)
        logger.info("Task %s marked for cancellation", task_id)

    async def is_cancelled(self, task_id: Optional[str]) -> bool:
        if not task_id:
            return False
        async with self._lock:
            return task_id in self._cancelled

    async def reset(self, task_id: str) -> None:
        async with self._lock:
            self._cancelled.discard(task_id)

    async def raise_if_cancelled(self, task_id: Optional[str]) -> None:
        if await self.is_cancelled(task_id):
            raise TaskCancelledError(f"Task {task_id} was cancelled")


task_manager = TaskManager()
