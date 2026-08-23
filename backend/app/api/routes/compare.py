import logging
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.schemas.comparison import ComparisonRequest, ComparisonResult
from app.services.comparison.comparison_service import ComparisonInputError, ComparisonService
from app.core.task_manager import TaskCancelledError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["compare"])
comparison_service = ComparisonService()


@router.post("", response_model=ComparisonResult)
async def compare_documents(
    request: ComparisonRequest,
    x_task_id: str = Header(default=""),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await comparison_service.compare(request, db, task_id=x_task_id)
    except ComparisonInputError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )
    except TaskCancelledError:
        raise HTTPException(
            status_code=499,
            detail="Comparison cancelled by user."
        )
    except Exception as exc:
        error_msg = str(exc).lower()
        if any(kw in error_msg for kw in ("connecttimeout", "connecterror", "connection", "qdrant", "responsehandlingexception", "readerror", "readtimeout")):
            logger.error("Comparison failed — Qdrant unreachable: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The search engine (Qdrant) is not reachable. Please ensure Qdrant is running and try again.",
            )
        logger.error("Comparison failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Comparison failed.",
        )

