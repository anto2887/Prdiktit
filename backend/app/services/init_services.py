import logging
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware

from ..core.config import settings
from .cache_service import setup_redis_cache
from .football_api import football_api_service
from ..middleware.rate_limiter import RateLimitMiddleware

logger = logging.getLogger(__name__)

async def init_services(app: FastAPI) -> None:
    """
    Initialize all application services
    """
    logger.info("Initializing application services...")
    
    # Setup Redis cache
    await setup_redis_cache()
    logger.info("Redis cache initialized")
    
    # Add rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_minute=settings.API_RATE_LIMIT,
        exclude_paths=["/docs", "/redoc", "/openapi.json", "/static"]
    )
    logger.info(f"Rate limiting middleware added with {settings.API_RATE_LIMIT} requests per minute")
    
    # Initialize football API service
    if not settings.FOOTBALL_API_KEY:
        logger.warning("FOOTBALL_API_KEY not set. Football API service will not work properly.")
    else:
        logger.info("Football API service initialized")
    
    # Add any other service initializations here
    
    logger.info("All services initialized successfully")

async def shutdown_services() -> None:
    """
    Shutdown all application services
    """
    logger.info("Shutting down application services...")
    
    # Add cleanup code for services here
    
    logger.info("All services shut down successfully") 