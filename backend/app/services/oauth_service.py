import logging
import requests
from typing import Optional, Dict, Any
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from google.auth.exceptions import GoogleAuthError
from ..core.config import settings
from ..db.models import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class OAuthService:
    """Service for handling OAuth2 authentication flows"""
    
    def __init__(self):
        logger.info("🔐 OAuth Service: Initializing OAuth service")
        logger.info(f"🔐 OAuth Service: GOOGLE_CLIENT_ID set: {bool(settings.GOOGLE_CLIENT_ID)}")
        logger.info(f"🔐 OAuth Service: GOOGLE_CLIENT_SECRET set: {bool(settings.GOOGLE_CLIENT_SECRET)}")
        logger.info(f"🔐 OAuth Service: OAUTH_REDIRECT_URI set: {bool(settings.OAUTH_REDIRECT_URI)}")
        
        self.google_client_id = settings.GOOGLE_CLIENT_ID
        self.google_client_secret = settings.GOOGLE_CLIENT_SECRET
        self.oauth_redirect_uri = settings.OAUTH_REDIRECT_URI
        
        if not self.google_client_id:
            logger.error("🔐 OAuth Service: GOOGLE_CLIENT_ID is not set!")
        if not self.google_client_secret:
            logger.error("🔐 OAuth Service: GOOGLE_CLIENT_SECRET is not set!")
        if not self.oauth_redirect_uri:
            logger.error("🔐 OAuth Service: OAUTH_REDIRECT_URI is not set!")
        
        logger.info("🔐 OAuth Service: Initialization complete")
    
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
        logger.info("🔐 OAuth Service: Generating Google OAuth2 authorization URL")
        logger.info(f"🔐 OAuth Service: Client ID: {self.google_client_id[:20]}...")
        logger.info(f"🔐 OAuth Service: Redirect URI: {self.oauth_redirect_uri}")
        
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        params = {
            'client_id': self.google_client_id,
            'redirect_uri': self.oauth_redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        logger.info(f"🔐 OAuth Service: OAuth parameters: {params}")
        
        # Build query string
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        auth_url = f"{base_url}?{query_string}"
        
        logger.info(f"🔐 OAuth Service: Generated auth URL: {auth_url}")
        return auth_url
    
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
            logger.info(f"🔐 OAuth Service: Token exchange successful, received: {list(tokens.keys())}")
            return tokens
            
        except requests.RequestException as e:
            logger.error(f"Failed to exchange code for tokens: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in token exchange: {e}")
            return None
    
    async def get_user_info_from_tokens(self, access_token: str, id_token: str = None) -> Optional[Dict[str, Any]]:
        """Get user info from Google using ID token (preferred) or access token"""
        try:
            # First try to decode the ID token if provided (contains sub field)
            if id_token:
                try:
                    # Decode the ID token (JWT) to get user info including 'sub'
                    from google.oauth2 import id_token as google_id_token
                    idinfo = google_id_token.verify_oauth2_token(
                        id_token, 
                        google_requests.Request(), 
                        self.google_client_id
                    )
                    
                    logger.info(f"🔐 OAuth Service: ID token decoded successfully, fields: {list(idinfo.keys())}")
                    
                    return {
                        'sub': idinfo['sub'],  # Google's unique user ID
                        'email': idinfo['email'],
                        'email_verified': idinfo.get('email_verified', False),
                        'name': idinfo.get('name', ''),
                        'picture': idinfo.get('picture', ''),
                        'given_name': idinfo.get('given_name', ''),
                        'family_name': idinfo.get('family_name', '')
                    }
                    
                except Exception as e:
                    logger.warning(f"🔐 OAuth Service: Failed to decode ID token, falling back to userinfo endpoint: {e}")
            
            # Fallback to userinfo endpoint if ID token fails or not provided
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {'Authorization': f'Bearer {access_token}'}
            
            response = requests.get(userinfo_url, headers=headers)
            response.raise_for_status()
            
            user_info = response.json()
            logger.info(f"🔐 OAuth Service: Userinfo endpoint response fields: {list(user_info.keys())}")
            
            # The userinfo endpoint doesn't have 'sub', so we need to generate a unique ID
            # We'll use the email as a fallback identifier
            if 'sub' not in user_info:
                user_info['sub'] = f"email_{user_info.get('email', 'unknown')}"
                logger.info(f"🔐 OAuth Service: Generated fallback sub ID: {user_info['sub']}")
            
            return user_info
            
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
