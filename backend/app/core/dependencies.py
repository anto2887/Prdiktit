"""
Dependency Injection Container
Manages dependencies to avoid circular imports
"""

from typing import Generator, Optional
from sqlalchemy.orm import Session
from fastapi import Depends, Header, HTTPException, status
from ..db.session_manager import get_db, get_db_sync
from ..core.security import oauth2_scheme, get_current_user, get_current_active_user
from ..services.session_service import session_service
from ..db.models import User

# Database session dependency
def get_database_session() -> Generator[Session, None, None]:
    """Get database session dependency"""
    yield from get_db()

def get_database_session_sync() -> Session:
    """Get synchronous database session dependency"""
    return get_db_sync()

# Override the security dependencies
def get_current_user_dependency():
    """Get current user dependency with proper database session"""
    from ..core.security import get_current_user
    from ..db.session_manager import get_db
    
    async def _get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
        return await get_current_user(token=token, db=db)
    
    return _get_current_user

def get_current_active_user_dependency():
    """Get current active user dependency with proper database session"""
    from ..core.security import get_current_active_user
    
    async def _get_current_active_user(current_user = Depends(get_current_user_dependency())):
        return await get_current_active_user(current_user=current_user)
    
    return _get_current_active_user

def get_current_active_user_optional_dependency():
    """Get current active user optional dependency with proper database session"""
    from ..core.security import get_current_active_user_optional
    from ..db.session_manager import get_db
    
    async def _get_current_active_user_optional(token: str = None, db: Session = Depends(get_db)):
        return await get_current_active_user_optional(token=token, db=db)
    
    return _get_current_active_user_optional

# NEW: Session-based authentication dependency
async def get_current_user_from_session(
    session_id: str = Header(..., alias="X-Session-ID"),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from session ID header
    """
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session ID required",
            headers={"WWW-Authenticate": "Session"},
        )
    
    user = session_service.validate_session(db, session_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Session"},
        )
    
    return user

async def get_current_active_user_from_session(
    current_user: User = Depends(get_current_user_from_session)
) -> User:
    """
    Get current active user from session
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
