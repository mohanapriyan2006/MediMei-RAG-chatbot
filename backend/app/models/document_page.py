from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey
from app.db.database import Base

class DocumentPage(Base):
    __tablename__ = "document_pages"

    document_id = Column(
        String(36),
        ForeignKey("documents.document_id"),
        primary_key=True,
        nullable=False
    )
    page_no = Column(Integer, primary_key=True, nullable=False)
    extraction_method = Column(String(50))
    quality_score = Column(Float)
    text_ref = Column(Text)

