import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from ..db.session_manager import get_db
from ..services.oauth_service import oauth_service
# JWT token generation removed - using session-based authentication only
from ..db.models import User
from ..schemas import OAuthCallbackRequest, UsernameSelectionRequest
from ..services.session_service import session_service
from ..db.repository import get_user_by_oauth_id, create_oauth_user, is_username_available

logger = logging.getLogger(__name__)

router = APIRouter(tags=["oauth"])

@router.get("/google/login")
async def google_oauth_login():
    """Get Google OAuth2 authorization URL"""
    try:
        auth_url = await oauth_service.get_google_auth_url()
        return {"auth_url": auth_url}
    except Exception as e:
        logger.error(f"Failed to generate Google OAuth URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate OAuth URL"
        )

@router.get("/google/callback")
async def google_oauth_callback(
    code: str,
    state: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Handle Google OAuth callback and create user session
    """
    try:
        logger.info(f"Received OAuth callback with code: {code[:20]}...")
        
        # Exchange code for tokens
        token_data = await oauth_service.exchange_code_for_tokens(code)
        logger.info(f"🔐 OAuth Router: Token data received: {list(token_data.keys())}")
        
        # Get user info using ID token if available, otherwise fall back to access token
        id_token = token_data.get('id_token')
        user_info = await oauth_service.get_user_info_from_tokens(
            token_data['access_token'], 
            id_token=id_token
        )
        
        logger.info(f"🔐 OAuth Router: OAuth data received for email: {user_info.get('email')}")
        logger.info(f"🔐 OAuth Router: User info fields: {list(user_info.keys())}")
        logger.info(f"🔐 OAuth Router: Sub field value: {user_info.get('sub', 'NOT_FOUND')}")
        
        # Check if user exists
        existing_user = await get_user_by_oauth_id(db, user_info['sub'], 'google')
        
        if existing_user:
            logger.info(f"Existing OAuth user found: {existing_user.username}")
            
            # Create session for existing user
            session_id, _ = session_service.create_session(
                db, existing_user, 
                user_agent=request.headers.get('user-agent') if request else None,
                ip_address=request.client.host if request and request.client else None
            )
            
            return {
                "user_exists": True,
                "session_id": session_id,
                "user": {
                    "id": existing_user.id,
                    "username": existing_user.username,
                    "email": existing_user.email,
                    "is_oauth_user": existing_user.is_oauth_user
                }
            }
        else:
            logger.info(f"New OAuth user, redirecting to username selection for email: {user_info.get('email')}")
            
            # Store OAuth data for username selection
            oauth_data = {
                "email": user_info.get('email'),
                "oauth_provider": "google",
                "oauth_id": user_info['sub'],
                "access_token": token_data['access_token']
            }
            
            return {
                "user_exists": False,
                "requires_username": True,
                "oauth_data": oauth_data
            }
            
    except KeyError as e:
        logger.error(f"🔐 OAuth Router: Missing required field in user info: {str(e)}")
        logger.error(f"🔐 OAuth Router: User info received: {user_info if 'user_info' in locals() else 'Not available'}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth callback failed: Missing required field '{str(e)}' in user info"
        )
    except Exception as e:
        logger.error(f"🔐 OAuth Router: OAuth callback error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth callback failed: {str(e)}"
        )

@router.post("/google/complete")
async def complete_oauth_registration(
    username_data: UsernameSelectionRequest,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Complete OAuth registration with chosen username
    """
    try:
        # Check username availability
        if not await is_username_available(db, username_data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        # Create new user
        new_user = await create_oauth_user(
            db,
            username=username_data.username,
            email=username_data.email,
            oauth_provider=username_data.oauth_provider,
            oauth_id=username_data.oauth_id
        )
        
        # Create session for new user
        session_id, _ = session_service.create_session(
            db, new_user,
            user_agent=request.headers.get('user-agent') if request else None,
            ip_address=request.client.host if request and request.client else None
        )
        
        return {
            "success": True,
            "session_id": session_id,
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "is_oauth_user": new_user.is_oauth_user
            }
        }
        
    except Exception as e:
        logger.error(f"OAuth completion error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth completion failed: {str(e)}"
        )

@router.get("/check-username/{username}")
async def check_username_availability(username: str, db: Session = Depends(get_db)):
    """Check if username is available"""
    try:
        available = await is_username_available(db, username)
        return {"available": available}
    except Exception as e:
        logger.error(f"Username check error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check username availability"
        )
