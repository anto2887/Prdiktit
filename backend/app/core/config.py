# app/core/config.py
import os
import secrets
import logging
from typing import Any, Dict, List, Optional, Union
from pydantic import AnyHttpUrl, PostgresDsn, validator
from pydantic_settings import BaseSettings

# Configure logger
logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
    JWT_ALGORITHM: str = "HS256"
    # 60 minutes * 24 hours * 7 days = 7 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    @validator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # Database
    DATABASE_URI: Optional[PostgresDsn] = os.getenv("DATABASE_URI")
    
    # AWS settings
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_SECRET_NAME: str = os.getenv("SECRET_NAME", "api-football-key")
    
    # Redis settings
    REDIS_HOST: str = "redis"  # Default to service name in docker-compose
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""  # Empty string for no password
    
    # Database init options
    CREATE_TABLES_ON_STARTUP: bool = os.getenv("CREATE_TABLES_ON_STARTUP", "False") == "True"
    
    # Project settings
    PROJECT_NAME: str = "Football Predictions API"
    PROJECT_DESCRIPTION: str = "API for football predictions application"
    PROJECT_VERSION: str = "1.0.0"
    
    # Football API settings
    FOOTBALL_API_BASE_URL: str = "https://v3.football.api-sports.io"
    FOOTBALL_API_KEY: str

    @validator("FOOTBALL_API_KEY")
    def validate_football_api_key(cls, v):
        if not v:
            logger.warning("FOOTBALL_API_KEY is not set! API requests will fail.")
        return v
    
    # Add this line:
    API_RATE_LIMIT: int = 600  # Default to 60 requests per minute
    
    # CORS settings
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]  # Permissive for development
    CORS_EXPOSE_HEADERS: List[str] = ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 600  # Requests per minute
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()