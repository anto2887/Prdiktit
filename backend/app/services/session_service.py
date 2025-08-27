"""
Session Service for managing user sessions
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..db.models import UserSession, User
from ..core.config import settings
from ..core.security import create_access_token

logger = logging.getLogger(__name__)

class SessionService:
    """Service for managing user sessions"""
    
    def __init__(self):
        self.session_expiry_hours = 24 * 7  # 7 days default
        
    def create_session(self, db: Session, user: User, user_agent: Optional[str] = None, 
                      ip_address: Optional[str] = None) -> Tuple[str, str]:
        """
        Create a new user session
        
        Returns:
            Tuple of (session_id, access_token)
        """
        try:
            # Generate unique session ID
            session_id = str(uuid.uuid4())
            
            # Create JWT access token
            access_token = create_access_token(subject=user.username)
            
            # Calculate expiry
            expires_at = datetime.now(timezone.utc) + timedelta(hours=self.session_expiry_hours)
            
            # Create session record
            session = UserSession(
                user_id=user.id,
                session_id=session_id,
                access_token=access_token,
                expires_at=expires_at,
                user_agent=user_agent,
                ip_address=ip_address
            )
            
            db.add(session)
            db.commit()
            db.refresh(session)
            
            logger.info(f"✅ Created session {session_id} for user {user.username}")
            return session_id, access_token
            
        except Exception as e:
            logger.error(f"❌ Failed to create session for user {user.username}: {str(e)}")
            db.rollback()
            raise
    
    def validate_session(self, db: Session, session_id: str) -> Optional[User]:
        """
        Validate a session ID and return the associated user
        
        Returns:
            User object if session is valid, None otherwise
        """
        try:
            # Find active session
            session = db.query(UserSession).filter(
                and_(
                    UserSession.session_id == session_id,
                    UserSession.is_active == True,
                    UserSession.expires_at > datetime.now(timezone.utc)
                )
            ).first()
            
            if not session:
                logger.warning(f"⚠️ Invalid or expired session: {session_id}")
                return None
            
            # Update last used timestamp
            session.last_used = datetime.now(timezone.utc)
            db.commit()
            
            # Get user
            user = db.query(User).filter(User.id == session.user_id).first()
            if not user or not user.is_active:
                logger.warning(f"⚠️ Session {session_id} references inactive user")
                return None
            
            logger.debug(f"✅ Validated session {session_id} for user {user.username}")
            return user
            
        except Exception as e:
            logger.error(f"❌ Session validation error: {str(e)}")
            return None
    
    def invalidate_session(self, db: Session, session_id: str) -> bool:
        """
        Invalidate a session (logout)
        
        Returns:
            True if session was invalidated, False otherwise
        """
        try:
            session = db.query(UserSession).filter(
                UserSession.session_id == session_id
            ).first()
            
            if session:
                session.is_active = False
                db.commit()
                logger.info(f"✅ Invalidated session {session_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to invalidate session {session_id}: {str(e)}")
            db.rollback()
            return False
    
    def cleanup_expired_sessions(self, db: Session) -> int:
        """
        Remove expired sessions from database
        
        Returns:
            Number of sessions cleaned up
        """
        try:
            expired_sessions = db.query(UserSession).filter(
                UserSession.expires_at <= datetime.now(timezone.utc)
            ).all()
            
            count = len(expired_sessions)
            for session in expired_sessions:
                db.delete(session)
            
            db.commit()
            logger.info(f"🧹 Cleaned up {count} expired sessions")
            return count
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup expired sessions: {str(e)}")
            db.rollback()
            return 0
    
    def get_user_sessions(self, db: Session, user_id: int) -> list:
        """
        Get all active sessions for a user
        
        Returns:
            List of active sessions
        """
        try:
            sessions = db.query(UserSession).filter(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.is_active == True
                )
            ).all()
            
            return sessions
            
        except Exception as e:
            logger.error(f"❌ Failed to get sessions for user {user_id}: {str(e)}")
            return []

# Create global instance
session_service = SessionService()
