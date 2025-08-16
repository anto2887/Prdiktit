# app/routers/auth.py
from datetime import timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import (
    create_access_token, 
    get_password_hash, 
    verify_password
)
from ..core.dependencies import get_current_active_user_dependency, get_current_active_user_optional_dependency
from ..db.session_manager import get_db
from ..db.repository import get_user_by_username, create_user
from ..schemas import (
    LoginRequest, LoginResponse, Token, UserCreate, User, BaseResponse
)

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login_access_token(
    form_data: LoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    try:
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
        
        return LoginResponse(
            status="success",
            data={
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email
                }
            }
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the actual error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Login error: {str(e)}")
        
        # Return a generic error to the client
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )


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


@router.post("/register", response_model=BaseResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    new_user: UserCreate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Register a new user
    """
    # Add debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"🔍 REGISTER DEBUG: Registration request received for username: {new_user.username}")
    logger.info(f"🔍 REGISTER DEBUG: Request data: {new_user.dict()}")
    
    user = await get_user_by_username(db, username=new_user.username)
    
    if user:
        logger.warning(f"🔍 REGISTER DEBUG: Username {new_user.username} already exists")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists"
        )
        
    # Create new user
    hashed_password = get_password_hash(new_user.password)
    user_data = new_user.dict()
    user_data.pop("password")
    user_data["hashed_password"] = hashed_password
    
    logger.info(f"🔍 REGISTER DEBUG: Creating user with data: {user_data}")
    await create_user(db, **user_data)
    logger.info(f"🔍 REGISTER DEBUG: User {new_user.username} created successfully")
    
    return {
        "status": "success",
        "message": "Registration successful"
    }


@router.get("/status")
async def auth_status(
    current_user: Optional[User] = Depends(get_current_active_user_optional_dependency())
):
    """
    Get current user authentication status
    """
    try:
        if current_user:
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
        else:
            return {
                "status": "success",
                "data": {
                    "authenticated": False,
                    "user": None
                }
            }
    except Exception as e:
        # Log the exception
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in auth_status: {str(e)}")
        
        # Return authentication status with appropriate error info
        return {
            "status": "error",
            "message": "Authentication check failed",
            "data": {
                "authenticated": False,
                "user": None
            }
        }


@router.post("/logout")
async def logout(
    current_user: Optional[User] = Depends(get_current_active_user_optional_dependency())
):
    """
    Logout user (client-side token invalidation)
    """
    # Since we're using JWT tokens, logout is handled client-side by removing the token
    # We could add token blacklisting here if needed, but for now just return success
    return {
        "status": "success",
        "message": "Logged out successfully"
    }