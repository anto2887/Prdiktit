# app/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.session import create_tables
from .services.init_services import init_services, shutdown_services
from .routers import auth_router, users_router, matches_router, predictions_router
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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware here, before the app starts
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.API_RATE_LIMIT,
    exclude_paths=["/docs", "/redoc", "/openapi.json", "/static"]
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(matches_router, prefix="/api/matches", tags=["Matches"])
app.include_router(predictions_router, prefix="/api/predictions", tags=["Predictions"])

@app.on_event("startup")
async def startup_event():
    """
    Initialize application on startup
    """
    logger.info("Starting application...")
    
    # Create database tables
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
    
    # Shutdown services
    await shutdown_services()
    
    logger.info("Application shutdown complete")

@app.get("/api/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy"}

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)