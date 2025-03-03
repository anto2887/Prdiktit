# app/routers/auth.py
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import (
    create_access_token, 
    get_password_hash, 
    verify_password,
    get_current_active_user
)
from ..db.session import get_db
from ..db.repositories import get_user_by_username, create_user
from ..schemas.token import LoginRequest, LoginResponse, Token, RegistrationResponse
from ..schemas.user import UserCreate, User, UserInDB

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login_access_token(
    form_data: LoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = await get_user_by_username(db, username=form_data.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.username, expires_delta=access_token_expires
    )
    
    return {
        "status": "success",
        "data": {
            "access_token": access_token,
            "token_type": "bearer"
        }
    }


@router.post("/login/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> Any:
    """
    OAuth2 compatible token login, for use with Swagger UI
    """
    user = await get_user_by_username(db, username=form_data.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    return {
        "access_token": create_access_token(
            subject=user.username, expires_delta=access_token_expires
        ),
        "token_type": "bearer"
    }


@router.post("/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    new_user: UserCreate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Register a new user
    """
    user = await get_user_by_username(db, username=new_user.username)
    
    if user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists"
        )
        
    # Create new user
    hashed_password = get_password_hash(new_user.password)
    user_data = new_user.dict()
    user_data.pop("password")
    user_data["hashed_password"] = hashed_password
    
    await create_user(db, **user_data)
    
    return {
        "status": "success",
        "message": "Registration successful"
    }


@router.get("/status", response_model=dict)
async def auth_status(
    current_user: UserInDB = Depends(get_current_active_user)
) -> Any:
    """
    Get current user authentication status
    """
    return {
        "status": "success",
        "data": {
            "authenticated": True,
            "user": {
                "id": current_user.id,
                "username": current_user.username
            }
        }
    }