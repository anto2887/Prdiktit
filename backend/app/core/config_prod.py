# backend/app/core/config_prod.py
import os
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

def validate_required_env(name: str, value: str) -> str:
    """Validate that required environment variables are set"""
    if not value or value.strip() == "":
        raise ValueError(f"Required environment variable {name} is not set or is empty")
    return value

class ProductionSettings(Settings):
    # Environment validation
    ENVIRONMENT: str = "production"
    
    # Required secrets - using exact Railway variable names
    SECRET_KEY: str = validate_required_env("SECRET_KEY", os.getenv("SECRET_KEY", ""))
    JWT_SECRET_KEY: str = validate_required_env("JWT_SECRET_KEY", os.getenv("JWT_SECRET_KEY", ""))
    DATABASE_URI: str = validate_required_env("DATABASE_URI", os.getenv("DATABASE_URI", ""))
    FOOTBALL_API_KEY: str = validate_required_env("FOOTBALL_API_KEY", os.getenv("FOOTBALL_API_KEY", ""))
    
    # API and rate limiting - matching your Railway variables
    API_RATE_LIMIT: int = safe_int("API_RATE_LIMIT", 300)
    
    # CORS - matching your Railway variable
    CORS_ORIGINS: list = [
        x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") 
        if x.strip()
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    CORS_ALLOW_HEADERS: list = ["Authorization", "Content-Type", "X-Requested-With"]
    CORS_EXPOSE_HEADERS: list = ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
    
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
    
    # Rate limiting for production
    RATE_LIMIT_PER_MINUTE: int = safe_int("RATE_LIMIT_PER_MINUTE", 300)
    
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