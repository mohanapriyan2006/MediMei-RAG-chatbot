import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db_session
from app.models.citation import Citation as CitationModel
from app.schemas.evidence import Citation

logger = logging.getLogger(__name__)
router = APIRouter(tags=["citations"])

@router.get("/{citation_id}", response_model=Citation)
async def get_citation(
    citation_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(CitationModel).filter(CitationModel.citation_id == citation_id))
    citation = result.scalar_one_or_none()
    if not citation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Citation not found."
        )
        
    return Citation(
        citation_id=citation.citation_id,
        document_id=citation.document_id,
        document_name=citation.document_name or "Unknown Document",
        page=citation.page_no,
        section=citation.section,
        chunk_id=citation.chunk_id,
        text=citation.text,
        score=citation.score
    )
