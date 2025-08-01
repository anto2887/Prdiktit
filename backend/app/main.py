# backend/app/main.py
"""
Updated main application with enhanced logging and unified transaction management
"""
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
from .services.unified_transaction_manager import unified_transaction_manager

# Configure comprehensive logging with transaction support
def setup_logging():
    """Set up comprehensive logging for the application with transaction logging"""
    
    # Create logs directory - now persistent with volumes
    log_dir = os.path.join(os.path.dirname(__file__), '../logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Clear any existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    simple_formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(message)s"
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(simple_formatter)
    console_handler.setLevel(logging.INFO)
    root_logger.addHandler(console_handler)
    
    # Main application log file
    app_handler = logging.FileHandler(os.path.join(log_dir, 'app.log'))
    app_handler.setFormatter(detailed_formatter)
    app_handler.setLevel(logging.INFO)
    root_logger.addHandler(app_handler)
    
    # Set up specialized loggers with dedicated files
    
    # Transaction audit logger
    transaction_logger = logging.getLogger('transaction_audit')
    transaction_logger.setLevel(logging.INFO)
    transaction_logger.propagate = False  # Don't propagate to root logger
    
    transaction_handler = logging.FileHandler(os.path.join(log_dir, 'transaction_audit.log'))
    transaction_handler.setFormatter(logging.Formatter(
        "%(asctime)s - TRANSACTION - %(levelname)s - %(message)s"
    ))
    transaction_logger.addHandler(transaction_handler)
    
    # Database verification logger
    verification_logger = logging.getLogger('database_verification')
    verification_logger.setLevel(logging.INFO)
    verification_logger.propagate = False
    
    verification_handler = logging.FileHandler(os.path.join(log_dir, 'database_verification.log'))
    verification_handler.setFormatter(logging.Formatter(
        "%(asctime)s - VERIFICATION - %(levelname)s - %(message)s"
    ))
    verification_logger.addHandler(verification_handler)
    
    # Match processing audit logger
    audit_logger = logging.getLogger('match_processing_audit')
    audit_logger.setLevel(logging.INFO)
    audit_logger.propagate = False
    
    audit_handler = logging.FileHandler(os.path.join(log_dir, 'match_processing_audit.log'))
    audit_handler.setFormatter(logging.Formatter(
        "%(asctime)s - AUDIT - %(levelname)s - %(message)s"
    ))
    audit_logger.addHandler(audit_handler)
    
    # Fixture monitoring logger
    fixture_logger = logging.getLogger('fixture_monitoring')
    fixture_logger.setLevel(logging.INFO)
    fixture_logger.propagate = False
    
    fixture_handler = logging.FileHandler(os.path.join(log_dir, 'fixture_monitoring.log'))
    fixture_handler.setFormatter(logging.Formatter(
        "%(asctime)s - FIXTURE - %(levelname)s - %(message)s"
    ))
    fixture_logger.addHandler(fixture_handler)
    
    # Startup sync logger
    startup_logger = logging.getLogger('startup_sync')
    startup_logger.setLevel(logging.INFO)
    startup_logger.propagate = False
    
    startup_handler = logging.FileHandler(os.path.join(log_dir, 'startup_sync.log'))
    startup_handler.setFormatter(logging.Formatter(
        "%(asctime)s - STARTUP - %(levelname)s - %(message)s"
    ))
    startup_logger.addHandler(startup_handler)
    
    # Log the logging setup completion
    logging.info("🚀 Enhanced logging system initialized")
    logging.info(f"📁 Log directory: {log_dir}")
    logging.info("📝 Specialized loggers configured:")
    logging.info("   - transaction_audit.log: Database transaction details")
    logging.info("   - database_verification.log: Post-commit verification results")
    logging.info("   - match_processing_audit.log: Match processing audit trail")
    logging.info("   - fixture_monitoring.log: Fixture monitoring activities")
    logging.info("   - startup_sync.log: Application startup synchronization")

# Set up logging first
setup_logging()

# Configure specific service loggers
logging.getLogger('app.services.match_processor').setLevel(logging.INFO)
logging.getLogger('app.services.enhanced_smart_scheduler').setLevel(logging.INFO)
logging.getLogger('app.services.unified_transaction_manager').setLevel(logging.INFO)

# Create FastAPI app
app = FastAPI(
    title="Football Predictions API",
    description="Enhanced Football Predictions API with Unified Transaction Management",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Application startup
@app.on_event("startup")
async def startup_event():
    """Enhanced startup with unified transaction management and comprehensive sync"""
    startup_logger = logging.getLogger('startup_sync')
    transaction_logger = logging.getLogger('transaction_audit')
    
    try:
        startup_logger.info("🚀 APPLICATION_STARTUP_BEGIN")
        startup_logger.info("📊 Using Unified Transaction Management System")
        
        # Step 1: Create database tables
        startup_logger.info("📋 Step 1: Creating database tables...")
        if settings.CREATE_TABLES_ON_STARTUP:
            create_tables()
            startup_logger.info("✅ Database tables created/verified")
        else:
            startup_logger.info("⏭️ Table creation skipped (CREATE_TABLES_ON_STARTUP=False)")
        
        # Step 2: Initialize services
        startup_logger.info("🔧 Step 2: Initializing services...")
        await init_services(app)  # ✅ Add app argument
        startup_logger.info("✅ Services initialized")
        
        # Step 3: Run comprehensive startup sync with unified transactions
        startup_logger.info("🔄 Step 3: Running comprehensive startup synchronization...")
        try:
            sync_result = await startup_sync_service.run_comprehensive_startup_sync()
            
            if sync_result.get('success', False):
                startup_logger.info(f"✅ Startup sync completed successfully:")
                startup_logger.info(f"   - Matches processed: {sync_result.get('matches_processed', 0)}")
                startup_logger.info(f"   - Predictions processed: {sync_result.get('predictions_processed', 0)}")
                startup_logger.info(f"   - Verification passed: {sync_result.get('verification_passed', False)}")
                transaction_logger.info(f"STARTUP_SYNC_SUCCESS: {sync_result}")
            else:
                startup_logger.error(f"❌ Startup sync failed: {sync_result.get('error_message', 'Unknown error')}")
                transaction_logger.error(f"STARTUP_SYNC_FAILED: {sync_result}")
                
        except Exception as sync_error:
            startup_logger.error(f"❌ Critical error in startup sync: {sync_error}")
            transaction_logger.error(f"STARTUP_SYNC_CRITICAL_ERROR: {str(sync_error)}")
        
        # Step 4: Start enhanced scheduler
        startup_logger.info("⏰ Step 4: Starting Enhanced Smart Scheduler...")
        try:
            enhanced_smart_scheduler.start()
            startup_logger.info("✅ Enhanced Smart Scheduler started successfully")
        except Exception as scheduler_error:
            startup_logger.error(f"❌ Error starting scheduler: {scheduler_error}")
        
        # Step 5: Final startup verification
        startup_logger.info("🔍 Step 5: Running startup verification...")
        try:
            # Test the unified transaction manager
            test_result = unified_transaction_manager.update_match_statuses_and_process_predictions([])
            if test_result.success:
                startup_logger.info("✅ Unified Transaction Manager operational")
                transaction_logger.info("STARTUP_VERIFICATION_SUCCESS: UnifiedTransactionManager operational")
            else:
                startup_logger.warning("⚠️ Unified Transaction Manager test returned failure (may be expected with empty data)")
        except Exception as test_error:
            startup_logger.error(f"❌ Error testing Unified Transaction Manager: {test_error}")
            transaction_logger.error(f"STARTUP_VERIFICATION_ERROR: {str(test_error)}")
        
        startup_logger.info("🎉 APPLICATION_STARTUP_COMPLETE")
        startup_logger.info("🔧 Enhanced Features Active:")
        startup_logger.info("   ✅ Unified Transaction Management")
        startup_logger.info("   ✅ Comprehensive Transaction Logging")
        startup_logger.info("   ✅ Database Write Verification")
        startup_logger.info("   ✅ Single Session Per Processing Cycle")
        startup_logger.info("   ✅ Enhanced Smart Scheduler")
        startup_logger.info("   ✅ Startup Synchronization")
        
        # Log current time for reference
        current_time = datetime.now(timezone.utc)
        startup_logger.info(f"🕐 Application started at: {current_time.isoformat()}")
        
    except Exception as e:
        startup_logger.error(f"❌ CRITICAL_STARTUP_ERROR: {str(e)}")
        transaction_logger.error(f"STARTUP_CRITICAL_ERROR: {str(e)}")
        # Don't raise - let the application start even if there are issues

@app.on_event("shutdown")
async def shutdown_event():
    """Enhanced shutdown with proper cleanup"""
    startup_logger = logging.getLogger('startup_sync')
    transaction_logger = logging.getLogger('transaction_audit')
    
    try:
        startup_logger.info("🛑 APPLICATION_SHUTDOWN_BEGIN")
        
        # Stop the enhanced scheduler
        startup_logger.info("⏰ Stopping Enhanced Smart Scheduler...")
        try:
            enhanced_smart_scheduler.stop()
            startup_logger.info("✅ Enhanced Smart Scheduler stopped")
        except Exception as scheduler_error:
            startup_logger.error(f"❌ Error stopping scheduler: {scheduler_error}")
        
        # Shutdown services
        startup_logger.info("🔧 Shutting down services...")
        await shutdown_services(app)  # ✅ Add app argument
        startup_logger.info("✅ Services shutdown complete")
        
        startup_logger.info("🛑 APPLICATION_SHUTDOWN_COMPLETE")
        transaction_logger.info("APPLICATION_SHUTDOWN: Clean shutdown completed")
        
    except Exception as e:
        startup_logger.error(f"❌ Error during shutdown: {str(e)}")
        transaction_logger.error(f"SHUTDOWN_ERROR: {str(e)}")

# Include routers
from .routers import auth, predictions, matches, groups, users

app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"])
app.include_router(matches.router, prefix="/api/v1/matches", tags=["matches"])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])

