import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..services.oauth_service import oauth_service
from ..core.security import create_access_token
from ..db.models import User
from ..schemas import OAuthCallbackRequest, UsernameSelectionRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth", tags=["oauth"])

@router.get("/google/login")
async def google_oauth_login():
    """Initiate Google OAuth2 login flow"""
    try:
        auth_url = await oauth_service.get_google_auth_url()
        logger.info("Generated Google OAuth2 authorization URL")
        return {"auth_url": auth_url}
    except Exception as e:
        logger.error(f"Failed to generate Google OAuth URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate OAuth login"
        )

@router.get("/google/callback")
async def google_oauth_callback(
    code: str,
    state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Handle Google OAuth2 callback and create/login user"""
    try:
        logger.info(f"Received OAuth callback with code: {code[:10]}...")
        
        # Exchange authorization code for tokens
        tokens = await oauth_service.exchange_code_for_tokens(code)
        if not tokens:
            logger.error("Failed to exchange authorization code for tokens")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid authorization code"
            )
        
        # Get user info from Google
        access_token = tokens.get('access_token')
        id_token = tokens.get('id_token')
        
        if not access_token or not id_token:
            logger.error("Missing access_token or id_token in OAuth response")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OAuth response from Google"
            )
        
        # Verify ID token and get user info
        oauth_data = await oauth_service.verify_google_token(id_token)
        if not oauth_data:
            logger.error("Failed to verify Google ID token")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid ID token"
            )
        
        logger.info(f"OAuth data received for email: {oauth_data['email']}")
        
        # Check if user already exists
        existing_user = await oauth_service.find_user_by_oauth(db, oauth_data['sub'])
        if existing_user:
            logger.info(f"Existing OAuth user found: {existing_user.username}")
            # Generate JWT token for existing user
            access_token = create_access_token(data={"sub": existing_user.username})
            return {"access_token": access_token, "token_type": "bearer", "user_exists": True}
        
        # Check if email is already used by a password user
        existing_email_user = await oauth_service.find_user_by_email(db, oauth_data['email'])
        if existing_email_user:
            logger.warning(f"Email {oauth_data['email']} already exists with password user")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered with password. Please use password login or contact support."
            )
        
        # New OAuth user - redirect to username selection
        # Store OAuth data in session or temporary storage
        # For now, we'll return the OAuth data to the frontend
        logger.info(f"New OAuth user, redirecting to username selection for email: {oauth_data['email']}")
        
        return {
            "oauth_data": {
                "sub": oauth_data['sub'],
                "email": oauth_data['email'],
                "name": oauth_data.get('name', ''),
                "picture": oauth_data.get('picture', '')
            },
            "requires_username": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in OAuth callback: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during OAuth callback"
        )

@router.post("/google/complete")
async def complete_oauth_registration(
    request: UsernameSelectionRequest,
    db: Session = Depends(get_db)
):
    """Complete OAuth registration by creating user with selected username"""
    try:
        logger.info(f"Completing OAuth registration for email: {request.email}")
        
        # Validate username
        if not request.username or len(request.username) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be at least 3 characters long"
            )
        
        # Check if username is already taken
        existing_user = db.query(User).filter(User.username == request.username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken"
            )
        
        # Create OAuth user
        oauth_data = {
            'sub': request.oauth_id,
            'email': request.email
        }
        
        new_user = await oauth_service.create_oauth_user(db, oauth_data, request.username)
        if not new_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user account"
            )
        
        # Generate JWT token
        access_token = create_access_token(data={"sub": new_user.username})
        
        logger.info(f"Successfully created OAuth user: {new_user.username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "is_oauth_user": new_user.is_oauth_user
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error completing OAuth registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during user creation"
        )

@router.get("/check-username/{username}")
async def check_username_availability(username: str, db: Session = Depends(get_db)):
    """Check if a username is available"""
    try:
        # Basic validation
        if len(username) < 3:
            return {"available": False, "reason": "Username must be at least 3 characters long"}
        
        if len(username) > 30:
            return {"available": False, "reason": "Username must be less than 30 characters long"}
        
        # Check for invalid characters (only alphanumeric and underscores)
        if not username.replace('_', '').isalnum():
            return {"available": False, "reason": "Username can only contain letters, numbers, and underscores"}
        
        # Check if username is taken
        existing_user = db.query(User).filter(User.username == username).first()
        
        if existing_user:
            return {"available": False, "reason": "Username already taken"}
        
        return {"available": True, "reason": "Username is available"}
        
    except Exception as e:
        logger.error(f"Error checking username availability: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking username availability"
        )
