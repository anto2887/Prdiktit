"""
Database Session Management
Separated from database.py to avoid circular imports
"""

from sqlalchemy.orm import Session
from .database import SessionLocal
import logging

logger = logging.getLogger(__name__)

def get_db():
    """Get database session - moved here to avoid circular imports"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_sync():
    """Get database session for synchronous operations"""
    return SessionLocal()

def close_db(db: Session):
    """Close database session explicitly"""
    if db:
        db.close()

class DatabaseSessionManager:
    """Context manager for database sessions"""
    
    def __init__(self):
        self.db = None
    
    def __enter__(self):
        self.db = SessionLocal()
        return self.db
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.db:
            self.db.close()
    
    async def __aenter__(self):
        self.db = SessionLocal()
        return self.db
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.db:
            self.db.close()
