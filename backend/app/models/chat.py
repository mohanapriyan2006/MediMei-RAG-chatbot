from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.mysql import MEDIUMTEXT as MediumText
from sqlalchemy.orm import relationship
from app.db.database import Base


class ChatSession(Base):
    __tablename__ = "sessions"

    session_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    started_at = Column(DateTime, server_default=func.current_timestamp())
    summary = Column(Text)

    # Establish relationship to messages
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", lazy="selectin")


class ChatMessage(Base):
    __tablename__ = "messages"

    message_id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("sessions.session_id"), nullable=False)
    role = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    memories_updated = Column(MediumText, nullable=True)  # JSON-serialized list of strings
    memories_used = Column(MediumText, nullable=True)  # JSON-serialized list of strings
    created_at = Column(DateTime, server_default=func.current_timestamp())

    # Inverse relationship to session
    session = relationship("ChatSession", back_populates="messages")

    # Citations relationship
    citations = relationship("Citation", lazy="selectin", cascade="all, delete-orphan")
