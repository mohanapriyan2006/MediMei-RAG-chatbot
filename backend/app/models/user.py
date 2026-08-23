from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, Boolean
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="user")
    memory_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __init__(self, **kwargs):
        if "user_id" not in kwargs:
            kwargs["user_id"] = str(uuid.uuid4())
        super().__init__(**kwargs)
