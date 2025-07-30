# backend/app/main.py
import logging
import os
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.session import create_tables
from .services.init_services import init_services, shutdown_services
from .middleware.rate_limiter import RateLimitMiddleware

# Import enhanced scheduler and startup sync service
from .services.enhanced_smart_scheduler import enhanced_smart_scheduler
from .services.startup_sync_service import startup_sync_service

# Configure comprehensive logging
def setup_logging():
    """Set up comprehensive logging for the application"""
    
    # Create logs directory - now persistent with volumes
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
    
    # Set specific loggers for enhanced scheduler components
    logging.getLogger('match_processing_audit').setLevel(logging.INFO)
    logging.getLogger('fixture_monitoring').setLevel(logging.INFO)
    logging.getLogger('startup_sync').setLevel(logging.INFO)
    logging.getLogger('app.services.match_processor').setLevel(logging.INFO)
    logging.getLogger('app.services.enhanced_smart_scheduler').setLevel(logging.INFO)
    logging.getLogger('app.services.football_api').setLevel(logging.INFO)
    logging.getLogger('app.services.startup_sync_service').setLevel(logging.INFO)
    
    # Suppress noisy loggers
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('aiohttp').setLevel(logging.WARNING)

# Initialize logging
setup_logging()

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Football Predictions API",
    description="Enhanced API for football match predictions with intelligent scheduling and startup data sync",
    version="2.1.0"
)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("🚀 Football Predictions API initializing...")
logger.info("🧠 Enhanced Smart Scheduler with Fixture Monitoring enabled")
logger.info("🔄 Startup Data Synchronization enabled")

# Register routers
logger.info("📋 Registering API routers...")

# Auth router
try:
    from .routers.auth import router as auth_router
    app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["authentication"])
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

# Admin router (if exists)
try:
    from .routers.admin import router as admin_router
    app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
    logger.info("✅ Admin router registered")
except Exception as e:
    logger.warning(f"⚠️ Admin router not available: {e}")

logger.info("✅ Router registration complete!")

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup with enhanced data synchronization"""
    logger.info("🚀 Starting enhanced application startup sequence...")
    startup_start_time = datetime.now(timezone.utc)
    
    try:
        # Step 1: Create database tables if they don't exist
        if settings.CREATE_TABLES_ON_STARTUP:
            logger.info("🗄️ Creating database tables...")
            create_tables()
            logger.info("✅ Database tables created")

        # Step 2: Initialize core services
        logger.info("🔧 Initializing core services...")
        await init_services(app)
        logger.info("✅ Core services initialized")
        
        # Step 3: Run startup data synchronization
        logger.info("🔄 Running startup data synchronization...")
        try:
            sync_results = await startup_sync_service.run_startup_sync()
            
            if sync_results["status"] == "success":
                logger.info("✅ Startup data synchronization completed successfully")
                logger.info(f"   📊 Fixtures: {sync_results['fixtures_added']} added, {sync_results['fixtures_updated']} updated")
                logger.info(f"   ⚽ Processing: {sync_results['matches_processed']} matches, {sync_results['predictions_processed']} predictions")
                logger.info(f"   ⏱️ Duration: {sync_results['duration_seconds']:.2f}s")
            else:
                logger.error(f"❌ Startup data synchronization failed: {sync_results.get('error', 'Unknown error')}")
                
        except Exception as e:
            logger.error(f"❌ Error during startup data synchronization: {e}")
            # Continue startup even if sync fails
        
        # Step 4: Start Enhanced Smart Scheduler
        logger.info("🧠 Starting Enhanced Smart Scheduler with Fixture Monitoring...")
        try:
            enhanced_smart_scheduler.start_scheduler()
            
            # Log the initial schedule and status
            status = enhanced_smart_scheduler.get_status()
            schedule = status.get('current_schedule', {})
            
            logger.info("✅ Enhanced Smart Scheduler started successfully!")
            logger.info(f"   📅 Mode: {schedule.get('mode', 'adaptive')}")
            logger.info(f"   ⏰ Frequency: {schedule.get('frequency', 'dynamic')} minutes")
            logger.info(f"   🔍 Fixture monitoring: {'enabled' if status.get('fixture_monitoring_enabled') else 'disabled'}")
            logger.info(f"   ⚽ Today's matches: {status.get('todays_matches', 0)}")
            
        except Exception as e:
            logger.error(f"❌ Failed to start Enhanced Smart Scheduler: {e}")
            # Continue startup even if scheduler fails
        
        # Step 5: Final startup completion
        startup_duration = (datetime.now(timezone.utc) - startup_start_time).total_seconds()
        logger.info(f"🎉 Enhanced application startup complete in {startup_duration:.2f}s")
        logger.info("🔥 System is ready for predictions with intelligent scheduling and real-time monitoring!")
        
    except Exception as e:
        logger.error(f"💥 CRITICAL: Enhanced application startup failed: {e}")
        logger.exception("Startup failure traceback:")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("🔄 Shutting down enhanced application...")
    
    try:
        # Stop enhanced scheduler
        logger.info("🛑 Stopping Enhanced Smart Scheduler...")
        enhanced_smart_scheduler.stop_scheduler()
        logger.info("✅ Enhanced Smart Scheduler stopped")
        
        # Close football API service
        try:
            from .services.football_api import football_api_service
            await football_api_service.close()
            logger.info("✅ Football API service closed")
        except Exception as e:
            logger.warning(f"⚠️ Error closing football API service: {e}")
        
        # Shutdown services
        await shutdown_services(app)
        logger.info("✅ Services shutdown complete")
        
        logger.info("🛑 Enhanced application shutdown complete")
        
    except Exception as e:
        logger.error(f"💥 Error during shutdown: {e}")
        logger.exception("Shutdown error traceback:")

# Enhanced health check endpoint
@app.get("/health")
async def health_check():
    """Enhanced health check with scheduler, fixture monitoring, and sync status"""
    scheduler_status = enhanced_smart_scheduler.get_status()
    
    return {
        "status": "healthy",
        "version": "2.1.0",
        "features": {
            "enhanced_scheduler": True,
            "fixture_monitoring": True,
            "startup_data_sync": True,
            "intelligent_processing": True
        },
        "enhanced_scheduler": {
            "enabled": scheduler_status["is_running"],
            "mode": scheduler_status["current_schedule"]["mode"] if scheduler_status["current_schedule"] else None,
            "frequency": scheduler_status["current_schedule"]["frequency"] if scheduler_status["current_schedule"] else None,
            "fixture_monitoring": scheduler_status["fixture_monitoring_enabled"],
            "todays_matches": scheduler_status["todays_matches"],
            "upcoming_matches": scheduler_status["upcoming_matches"]
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Debug endpoints for monitoring and troubleshooting
@app.get("/debug/startup-sync-status")
async def get_startup_sync_status():
    """Get the last startup sync results"""
    return {
        "message": "Startup sync service is available",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": "Sync runs automatically on startup"
    }

@app.post("/debug/trigger-manual-sync")
async def trigger_manual_sync():
    """Manually trigger data synchronization (for debugging)"""
    try:
        logger.info("🔧 Manual sync triggered via debug endpoint")
        results = await startup_sync_service.run_startup_sync()
        return {
            "status": "success",
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Manual sync failed: {e}")
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