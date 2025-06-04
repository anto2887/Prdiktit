# app/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.session import create_tables
from .services.init_services import init_services, shutdown_services
from .routers import auth_router, users_router, matches_router, predictions_router
from .routers.groups import router as groups_router
from .middleware.rate_limiter import RateLimitMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS with settings from environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
    expose_headers=settings.CORS_EXPOSE_HEADERS
)

# Add rate limiting middleware
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.API_RATE_LIMIT,
    exclude_paths=[
        "/docs", 
        "/redoc", 
        "/openapi.json", 
        "/static",
        "/api/health",
        "/api/auth",
        "/favicon.ico"
    ]
)

# Include routers with proper API version prefix
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(matches_router, prefix=f"{settings.API_V1_STR}/matches", tags=["matches"])
app.include_router(predictions_router, prefix=f"{settings.API_V1_STR}/predictions", tags=["predictions"])
app.include_router(groups_router, prefix=f"{settings.API_V1_STR}/groups", tags=["groups"])

@app.on_event("startup")
async def startup_event():
    """
    Initialize application on startup
    """
    logger.info("Starting application...")
    
    # Create database tables if they don't exist
    if settings.CREATE_TABLES_ON_STARTUP:
        create_tables()
        logger.info("Database tables created")
    
    # Initialize services
    await init_services(app)
    logger.info("Application startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """
    Clean up resources on shutdown
    """
    logger.info("Shutting down application...")
    await shutdown_services(app)
    logger.info("Application shutdown complete")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Add OPTIONS handler for preflight requests
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle preflight OPTIONS requests"""
    return {"message": "OK"}

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)