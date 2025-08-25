import logging
import requests
from typing import Optional, Dict, Any
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from google.auth.exceptions import GoogleAuthError
from ..core.config import settings
from ..db.models import User
from ..db.session_manager import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class OAuthService:
    """Service for handling OAuth2 authentication flows"""
    
    def __init__(self):
        self.google_client_id = settings.GOOGLE_CLIENT_ID
        self.google_client_secret = settings.GOOGLE_CLIENT_SECRET
        self.oauth_redirect_uri = settings.OAUTH_REDIRECT_URI
    
    async def verify_google_token(self, id_token_string: str) -> Optional[Dict[str, Any]]:
        """Verify Google ID token and return user info"""
        try:
            # Verify the token
            idinfo = id_token.verify_oauth2_token(
                id_token_string, 
                google_requests.Request(), 
                self.google_client_id
            )
            
            # Check if token is valid
            if idinfo['aud'] != self.google_client_id:
                logger.error(f"Token audience mismatch: {idinfo['aud']} != {self.google_client_id}")
                return None
                
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                logger.error(f"Invalid token issuer: {idinfo['iss']}")
                return None
            
            return {
                'sub': idinfo['sub'],  # Google's unique user ID
                'email': idinfo['email'],
                'email_verified': idinfo.get('email_verified', False),
                'name': idinfo.get('name', ''),
                'picture': idinfo.get('picture', ''),
                'given_name': idinfo.get('given_name', ''),
                'family_name': idinfo.get('family_name', '')
            }
            
        except GoogleAuthError as e:
            logger.error(f"Google token verification failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in Google token verification: {e}")
            return None
    
    async def get_google_auth_url(self) -> str:
        """Generate Google OAuth2 authorization URL"""
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        params = {
            'client_id': self.google_client_id,
            'redirect_uri': self.oauth_redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        # Build query string
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query_string}"
    
    async def exchange_code_for_tokens(self, authorization_code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access and ID tokens"""
        try:
            token_url = "https://oauth2.googleapis.com/token"
            data = {
                'client_id': self.google_client_id,
                'client_secret': self.google_client_secret,
                'code': authorization_code,
                'grant_type': 'authorization_code',
                'redirect_uri': self.oauth_redirect_uri
            }
            
            response = requests.post(token_url, data=data)
            response.raise_for_status()
            
            tokens = response.json()
            return tokens
            
        except requests.RequestException as e:
            logger.error(f"Failed to exchange code for tokens: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in token exchange: {e}")
            return None
    
    async def get_user_info_from_tokens(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Get user info from Google using access token"""
        try:
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {'Authorization': f'Bearer {access_token}'}
            
            response = requests.get(userinfo_url, headers=headers)
            response.raise_for_status()
            
            return response.json()
            
        except requests.RequestException as e:
            logger.error(f"Failed to get user info from Google: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting user info: {e}")
            return None
    
    async def create_oauth_user(self, db: Session, oauth_data: Dict[str, Any], username: str) -> Optional[User]:
        """Create a new user account with OAuth data"""
        try:
            # Check if username is already taken
            existing_user = db.query(User).filter(User.username == username).first()
            if existing_user:
                logger.error(f"Username {username} is already taken")
                return None
            
            # Create new user
            new_user = User(
                username=username,
                email=oauth_data['email'],
                oauth_provider='google',
                oauth_id=oauth_data['sub'],
                is_oauth_user=True,
                is_active=True
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            logger.info(f"Created new OAuth user: {username} ({oauth_data['email']})")
            return new_user
            
        except Exception as e:
            logger.error(f"Failed to create OAuth user: {e}")
            db.rollback()
            return None
    
    async def find_user_by_oauth(self, db: Session, oauth_id: str) -> Optional[User]:
        """Find existing user by OAuth ID"""
        try:
            return db.query(User).filter(
                User.oauth_id == oauth_id,
                User.oauth_provider == 'google'
            ).first()
        except Exception as e:
            logger.error(f"Failed to find user by OAuth ID: {e}")
            return None
    
    async def find_user_by_email(self, db: Session, email: str) -> Optional[User]:
        """Find existing user by email"""
        try:
            return db.query(User).filter(User.email == email).first()
        except Exception as e:
            logger.error(f"Failed to find user by email: {e}")
            return None

# Global instance
oauth_service = OAuthService()
