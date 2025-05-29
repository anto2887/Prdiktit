# app/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.session import create_tables
from .services.init_services import init_services, shutdown_services
from .routers import auth_router, users_router, matches_router, predictions_router, groups
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

# CRITICAL FIX: Enhanced CORS middleware with comprehensive configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
        "http://0.0.0.0:3000",
        "http://frontend:3000",
        "https://localhost:3000",  # HTTPS variants
        "https://127.0.0.1:3000",
        # Docker network variations
        "http://172.18.0.5:3000",
        "http://172.17.0.1:3000",
        "http://172.16.0.1:3000",
        # Removed wildcard "*" - cannot use with credentials
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRFToken",
        "Origin",
        "Referer",
        "User-Agent",
        "Cache-Control",
        "Pragma",
        "Expires",
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Methods",
        "*"  # Allow all headers for development
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining", 
        "X-RateLimit-Reset",
        "Content-Type",
        "Authorization",
        "*"  # Expose all headers for development
    ]
)

# Add rate limiting middleware AFTER CORS
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=600,  # Increased from 300
    exclude_paths=[
        "/docs", 
        "/redoc", 
        "/openapi.json", 
        "/static",
        "/api/health",
        "/api/auth",  # Exclude auth endpoints
        "/favicon.ico"
    ]
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(matches_router, prefix="/api/matches", tags=["Matches"])
app.include_router(predictions_router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])

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

# Add OPTIONS handler for preflight requests
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle preflight OPTIONS requests"""
    return {"message": "OK"}

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)