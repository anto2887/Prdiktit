# app/main.py
import logging
import os
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.session import create_tables
from .services.init_services import init_services, shutdown_services
from .middleware.rate_limiter import RateLimitMiddleware
from .services.smart_scheduler import smart_scheduler

# Configure comprehensive logging
def setup_logging():
    """Set up comprehensive logging for the application"""
    
    # Create logs directory
    log_dir = os.path.join(os.path.dirname(__file__), '../logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure root logger
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),  # Console output
            logging.FileHandler(os.path.join(log_dir, 'app.log'))  # File output
        ]
    )
    
    # Set specific loggers to appropriate levels
    logging.getLogger('match_processing_audit').setLevel(logging.INFO)
    logging.getLogger('app.services.match_processor').setLevel(logging.INFO)
    logging.getLogger('app.services.smart_scheduler').setLevel(logging.INFO)
    
    # Suppress noisy loggers
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

# Set up logging first
setup_logging()
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
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

# Import and include routers
logger.info("Starting router registration...")

# Auth router
try:
    from .routers.auth import router as auth_router
    app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
    logger.info("✅ Auth router registered")
except Exception as e:
    logger.error(f"❌ Failed to register auth router: {e}")

# Users router
try:
    from .routers.users import router as users_router
    app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
    logger.info("✅ Users router registered")
except Exception as e:
    logger.error(f"❌ Failed to register users router: {e}")

# Matches router
try:
    from .routers.matches import router as matches_router
    app.include_router(matches_router, prefix=f"{settings.API_V1_STR}/matches", tags=["matches"])
    logger.info("✅ Matches router registered")
except Exception as e:
    logger.error(f"❌ Failed to register matches router: {e}")

# Predictions router
try:
    from .routers.predictions import router as predictions_router
    app.include_router(predictions_router, prefix=f"{settings.API_V1_STR}/predictions", tags=["predictions"])
    logger.info("✅ Predictions router registered")
except Exception as e:
    logger.error(f"❌ Failed to register predictions router: {e}")

# Groups router
try:
    from .routers.groups import router as groups_router
    app.include_router(groups_router, prefix=f"{settings.API_V1_STR}/groups", tags=["groups"])
    logger.info("✅ Groups router registered")
except Exception as e:
    logger.error(f"❌ Failed to register groups router: {e}")

# Admin router
try:
    from .routers.admin import router as admin_router
    app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
    logger.info("✅ Admin router registered")
except Exception as e:
    logger.error(f"❌ Failed to register admin router: {e}")

logger.info("✅ Router registration complete!")

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("🚀 Starting application...")
    
    try:
        # Create database tables if they don't exist
        if settings.CREATE_TABLES_ON_STARTUP:
            create_tables()
            logger.info("✅ Database tables created")

        # Initialize services
        await init_services(app)
        logger.info("✅ Services initialized")
        
        # 🧠 START SMART MATCH-DAY SCHEDULER
        logger.info("🧠 Starting intelligent match-day scheduler...")
        try:
            smart_scheduler.start_scheduler()
            
            # Log the initial schedule
            status = smart_scheduler.get_status()
            schedule = status.get('current_schedule', {})
            
            logger.info("✅ Smart scheduler started successfully!")
            logger.info(f"📊 Current mode: {schedule.get('mode', 'unknown')}")
            logger.info(f"⏰ Current frequency: every {schedule.get('frequency', 'unknown')} seconds")
            logger.info(f"📅 Reason: {schedule.get('reason', 'unknown')}")
            logger.info(f"🏈 Today's matches: {status.get('todays_matches', 0)}")
            logger.info(f"📋 Upcoming matches: {status.get('upcoming_matches', 0)}")
            
            logger.info("🤖 Smart scheduler features:")
            logger.info("   🎯 Only processes intensively on match days")
            logger.info("   ⚡ High frequency (2min) during active matches")
            logger.info("   🔄 Medium frequency (5min) around match times")
            logger.info("   💤 Low frequency (15-30min) on non-match periods")
            logger.info("   📊 Automatically adapts based on match schedule")
            
        except Exception as e:
            logger.error(f"❌ Failed to start smart scheduler: {e}")
            logger.warning("⚠️ Application will continue without automatic processing")
        
        logger.info("🎉 Application startup complete!")
        
    except Exception as e:
        logger.error(f"💥 CRITICAL: Application startup failed: {e}")
        logger.exception("Startup failure traceback:")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("🔄 Shutting down application...")
    
    try:
        # Stop smart scheduler
        logger.info("🛑 Stopping smart scheduler...")
        smart_scheduler.stop_scheduler()
        logger.info("✅ Smart scheduler stopped")
        
        # Shutdown services
        await shutdown_services(app)
        logger.info("✅ Services shutdown complete")
        
        logger.info("🛑 Application shutdown complete")
        
    except Exception as e:
        logger.error(f"💥 Error during shutdown: {e}")
        logger.exception("Shutdown error traceback:")

# Enhanced health check endpoint
@app.get("/health")
async def health_check():
    """Enhanced health check with smart scheduler status"""
    scheduler_status = smart_scheduler.get_status()
    
    return {
        "status": "healthy",
        "smart_scheduler": {
            "enabled": scheduler_status["is_running"],
            "mode": scheduler_status["current_schedule"]["mode"] if scheduler_status["current_schedule"] else None,
            "frequency": scheduler_status["current_schedule"]["frequency"] if scheduler_status["current_schedule"] else None,
            "todays_matches": scheduler_status["todays_matches"],
            "upcoming_matches": scheduler_status["upcoming_matches"]
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Smart scheduler status endpoint
@app.get("/debug/scheduler-status")
async def scheduler_status():
    """Get detailed smart scheduler status"""
    return smart_scheduler.get_status()

# Force schedule recalculation endpoint (for testing)
@app.post("/debug/recalculate-schedule")
async def recalculate_schedule():
    """Force recalculation of processing schedule"""
    try:
        old_schedule = smart_scheduler.current_schedule
        new_schedule = smart_scheduler.calculate_optimal_schedule()
        smart_scheduler.current_schedule = new_schedule
        smart_scheduler.last_schedule_check = datetime.now(timezone.utc)
        
        return {
            "status": "success",
            "old_schedule": old_schedule,
            "new_schedule": new_schedule,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Manual processing trigger endpoint
@app.post("/debug/trigger-processing")
async def trigger_processing():
    """Manually trigger a processing cycle"""
    try:
        result = smart_scheduler.run_processing_cycle()
        return {
            "status": "success",
            "processing_result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Add OPTIONS handler for preflight requests
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle preflight OPTIONS requests"""
    return {"message": "OK"}

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)