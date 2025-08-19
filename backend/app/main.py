# backend/app/main.py
"""
Updated main application with enhanced logging and unified transaction management
"""
import logging
import os
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .core.config import settings
from .db.session import create_tables_with_verification
from .services.init_services import init_services, shutdown_services
from .middleware.rate_limiter import RateLimitMiddleware

# Import startup sync service and unified transaction manager
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
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    
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
    console_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    root_logger.addHandler(console_handler)
    
    # Main application log file
    app_handler = logging.FileHandler(os.path.join(log_dir, 'app.log'))
    app_handler.setFormatter(detailed_formatter)
    app_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
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

async def ensure_database_ready(max_retries=3, retry_delay=2):
    """
    Ensure database tables are created and ready with retry mechanism
    """
    startup_logger = logging.getLogger('startup_sync')
    
    for attempt in range(max_retries):
        try:
            startup_logger.info(f"🔄 Database setup attempt {attempt + 1}/{max_retries}")
            
            # Create and verify tables
            success = create_tables_with_verification()
            
            if success:
                startup_logger.info("✅ Database tables created and verified successfully")
                return True
            else:
                startup_logger.warning(f"⚠️ Table creation/verification failed on attempt {attempt + 1}")
                if attempt < max_retries - 1:
                    startup_logger.info(f"⏳ Waiting {retry_delay} seconds before retry...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    startup_logger.error("❌ All database setup attempts failed")
                    return False
                    
        except Exception as e:
            startup_logger.error(f"❌ Database setup error on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                startup_logger.info(f"⏳ Waiting {retry_delay} seconds before retry...")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                startup_logger.error("❌ All database setup attempts failed")
                return False
    
    return False

# Application startup
@app.on_event("startup")
async def startup_event():
    """Enhanced startup with unified transaction management and comprehensive sync"""
    startup_logger = logging.getLogger('startup_sync')
    transaction_logger = logging.getLogger('transaction_audit')
    
    try:
        startup_logger.info("🚀 APPLICATION_STARTUP_BEGIN")
        startup_logger.info("📊 Using Unified Transaction Management System")
        
        # Step 1: Ensure database is ready with retry mechanism
        startup_logger.info("📋 Step 1: Ensuring database tables are ready...")
        if settings.CREATE_TABLES_ON_STARTUP:
            database_ready = await ensure_database_ready()
            if not database_ready:
                startup_logger.error("❌ CRITICAL: Database setup failed - application cannot start")
                raise Exception("Database setup failed after all retry attempts")
            startup_logger.info("✅ Database tables created/verified with retry mechanism")
        else:
            startup_logger.info("⏭️ Table creation skipped (CREATE_TABLES_ON_STARTUP=False)")
        
        # Step 2: Add delay to ensure PostgreSQL has fully committed changes
        startup_logger.info("⏳ Step 2: Waiting for database changes to fully commit...")
        await asyncio.sleep(3)  # 3-second delay to ensure PostgreSQL commits
        startup_logger.info("✅ Database commit delay completed")
        
        # Step 3: Initialize services (only after database is confirmed ready)
        startup_logger.info("🔧 Step 3: Initializing services...")
        await init_services(app)
        startup_logger.info("✅ Services initialized")
        
        # Step 4: Run comprehensive startup sync with unified transactions
        startup_logger.info("🔄 Step 4: Running comprehensive startup synchronization...")
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
        
        # Step 5: Scheduler moved to separate service
        startup_logger.info("⏰ Step 5: Scheduler runs in separate service (backend-scheduler)")
        startup_logger.info("📊 This service handles HTTP requests only")
        
        # Step 6: Final startup verification
        startup_logger.info("🔍 Step 6: Running startup verification...")
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
        startup_logger.info("   ✅ Database Retry Mechanism")
        startup_logger.info("   ✅ PostgreSQL Commit Delay")
        
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
        
        # Scheduler runs in separate service
        startup_logger.info("⏰ Scheduler runs in separate service (backend-scheduler)")
        startup_logger.info("📊 No scheduler to stop in this service")
        
        # Shutdown services
        startup_logger.info("🔧 Shutting down services...")
        await shutdown_services(app)
        startup_logger.info("✅ Services shutdown complete")
        
        startup_logger.info("🛑 APPLICATION_SHUTDOWN_COMPLETE")
        transaction_logger.info("APPLICATION_SHUTDOWN: Clean shutdown completed")
        
    except Exception as e:
        startup_logger.error(f"❌ Error during shutdown: {str(e)}")
        transaction_logger.error(f"SHUTDOWN_ERROR: {str(e)}")

# Include routers with dependency injection
from .routers import auth, predictions, matches, groups, users
from .routers.analytics import router as analytics_router

# Override dependencies to use our dependency injection container
from .core.dependencies import get_database_session

app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"], dependencies=[Depends(get_database_session)])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"], dependencies=[Depends(get_database_session)])
app.include_router(matches.router, prefix="/api/v1/matches", tags=["matches"], dependencies=[Depends(get_database_session)])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"], dependencies=[Depends(get_database_session)])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"], dependencies=[Depends(get_database_session)])
app.include_router(analytics_router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"], dependencies=[Depends(get_database_session)])

# Health check endpoint with enhanced information
@app.get("/health")
async def health_check():
    """Enhanced health check with transaction manager status"""
    current_time = datetime.now(timezone.utc)
    
    # Scheduler runs in separate service
    scheduler_status = "runs_in_separate_service"
    
    return {
        "status": "healthy",
        "timestamp": current_time.isoformat(),
        "version": "2.0.0",
        "features": {
            "unified_transaction_management": True,
            "comprehensive_logging": True,
            "database_verification": True,
            "single_session_processing": True,
            "enhanced_scheduler": "runs_in_separate_service"
        },
        "scheduler": "runs_in_separate_service",
        "database": "postgresql",
        "timezone": "UTC"
    }

# Enhanced processing endpoint for manual testing
@app.post("/api/v1/admin/process-matches")
async def manual_process_matches():
    """Manual endpoint to trigger match processing for testing"""
    try:
        from .services.enhanced_smart_scheduler import EnhancedSmartScheduler
        
        # Use the enhanced scheduler's processing method
        scheduler = EnhancedSmartScheduler()
        result = await scheduler.run_enhanced_processing_with_status_updates()
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

# Temporary migration endpoint for points field
@app.post("/api/v1/admin/migrate-points-field")
async def migrate_points_field():
    """Temporary endpoint to run the points field migration"""
    try:
        from .db.database import SessionLocal
        db = SessionLocal()
        
        # Check current table structure first
        result = db.execute(text("""
            SELECT column_name, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'user_predictions' AND column_name = 'points'
        """))
        column_info = result.fetchone()
        
        if not column_info:
            return {"success": False, "error": "Points column not found in user_predictions table"}
        
        current_nullable = column_info[1]
        current_default = column_info[2]
        
        # Step 1: Drop NOT NULL constraint if it exists
        if current_nullable == 'NO':
            try:
                db.execute(text("""
                    ALTER TABLE user_predictions 
                    ALTER COLUMN points DROP NOT NULL
                """))
                db.commit()  # Commit the constraint change immediately
            except Exception as constraint_error:
                db.rollback()
                return {"success": False, "error": f"Failed to drop NOT NULL constraint: {str(constraint_error)}"}
        
        # Step 2: Drop default value if it exists
        if current_default:
            try:
                db.execute(text("""
                    ALTER TABLE user_predictions 
                    ALTER COLUMN points DROP DEFAULT
                """))
                db.commit()  # Commit the default change immediately
            except Exception as default_error:
                db.rollback()
                return {"success": False, "error": f"Failed to drop default value: {str(default_error)}"}
        
        # Step 3: Now update existing data - set points to NULL for unprocessed predictions
        try:
            result1 = db.execute(text("""
                UPDATE user_predictions 
                SET points = NULL 
                WHERE prediction_status != 'PROCESSED'
            """))
            db.commit()
        except Exception as update_error:
            db.rollback()
            return {"success": False, "error": f"Failed to update data: {str(update_error)}"}
        
        db.close()
        
        return {
            "success": True,
            "message": "Points field migration completed successfully",
            "rows_updated": result1.rowcount,
            "column_info": {
                "was_nullable": current_nullable,
                "was_default": current_default,
                "now_nullable": "YES",
                "now_default": None
            }
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

# Helper functions for season handling
def get_season_info_for_league(league):
    """Get season information for a specific league"""
    if league in ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']:
        return {
            'total_weeks': 38,
            'season_start_month': 8,  # August
            'rivalry_frequency': 4,
            'activation_delay': 5
        }
    elif league in ['Champions League', 'Europa League']:
        return {
            'total_weeks': 15,
            'season_start_month': 9,  # September
            'rivalry_frequency': 3,
            'activation_delay': 3
        }
    elif league == 'MLS':
        return {
            'total_weeks': 34,
            'season_start_month': 3,  # March
            'rivalry_frequency': 4,
            'activation_delay': 5
        }
    else:
        return {
            'total_weeks': 30,
            'season_start_month': 8,
            'rivalry_frequency': 4,
            'activation_delay': 5
        }

def calculate_actual_week_in_season(created_datetime, season_info):
    """Calculate actual week in season based on creation date"""
    from datetime import datetime
    
    # Assume season starts on the 1st of the season_start_month
    current_year = created_datetime.year
    season_start = datetime(current_year, season_info['season_start_month'], 1)
    
    # If created before season start, use previous year
    if created_datetime < season_start:
        season_start = datetime(current_year - 1, season_info['season_start_month'], 1)
    
    # Calculate weeks since season start
    days_diff = (created_datetime - season_start).days
    week_in_season = (days_diff // 7) + 1
    
    # Ensure week is within season bounds
    week_in_season = max(1, min(week_in_season, season_info['total_weeks']))
    
    return week_in_season

def calculate_activation_week_with_boundaries(created_week, league):
    """Calculate activation week with season boundary handling"""
    season_info = get_season_info_for_league(league)
    activation_week = created_week + season_info['activation_delay']
    
    # If activation would be after season ends, activate at season end
    if activation_week > season_info['total_weeks']:
        return season_info['total_weeks']
    
    return activation_week

def calculate_next_rivalry_week_with_season_handling(activation_week, league):
    """Calculate next rivalry week with proper season handling"""
    season_info = get_season_info_for_league(league)
    
    # First rivalry week should be at or after activation
    next_rivalry_week = max(activation_week, activation_week + 1)
    
    # Ensure it's within season bounds
    if next_rivalry_week > season_info['total_weeks']:
        next_rivalry_week = season_info['total_weeks']
    
    return next_rivalry_week

# Migration endpoint for group activation system
@app.post("/api/v1/admin/migrate-group-activation-system")
async def migrate_group_activation_system():
    """Migration endpoint to add group-relative activation system fields"""
    try:
        from .db.database import SessionLocal
        from sqlalchemy import text
        import logging
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        
        logger.info("🚀 Starting Group Activation System Migration...")
        
        db = SessionLocal()
        
        try:
            # Step 1: Check if migration is already done
            logger.info("📊 Checking current table structure...")
            
            columns_check = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'groups' AND column_name IN ('created_week', 'activation_week', 'next_rivalry_week')
            """)).fetchall()
            
            existing_columns = [col[0] for col in columns_check]
            logger.info(f"📋 Existing columns found: {existing_columns}")
            
            if len(existing_columns) == 3:
                logger.info("✅ Migration already completed - all columns exist")
                return {
                    "success": True, 
                    "message": "Migration already completed",
                    "existing_columns": existing_columns
                }
            
            # Step 2: Add new columns
            logger.info("🔧 Adding new columns to groups table...")
            
            columns_to_add = [
                ('created_week', 'INTEGER'),
                ('activation_week', 'INTEGER'), 
                ('next_rivalry_week', 'INTEGER')
            ]
            
            for col_name, col_type in columns_to_add:
                if col_name not in existing_columns:
                    try:
                        logger.info(f"➕ Adding column: {col_name} {col_type}")
                        db.execute(text(f"ALTER TABLE groups ADD COLUMN {col_name} {col_type}"))
                        db.commit()
                        logger.info(f"✅ Successfully added column: {col_name}")
                    except Exception as col_error:
                        db.rollback()
                        logger.error(f"❌ Failed to add column {col_name}: {col_error}")
                        return {"success": False, "error": f"Failed to add column {col_name}: {str(col_error)}"}
                else:
                    logger.info(f"⏭️ Column {col_name} already exists, skipping")
            
            # Step 3: Populate existing groups with activation data
            logger.info("🔄 Starting data population for existing groups...")
            
            # Get all existing groups
            groups_result = db.execute(text("SELECT id, created, league FROM groups")).fetchall()
            total_groups = len(groups_result)
            logger.info(f"📊 Found {total_groups} groups to process")
            
            updated_count = 0
            failed_count = 0
            errors = []
            
            for group_id, created_date, league in groups_result:
                try:
                    logger.info(f"🔄 Processing group {group_id} (league: {league})")
                    
                    # Calculate created_week based on created date and season boundaries
                    if created_date:
                        from datetime import datetime
                        created_datetime = created_date if isinstance(created_date, datetime) else datetime.fromisoformat(str(created_date))
                        
                        # Get season info for this league
                        season_info = get_season_info_for_league(league)
                        
                        # Calculate actual week in season based on creation date
                        created_week = calculate_actual_week_in_season(created_datetime, season_info)
                        
                        logger.info(f"📅 Group {group_id} created on {created_datetime.strftime('%Y-%m-%d')} - calculated as week {created_week} in {league} season")
                    else:
                        created_week = 1  # Default fallback
                        logger.warning(f"⚠️ Group {group_id} has no created date, using default week 1")
                    
                    # Calculate activation_week with season boundary handling
                    activation_week = calculate_activation_week_with_boundaries(created_week, league)
                    
                    # Calculate next_rivalry_week with proper season handling
                    next_rivalry_week = calculate_next_rivalry_week_with_season_handling(activation_week, league)
                    
                    logger.info(f"📅 Group {group_id}: created_week={created_week}, activation_week={activation_week}, next_rivalry_week={next_rivalry_week}")
                    
                    # Update the group
                    update_result = db.execute(text("""
                        UPDATE groups 
                        SET created_week = :created_week, 
                            activation_week = :activation_week, 
                            next_rivalry_week = :next_rivalry_week
                        WHERE id = :group_id
                    """), {
                        'created_week': created_week,
                        'activation_week': activation_week,
                        'next_rivalry_week': next_rivalry_week,
                        'group_id': group_id
                    })
                    
                    if update_result.rowcount > 0:
                        updated_count += 1
                        logger.info(f"✅ Successfully updated group {group_id}")
                    else:
                        failed_count += 1
                        logger.warning(f"⚠️ No rows updated for group {group_id}")
                        
                except Exception as group_error:
                    failed_count += 1
                    error_msg = f"Failed to process group {group_id}: {str(group_error)}"
                    errors.append(error_msg)
                    logger.error(f"❌ {error_msg}")
                    continue
            
            # Step 4: Create indexes for performance
            logger.info("🔍 Creating performance indexes...")
            
            try:
                db.execute(text("CREATE INDEX IF NOT EXISTS idx_groups_activation_week ON groups(activation_week)"))
                db.execute(text("CREATE INDEX IF NOT EXISTS idx_groups_next_rivalry_week ON groups(next_rivalry_week)"))
                db.commit()
                logger.info("✅ Performance indexes created successfully")
            except Exception as index_error:
                db.rollback()
                logger.warning(f"⚠️ Failed to create indexes: {index_error}")
            
            # Step 5: Final verification
            logger.info("🔍 Final verification...")
            
            verification_result = db.execute(text("""
                SELECT COUNT(*) as total_groups,
                       COUNT(created_week) as with_created_week,
                       COUNT(activation_week) as with_activation_week,
                       COUNT(next_rivalry_week) as with_next_rivalry_week
                FROM groups
            """)).fetchone()
            
            logger.info(f"📊 Verification results: {verification_result}")
            
            if verification_result.with_created_week == total_groups and \
               verification_result.with_activation_week == total_groups and \
               verification_result.with_next_rivalry_week == total_groups:
                logger.info("🎉 Migration completed successfully!")
                
                return {
                    "success": True,
                    "message": "Group Activation System migration completed successfully",
                    "summary": {
                        "total_groups": total_groups,
                        "successfully_updated": updated_count,
                        "failed_updates": failed_count,
                        "errors": errors[:10] if errors else [],  # Limit error list
                        "verification": {
                            "total_groups": verification_result.total_groups,
                            "with_created_week": verification_result.with_created_week,
                            "with_activation_week": verification_result.with_activation_week,
                            "with_next_rivalry_week": verification_result.with_next_rivalry_week
                        }
                    }
                }
            else:
                logger.error("❌ Migration verification failed - not all groups have required fields")
                return {
                    "success": False,
                    "error": "Migration verification failed",
                    "verification": verification_result
                }
                
        except Exception as db_error:
            logger.error(f"❌ Database error during migration: {db_error}")
            return {"success": False, "error": f"Database error: {str(db_error)}"}
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"💥 Migration failed with error: {e}")
        return {"success": False, "error": str(e)}

# Rollback endpoint for group activation system migration
@app.post("/api/v1/admin/rollback-group-activation-system")
async def rollback_group_activation_system():
    """Rollback endpoint to remove group activation system fields if needed"""
    try:
        from .db.database import SessionLocal
        from sqlalchemy import text
        import logging
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        
        logger.info("🔄 Starting Group Activation System Rollback...")
        
        db = SessionLocal()
        
        try:
            # Step 1: Check current state
            logger.info("📊 Checking current table structure...")
            
            columns_check = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'groups' AND column_name IN ('created_week', 'activation_week', 'next_rivalry_week')
            """)).fetchall()
            
            existing_columns = [col[0] for col in columns_check]
            logger.info(f"📋 Columns to remove: {existing_columns}")
            
            if not existing_columns:
                logger.info("✅ No columns to rollback - migration not applied")
                return {
                    "success": True, 
                    "message": "No rollback needed - migration not applied",
                    "existing_columns": []
                }
            
            # Step 2: Remove indexes first
            logger.info("🔍 Removing performance indexes...")
            
            try:
                db.execute(text("DROP INDEX IF EXISTS idx_groups_activation_week"))
                db.execute(text("DROP INDEX IF EXISTS idx_groups_next_rivalry_week"))
                db.commit()
                logger.info("✅ Performance indexes removed successfully")
            except Exception as index_error:
                db.rollback()
                logger.warning(f"⚠️ Failed to remove indexes: {index_error}")
            
            # Step 3: Remove columns
            logger.info("🔧 Removing columns from groups table...")
            
            for col_name in existing_columns:
                try:
                    logger.info(f"➖ Removing column: {col_name}")
                    db.execute(text(f"ALTER TABLE groups DROP COLUMN {col_name}"))
                    db.commit()
                    logger.info(f"✅ Successfully removed column: {col_name}")
                except Exception as col_error:
                    db.rollback()
                    logger.error(f"❌ Failed to remove column {col_name}: {col_error}")
                    return {"success": False, "error": f"Failed to remove column {col_name}: {str(col_error)}"}
            
            # Step 4: Final verification
            logger.info("🔍 Final verification...")
            
            verification_result = db.execute(text("""
                SELECT COUNT(*) as total_groups
                FROM groups
            """)).fetchone()
            
            logger.info(f"📊 Verification results: {verification_result}")
            logger.info("🎉 Rollback completed successfully!")
            
            return {
                "success": True,
                "message": "Group Activation System rollback completed successfully",
                "removed_columns": existing_columns,
                "verification": {
                    "total_groups": verification_result.total_groups
                }
            }
                
        except Exception as db_error:
            logger.error(f"❌ Database error during rollback: {db_error}")
            return {"success": False, "error": f"Database error: {str(db_error)}"}
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"💥 Rollback failed with error: {e}")
        return {"success": False, "error": str(e)}

