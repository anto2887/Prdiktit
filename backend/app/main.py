# app/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.session import create_tables
from .services.init_services import init_services, shutdown_services
from .middleware.rate_limiter import RateLimitMiddleware
from .services.background_tasks import background_runner

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

# Log CORS configuration for debugging
logger.info(f"CORS Origins: {settings.CORS_ORIGINS}")

# Configure CORS - UPDATED VERSION
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
        "http://frontend:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language", 
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRFToken",
        "Cache-Control"
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining", 
        "X-RateLimit-Reset",
        "Content-Type"
    ]
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

# Import and include routers with detailed error logging
logger.info("Starting router registration...")

# Import all routers at once
from .routers import auth, matches, predictions, groups, admin

# Auth router - REGISTER ONLY ONCE
try:
    logger.info("Importing auth router...")
    from .routers.auth import router as auth_router
    logger.info("Auth router imported successfully")
    
    app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
    logger.info("Auth router registered successfully at /api/v1/auth")
except Exception as e:
    logger.error(f"FAILED to import/register auth router: {str(e)}")
    logger.exception("Full traceback:")

# Users router
try:
    logger.info("Importing users router...")
    from .routers.users import router as users_router
    logger.info("Users router imported successfully")
    
    app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
    logger.info("Users router registered successfully at /api/v1/users")
except Exception as e:
    logger.error(f"FAILED to import/register users router: {str(e)}")
    logger.exception("Full traceback:")

# Matches router
try:
    logger.info("Importing matches router...")
    from .routers.matches import router as matches_router
    logger.info("Matches router imported successfully")
    
    app.include_router(matches_router, prefix=f"{settings.API_V1_STR}/matches", tags=["matches"])
    logger.info("Matches router registered successfully at /api/v1/matches")
except Exception as e:
    logger.error(f"FAILED to import/register matches router: {str(e)}")
    logger.exception("Full traceback:")

# Predictions router
try:
    logger.info("Importing predictions router...")
    from .routers.predictions import router as predictions_router
    logger.info("Predictions router imported successfully")
    
    app.include_router(predictions_router, prefix=f"{settings.API_V1_STR}/predictions", tags=["predictions"])
    logger.info("Predictions router registered successfully at /api/v1/predictions")
except Exception as e:
    logger.error(f"FAILED to import/register predictions router: {str(e)}")
    logger.exception("Full traceback:")

# Groups router
try:
    logger.info("Importing groups router...")
    from .routers.groups import router as groups_router
    logger.info("Groups router imported successfully")
    
    app.include_router(groups_router, prefix=f"{settings.API_V1_STR}/groups", tags=["groups"])
    logger.info("Groups router registered successfully at /api/v1/groups")
except Exception as e:
    logger.error(f"FAILED to import/register groups router: {str(e)}")
    logger.exception("Full traceback:")

# Admin router
try:
    logger.info("Importing admin router...")
    from .routers.admin import router as admin_router
    logger.info("Admin router imported successfully")
    
    app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
    logger.info("Admin router registered successfully at /api/v1/admin")
except Exception as e:
    logger.error(f"FAILED to import/register admin router: {str(e)}")
    logger.exception("Full traceback:")

logger.info("Router registration complete!")

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
    
    # Start background processing (comment out if you don't want auto-processing)
    # background_runner.start_scheduler()
    
    logger.info("Application startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """
    Clean up resources on shutdown
    """
    logger.info("Shutting down application...")
    
    # Stop background processing
    background_runner.stop_scheduler()
    
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

# Debug endpoint to check registered routes
@app.get("/debug/routes")
async def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": getattr(route, 'name', 'unnamed')
            })
    return {"routes": routes, "total_routes": len(routes)}

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)