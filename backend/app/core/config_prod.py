# backend/app/core/config_prod.py
import os
import json
from typing import List
from .config import Settings

def safe_int(env_var: str, default: int) -> int:
    """Safely convert environment variable to int, handling empty strings"""
    value = os.getenv(env_var, str(default))
    if value == '' or value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_bool(env_var: str, default: bool) -> bool:
    """Safely convert environment variable to bool"""
    value = os.getenv(env_var, str(default))
    if value == '' or value is None:
        return default
    return str(value).lower() in ('true', '1', 'yes', 'on')

def parse_string_list(value: str, default: List[str] = None) -> List[str]:
    """Parse a string into a list, handling various formats"""
    if default is None:
        default = []
    
    # Add debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"🔍 parse_string_list called with value: '{value}' (type: {type(value)})")
    logger.info(f"🔍 parse_string_list default: {default}")
    
    if not value:
        logger.info(f"🔍 parse_string_list: value is empty/falsy, returning default: {default}")
        return default
    
    # If it's JSON format
    if value.strip().startswith('[') and value.strip().endswith(']'):
        logger.info(f"🔍 parse_string_list: detected JSON format, attempting to parse")
        try:
            parsed = json.loads(value)
            logger.info(f"🔍 parse_string_list: JSON parsing successful, result: {parsed}")
            return parsed
        except json.JSONDecodeError as e:
            logger.warning(f"🔍 parse_string_list: JSON parsing failed: {e}")
            pass
    
    # Single value or comma-separated string
    if ',' in value:
        logger.info(f"🔍 parse_string_list: detected comma-separated format, splitting by comma")
        parsed = [x.strip() for x in value.split(",") if x.strip()]
        logger.info(f"🔍 parse_string_list: comma-split result: {parsed}")
        return parsed
    else:
        # Single value
        logger.info(f"🔍 parse_string_list: single value detected")
        parsed = [value.strip()] if value.strip() else default
        logger.info(f"🔍 parse_string_list: single value result: {parsed}")
        return parsed

def validate_required_env(name: str, value: str) -> str:
    """Validate that required environment variables are set"""
    if not value or value.strip() == "":
        raise ValueError(f"Required environment variable {name} is not set or is empty")
    return value

class ProductionSettings(Settings):
    # Environment validation
    ENVIRONMENT: str = "production"
    
    # Add debug logging for CORS configuration
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"🔍 ProductionSettings initialized")
        logger.info(f"🔍 CORS_ORIGINS environment variable raw value: '{os.getenv('CORS_ORIGINS', 'NOT_SET')}'")
        logger.info(f"🔍 CORS_ORIGINS after parsing: {self.CORS_ORIGINS}")
        logger.info(f"🔍 CORS_ORIGINS type: {type(self.CORS_ORIGINS)}")
        logger.info(f"🔍 CORS_ORIGINS length: {len(self.CORS_ORIGINS) if isinstance(self.CORS_ORIGINS, list) else 'NOT_A_LIST'}")
    
    # Required secrets - using exact Railway variable names
    SECRET_KEY: str = validate_required_env("SECRET_KEY", os.getenv("SECRET_KEY", ""))
    JWT_SECRET_KEY: str = validate_required_env("JWT_SECRET_KEY", os.getenv("JWT_SECRET_KEY", ""))
    DATABASE_URI: str = validate_required_env("DATABASE_URI", os.getenv("DATABASE_URI", ""))
    FOOTBALL_API_KEY: str = validate_required_env("FOOTBALL_API_KEY", os.getenv("FOOTBALL_API_KEY", ""))
    
    # API and rate limiting - matching your Railway variables
    API_RATE_LIMIT: int = safe_int("API_RATE_LIMIT", 300)
    
    # CORS - override ALL list fields to handle Railway string format safely
    CORS_ORIGINS: List[str] = parse_string_list(os.getenv("CORS_ORIGINS", ""))
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = parse_string_list(
        os.getenv("CORS_ALLOW_METHODS", ""), 
        ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    )
    CORS_ALLOW_HEADERS: List[str] = parse_string_list(
        os.getenv("CORS_ALLOW_HEADERS", ""), 
        ["Authorization", "Content-Type", "X-Requested-With"]
    )
    CORS_EXPOSE_HEADERS: List[str] = parse_string_list(
        os.getenv("CORS_EXPOSE_HEADERS", ""), 
        ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
    )
    
    # Database settings - matching your Railway variable
    CREATE_TABLES_ON_STARTUP: bool = safe_bool("CREATE_TABLES_ON_STARTUP", False)
    
    # Redis settings - matching your Railway variables
    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")  # Railway might auto-provide this
    REDIS_PORT: int = safe_int("REDIS_PORT", 6379)
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = 0
    
    # Security settings
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Production logging
    LOG_LEVEL: str = "INFO"
    
    # AWS settings
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_SECRET_NAME: str = os.getenv("SECRET_NAME", "api-football-key")
    
    # OAuth2 settings - Required for OAuth functionality
    GOOGLE_CLIENT_ID: str = validate_required_env("GOOGLE_CLIENT_ID", os.getenv("GOOGLE_CLIENT_ID", ""))
    GOOGLE_CLIENT_SECRET: str = validate_required_env("GOOGLE_CLIENT_SECRET", os.getenv("GOOGLE_CLIENT_SECRET", ""))
    OAUTH_REDIRECT_URI: str = validate_required_env("OAUTH_REDIRECT_URI", os.getenv("OAUTH_REDIRECT_URI", ""))
    
    # Rate limiting for production
    RATE_LIMIT_PER_MINUTE: int = safe_int("RATE_LIMIT_PER_MINUTE", 300)

    # Email / notifications (all injected via Railway)
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "sendgrid")
    SENDGRID_API_KEY: str = validate_required_env("SENDGRID_API_KEY", os.getenv("SENDGRID_API_KEY", ""))
    SENDGRID_FROM_EMAIL: str = validate_required_env("SENDGRID_FROM_EMAIL", os.getenv("SENDGRID_FROM_EMAIL", ""))
    SENDGRID_FROM_NAME: str = os.getenv("SENDGRID_FROM_NAME", "PrediktIt")

    # Optional Mailgun support
    MAILGUN_DOMAIN: str = os.getenv("MAILGUN_DOMAIN", "")
    MAILGUN_API_KEY: str = os.getenv("MAILGUN_API_KEY", "")

    # Notification base URL reuses existing FRONTEND_URL variable
    NOTIFICATION_BASE_URL: str = os.getenv("FRONTEND_URL", "https://prdiktit.com")
    
    # Monitoring and observability
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    PROMETHEUS_ENABLED: bool = safe_bool("PROMETHEUS_ENABLED", True)
    
    # Performance settings
    WORKERS_PER_CORE: int = safe_int("WORKERS_PER_CORE", 1)
    MAX_WORKERS: int = safe_int("MAX_WORKERS", 4)
    
    # Cache settings
    CACHE_TTL: int = safe_int("CACHE_TTL", 3600)  # 1 hour default
    
    # API settings
    API_V1_STR: str = "/api/v1"
    FOOTBALL_API_BASE_URL: str = "https://v3.football.api-sports.io"
    
    # Project settings
    PROJECT_NAME: str = "Football Predictions API"
    PROJECT_DESCRIPTION: str = "API for football predictions application"
    PROJECT_VERSION: str = "1.0.0"
    
    class Config:
        case_sensitive = True
        env_file = ".env"

# Use production settings
settings = ProductionSettings()