# Test endpoint for group activation system migration
@app.get("/api/v1/admin/test-group-activation-migration")
async def test_group_activation_migration():
    """Test endpoint to check group activation system migration status"""
    try:
        from .db.database import SessionLocal
        from sqlalchemy import text
        
        db = SessionLocal()
        
        try:
            # Check if new columns exist
            columns_check = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'groups' AND column_name IN ('created_week', 'activation_week', 'next_rivalry_week')
            """)).fetchall()
            
            existing_columns = [col[0] for col in columns_check]
            
            # Check sample data
            sample_groups = db.execute(text("""
                SELECT id, name, league, created_week, activation_week, next_rivalry_week
                FROM groups 
                LIMIT 3
            """)).fetchall()
            
            return {
                "success": True,
                "message": "Group activation system migration status check",
                "existing_columns": existing_columns,
                "migration_complete": len(existing_columns) == 3,
                "sample_groups": [
                    {
                        "id": group[0],
                        "name": group[1],
                        "league": group[2],
                        "created_week": group[3],
                        "activation_week": group[4],
                        "next_rivalry_week": group[5]
                    }
                    for group in sample_groups
                ]
            }
            
        except Exception as db_error:
            return {"success": False, "error": f"Database error: {str(db_error)}"}
        finally:
            db.close()
            
    except Exception as e:
        return {"success": False, "error": str(e)}

# Test endpoint for rivalry service group-relative activation
@app.get("/api/v1/admin/test-rivalry-activation")
async def test_rivalry_activation():
    """Test endpoint to verify rivalry service group-relative activation"""
    try:
        from .services.rivalry_service import RivalryService
        from .db.database import SessionLocal
        from .db.models import Group
        
        db = SessionLocal()
        
        try:
            rivalry_service = RivalryService(db)
            
            # Get all groups to test
            groups = db.query(Group).all()
            test_results = []
            
            for group in groups:
                logging.info(f"🧪 Testing rivalry activation for group {group.id}: {group.name}")
                
                # Test different weeks - extend to cover full seasons
                if group.league in ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']:
                    test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30, 34, 38]  # Full season
                elif group.league in ['Champions League', 'Europa League']:
                    test_weeks = [1, 3, 6, 9, 12, 15]  # Short tournament
                elif group.league == 'MLS':
                    test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30, 34]  # 34 weeks
                else:
                    test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30]  # Default
                
                group_results = {
                    'group_id': group.id,
                    'group_name': group.name,
                    'league': group.league,
                    'created_week': group.created_week,
                    'activation_week': group.activation_week,
                    'next_rivalry_week': group.next_rivalry_week,
                    'week_tests': []
                }
                
                for week in test_weeks:
                    is_rivalry_week = rivalry_service._is_rivalry_week_for_group(group.id, week, "2025-2026")
                    group_results['week_tests'].append({
                        'week': week,
                        'is_rivalry_week': is_rivalry_week,
                        'weeks_since_activation': week - (group.activation_week or 0) if group.activation_week else None
                    })
                
                test_results.append(group_results)
                logging.info(f"✅ Group {group.id} test completed")
            
            return {
                "success": True,
                "message": "Rivalry activation tests completed",
                "test_results": test_results
            }
            
        except Exception as db_error:
            logging.error(f"❌ Database error during rivalry test: {db_error}")
            return {"success": False, "error": f"Database error: {str(db_error)}"}
        finally:
            db.close()
            
    except Exception as e:
        logging.error(f"❌ Error testing rivalry activation: {e}")
        return {"success": False, "error": str(e)}

# Test endpoint for analytics service group-relative activation
@app.get("/api/v1/admin/test-analytics-activation")
async def test_analytics_activation():
    """Test endpoint to verify analytics service group-relative activation"""
    try:
        from .services.analytics_service import AnalyticsService
        from .db.database import SessionLocal
        from .db.models import Group, User
        
        db = SessionLocal()
        
        try:
            analytics_service = AnalyticsService(db)
            
            # Get all groups to test
            groups = db.query(Group).all()
            test_results = []
            
            for group in groups:
                logging.info(f"🧪 Testing analytics activation for group {group.id}: {group.name}")
                
                # Get a sample user from this group
                from .db.models import group_members
                user_result = db.execute(text("""
                    SELECT user_id FROM group_members 
                    WHERE group_id = :group_id AND role IN ('ADMIN', 'MEMBER') 
                    LIMIT 1
                """), {'group_id': group.id}).first()
                
                if user_result:
                    user_id = user_result[0]
                    
                    # Test different weeks - extend to cover full seasons
                    if group.league in ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']:
                        test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30, 34, 38]  # Full season
                    elif group.league in ['Champions League', 'Europa League']:
                        test_weeks = [1, 3, 6, 9, 12, 15]  # Short tournament
                    elif group.league == 'MLS':
                        test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30, 34]  # 34 weeks
                    else:
                        test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30]  # Default
                    group_results = {
                        'group_id': group.id,
                        'group_name': group.name,
                        'league': group.league,
                        'activation_week': group.activation_week,
                        'user_id': user_id,
                        'week_tests': []
                    }
                    
                    for week in test_weeks:
                        activation_info = await analytics_service._check_analytics_activation(user_id, week, group.id)
                        group_results['week_tests'].append({
                            'week': week,
                            'available': activation_info['available'],
                            'activation_week': activation_info['activation_week'],
                            'reason': activation_info['reason']
                        })
                    
                    test_results.append(group_results)
                    logging.info(f"✅ Group {group.id} analytics test completed")
                else:
                    logging.warning(f"⚠️ No approved users found in group {group.id}")
            
            return {
                "success": True,
                "message": "Analytics activation tests completed",
                "test_results": test_results
            }
            
        except Exception as db_error:
            logging.error(f"❌ Database error during analytics test: {db_error}")
            return {"success": False, "error": f"Database error: {str(db_error)}"}
        finally:
            db.close()
            
    except Exception as e:
        logging.error(f"❌ Error testing analytics activation: {e}")
        return {"success": False, "error": str(e)}

# Test endpoint for bonus service group-relative activation
@app.get("/api/v1/admin/test-bonus-activation")
async def test_bonus_activation():
    """Test endpoint to verify bonus service group-relative activation"""
    try:
        from .services.bonus_service import BonusPointsService
        from .db.database import SessionLocal
        from .db.models import Group
        
        db = SessionLocal()
        
        try:
            bonus_service = BonusPointsService(db)
            
            # Get all groups to test
            groups = db.query(Group).all()
            test_results = []
            
            for group in groups:
                logging.info(f"🧪 Testing bonus activation for group {group.id}: {group.name}")
                
                # Test different weeks - extend to cover full seasons
                if group.league in ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']:
                    test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30, 34, 38]  # Full season
                elif group.league in ['Champions League', 'Europa League']:
                    test_weeks = [1, 3, 6, 9, 12, 15]  # Short tournament
                elif group.league == 'MLS':
                    test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30, 34]  # 34 weeks
                else:
                    test_weeks = [1, 5, 6, 10, 14, 18, 22, 26, 30]  # Default
                group_results = {
                    'group_id': group.id,
                    'group_name': group.name,
                    'league': group.league,
                    'activation_week': group.activation_week,
                    'week_tests': []
                }
                
                for week in test_weeks:
                    bonus_available = await bonus_service._check_bonus_activation(group.id, week)
                    group_results['week_tests'].append({
                        'week': week,
                        'bonus_available': bonus_available,
                        'weeks_since_activation': week - (group.activation_week or 0) if group.activation_week else None
                    })
                
                test_results.append(group_results)
                logging.info(f"✅ Group {group.id} bonus test completed")
            
            return {
                "success": True,
                "message": "Bonus activation tests completed",
                "test_results": test_results
            }
            
        except Exception as db_error:
            logging.error(f"❌ Database error during bonus test: {db_error}")
            return {"success": False, "error": f"Database error: {str(db_error)}"}
        finally:
            db.close()
            
    except Exception as e:
        logging.error(f"❌ Error testing bonus activation: {e}")
        return {"success": False, "error": str(e)}

# Test endpoint to trigger fixture updates from API
@app.post("/api/v1/admin/test-fixture-updates")
async def test_fixture_updates():
    """Test endpoint to trigger fixture updates from API"""
    try:
        from .services.enhanced_smart_scheduler import EnhancedSmartScheduler
        
        # Create scheduler instance and trigger API update check
        scheduler = EnhancedSmartScheduler()
        result = scheduler.trigger_api_update_check()
        
        return {
            "success": True,
            "message": "Fixture update test completed",
            "result": result
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

# Remove debug endpoint for production security

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)