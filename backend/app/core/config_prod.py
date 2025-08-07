# backend/app/core/config_prod.py
import os
from .config import Settings

class ProductionSettings(Settings):
    # Override development defaults with production values
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "").split(",")
    
    # Rate limiting - Updated to 120 requests per minute
    API_RATE_LIMIT: int = int(os.getenv("API_RATE_LIMIT", "120"))
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
    
    # Redis with production settings
    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    
    # Production logging - No debug levels
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Security settings for production - Must be set via environment
    SECRET_KEY: str = os.getenv("SECRET_KEY")  # Must be set in production
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY")  # Must be set in production
    
    # Database settings
    DATABASE_URI: str = os.getenv("DATABASE_URI")  # Must be set in production
    CREATE_TABLES_ON_STARTUP: bool = False  # Disable auto table creation in production
    
    # AWS settings
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_SECRET_NAME: str = os.getenv("SECRET_NAME", "api-football-key")
    
    # Football API settings
    FOOTBALL_API_KEY: str = os.getenv("FOOTBALL_API_KEY")  # Must be set in production
    
    # CORS settings for production (more restrictive)
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    CORS_ALLOW_HEADERS: list = ["Authorization", "Content-Type", "X-Requested-With"]
    CORS_EXPOSE_HEADERS: list = ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
    
    # Monitoring and observability
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    PROMETHEUS_ENABLED: bool = os.getenv("PROMETHEUS_ENABLED", "True").lower() == "true"
    
    # Performance settings
    WORKERS_PER_CORE: int = int(os.getenv("WORKERS_PER_CORE", "1"))
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", "4"))
    
    # Cache settings
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", "3600"))  # 1 hour default
    
    # Environment indicator
    ENVIRONMENT: str = "production"
    
    class Config:
        case_sensitive = True
        env_file = ".env"

# Use production settings
settings = ProductionSettings()