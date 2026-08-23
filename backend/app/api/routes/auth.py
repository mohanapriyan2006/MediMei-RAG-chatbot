from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.database import get_db_session
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserOut, Token
from app.core.security import verify_password, get_password_hash, create_access_token
from app.dependencies.auth import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegister,
    db: AsyncSession = Depends(get_db_session)
):
    """Register a new user, checking duplicate email constraints."""
    # Check duplicate email
    result = await db.execute(select(User).filter(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email is already registered."
        )
    
    # Hash password and create user
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        role=user_in.role or "user"
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
async def login(
    user_in: UserLogin,
    db: AsyncSession = Depends(get_db_session)
):
    """Authenticate user with credentials and return a signed JWT access token."""
    # Find user by email
    result = await db.execute(select(User).filter(User.email == user_in.email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Create a new account.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token using user_id as subject
    access_token = create_access_token(subject=user.user_id, role=user.role)
    return Token(access_token=access_token)

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Fetch profile of currently logged-in user."""
    return current_user
