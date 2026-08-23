from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    role: Optional[str] = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    user_id: str
    email: EmailStr
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None
    iat: Optional[int] = None
