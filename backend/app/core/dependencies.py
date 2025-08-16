"""
Dependency Injection Container
Manages dependencies to avoid circular imports
"""

from typing import Generator
from sqlalchemy.orm import Session
from ..db.session_manager import get_db, get_db_sync

# Database session dependency
def get_database_session() -> Generator[Session, None, None]:
    """Get database session dependency"""
    return get_db()

def get_database_session_sync() -> Session:
    """Get synchronous database session dependency"""
    return get_db_sync()

# Override the security dependencies
def get_current_user_dependency():
    """Get current user dependency with proper database session"""
    from ..core.security import get_current_user
    from ..db.session_manager import get_db
    
    async def _get_current_user(token: str, db: Session = Depends(get_db)):
        return await get_current_user(token=token, db=db)
    
    return _get_current_user

def get_current_active_user_dependency():
    """Get current active user dependency with proper database session"""
    from ..core.security import get_current_active_user
    from ..db.session_manager import get_db
    
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