# Health check endpoint with enhanced information
@app.get("/health")
async def health_check():
    """Enhanced health check with transaction manager status"""
    current_time = datetime.now(timezone.utc)
    
    # Get scheduler status
    scheduler_status = enhanced_smart_scheduler.get_status()
    
    return {
        "status": "healthy",
        "timestamp": current_time.isoformat(),
        "version": "2.0.0",
        "features": {
            "unified_transaction_management": True,
            "comprehensive_logging": True,
            "database_verification": True,
            "single_session_processing": True,
            "enhanced_scheduler": scheduler_status["is_running"]
        },
        "scheduler": scheduler_status,
        "database": "postgresql",
        "timezone": "UTC"
    }

# Enhanced processing endpoint for manual testing
@app.post("/api/v1/admin/process-matches")
async def manual_process_matches():
    """Manual endpoint to trigger match processing for testing"""
    try:
        # Use the enhanced scheduler's processing method
        result = await enhanced_smart_scheduler.run_enhanced_processing_with_status_updates()
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Emergency sync endpoint for specific matches
@app.post("/api/v1/admin/emergency-sync/{fixture_id}")
async def emergency_sync_match(fixture_id: int):
    """Emergency endpoint to sync a specific match"""
    try:
        result = unified_transaction_manager.emergency_status_sync(fixture_id)
        return {
            "success": result.success,
            "fixture_id": fixture_id,
            "predictions_processed": result.predictions_processed,
            "verification_passed": result.verification_passed,
            "error_message": result.error_message
        }
    except Exception as e:
        return {"success": False, "fixture_id": fixture_id, "error": str(e)}

# Transaction log viewer endpoint
@app.get("/api/v1/admin/transaction-logs")
async def get_transaction_logs(lines: int = 100):
    """Get recent transaction logs for debugging"""
    try:
        log_file = os.path.join(os.path.dirname(__file__), '../logs/transaction_audit.log')
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                all_lines = f.readlines()
                recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
                return {"success": True, "logs": recent_lines}
        else:
            return {"success": False, "error": "Transaction log file not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)