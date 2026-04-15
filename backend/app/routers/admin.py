import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text

# Set up logger for this module
logger = logging.getLogger(__name__)

from ..core.dependencies import get_current_active_user_from_session
from ..db.session_manager import get_db
from ..schemas import DataResponse, User
from ..services.cache_service import get_cache, RedisCache
from ..db.models import UserNotificationPreferences, User as UserModel

# Add error handling for the MatchProcessor import
try:
    from ..services.match_processor import MatchProcessor
    MATCH_PROCESSOR_AVAILABLE = True
except ImportError as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Failed to import MatchProcessor: {e}")
    MATCH_PROCESSOR_AVAILABLE = False

router = APIRouter()

@router.post("/process-matches", response_model=DataResponse)
async def process_completed_matches(
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db)
):
    """
    Manually trigger processing of completed matches
    """
    if not MATCH_PROCESSOR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Match processor service not available"
        )
    
    try:
        processor = MatchProcessor()
        result = processor.run_match_processing()
        
        return DataResponse(
            data=result,
            message="Match processing completed"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing matches: {str(e)}"
        )

@router.post("/lock-predictions", response_model=DataResponse)
async def lock_match_predictions(
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db)
):
    """
    Manually trigger locking of predictions for matches at kickoff
    """
    if not MATCH_PROCESSOR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Match processor service not available"
        )
    
    try:
        processor = MatchProcessor()
        result = processor.run_prediction_locking()
        
        return DataResponse(
            data=result,
            message="Prediction locking completed"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error locking predictions: {str(e)}"
        )

@router.post("/process-all", response_model=DataResponse)
async def process_all_tasks(
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db)
):
    """
    Run all processing tasks (lock predictions + process matches)
    """
    if not MATCH_PROCESSOR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Match processor service not available"
        )
    
    try:
        processor = MatchProcessor()
        result = processor.run_all_processing()
        
        return DataResponse(
            data=result,
            message="All processing tasks completed"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error running processing tasks: {str(e)}"
        )

@router.get("/processing-status", response_model=DataResponse)
async def get_processing_status(
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db)
):
    """
    Get status of matches and predictions needing processing
    """
    if not MATCH_PROCESSOR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Match processor service not available"
        )
    
    try:
        processor = MatchProcessor()
        
        completed_matches = processor.get_completed_matches()
        upcoming_matches = processor.get_upcoming_matches_for_locking()
        
        status_data = {
            "completed_matches_needing_processing": len(completed_matches),
            "matches_ready_for_locking": len(upcoming_matches),
            "completed_matches": [
                {
                    "fixture_id": match.fixture_id,
                    "home_team": match.home_team,
                    "away_team": match.away_team,
                    "score": f"{match.home_score}-{match.away_score}",
                    "status": match.status.value
                }
                for match in completed_matches[:10]  # Limit to 10 for display
            ],
            "upcoming_matches": [
                {
                    "fixture_id": match.fixture_id,
                    "home_team": match.home_team,
                    "away_team": match.away_team,
                    "kickoff": match.date.isoformat() if match.date else None
                }
                for match in upcoming_matches[:10]  # Limit to 10 for display
            ],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        return DataResponse(
            data=status_data,
            message="Processing status retrieved"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting processing status: {str(e)}"
        )

@router.post("/migrate-oauth2-system")
async def migrate_oauth2_system(db: Session = Depends(get_db)):
    """Migrate database schema to support OAuth2 authentication"""
    try:
        logger.info("🔄 Starting OAuth2 system migration...")
        
        # Check if migration is already done
        inspector = inspect(db.bind)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'oauth_provider' in existing_columns and 'oauth_id' in existing_columns and 'is_oauth_user' in existing_columns:
            logger.info("✅ OAuth2 migration already completed")
            return {
                "success": True,
                "message": "OAuth2 migration already completed",
                "migration_type": "oauth2_system",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Add OAuth2 columns to users table
        logger.info("🔧 Adding OAuth2 columns to users table...")
        
        # Add oauth_provider column
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN oauth_provider VARCHAR(50)
        """))
        
        # Add oauth_id column
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN oauth_id VARCHAR(255)
        """))
        
        # Add is_oauth_user column
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN is_oauth_user BOOLEAN DEFAULT FALSE
        """))
        
        # Make hashed_password nullable for OAuth users
        db.execute(text("""
            ALTER TABLE users 
            ALTER COLUMN hashed_password DROP NOT NULL
        """))
        
        # Create indexes for OAuth fields
        logger.info("🔧 Creating OAuth2 indexes...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider)
        """))
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id)
        """))
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_users_is_oauth_user ON users(is_oauth_user)
        """))
        
        # Create unique constraint for OAuth users
        db.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS unique_oauth_user 
            ON users(oauth_provider, oauth_id) 
            WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL
        """))
        
        # Add check constraint for OAuth or password requirement
        db.execute(text("""
            ALTER TABLE users 
            ADD CONSTRAINT oauth_or_password_constraint 
            CHECK (
                (is_oauth_user = false AND hashed_password IS NOT NULL) OR 
                (is_oauth_user = true AND oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
            )
        """))
        
        # Commit the migration
        db.commit()
        
        logger.info("✅ OAuth2 system migration completed successfully")
        
        return {
            "success": True,
            "message": "OAuth2 system migration completed successfully",
            "migration_type": "oauth2_system",
            "changes": [
                "Added oauth_provider column",
                "Added oauth_id column", 
                "Added is_oauth_user column",
                "Made hashed_password nullable",
                "Created OAuth2 indexes",
                "Added unique constraint for OAuth users",
                "Added check constraint for OAuth/password requirement"
            ],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ OAuth2 migration failed: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth2 migration failed: {str(e)}"
        )

@router.post("/migrate-session-system")
async def migrate_session_system(db: Session = Depends(get_db)):
    """
    Migrate to session-based authentication system
    Creates user_sessions table and related indexes
    """
    try:
        logger.info("🔄 Starting session system migration...")
        
        # Check if migration is already done
        inspector = inspect(db.bind)
        existing_tables = inspector.get_table_names()
        
        if 'user_sessions' in existing_tables:
            logger.info("✅ Session system migration already completed")
            return {
                "success": True,
                "message": "Session system migration already completed",
                "migration_type": "session_system",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Create user_sessions table
        logger.info("🔧 Creating user_sessions table...")
        db.execute(text("""
            CREATE TABLE user_sessions (
                id VARCHAR(36) PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_id VARCHAR(64) UNIQUE NOT NULL,
                access_token TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE,
                user_agent TEXT,
                ip_address VARCHAR(45)
            )
        """))
        
        # Create indexes
        logger.info("🔧 Creating session indexes...")
        db.execute(text("""
            CREATE INDEX idx_session_expires ON user_sessions(expires_at)
        """))
        
        db.execute(text("""
            CREATE INDEX idx_session_user_active ON user_sessions(user_id, is_active)
        """))
        
        # Execute migration
        db.commit()
        
        logger.info("✅ Session system migration completed successfully")
        
        return {
            "success": True,
            "message": "Session system migration completed successfully",
            "migration_type": "session_system",
            "changes": [
                "Created user_sessions table",
                "Added session indexes",
                "Added foreign key constraint to users table"
            ],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Session system migration failed: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session system migration failed: {str(e)}"
        )

@router.post("/migrate-users-updated-at")
async def migrate_users_updated_at(db: Session = Depends(get_db)):
    """Migrate database schema to add updated_at column to users table"""
    try:
        logger.info("🔄 Starting users updated_at migration...")
        
        # Check if migration is already done
        inspector = inspect(db.bind)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'updated_at' in existing_columns:
            logger.info("✅ Users updated_at migration already completed")
            return {
                "success": True,
                "message": "Users updated_at migration already completed",
                "migration_type": "users_updated_at",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Add updated_at column to users table
        logger.info("🔧 Adding updated_at column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        """))
        
        # Update existing records to have updated_at = created_at
        logger.info("🔧 Updating existing user records...")
        db.execute(text("""
            UPDATE users 
            SET updated_at = created_at 
            WHERE updated_at IS NULL
        """))
        
        # Make updated_at NOT NULL after populating
        logger.info("🔧 Making updated_at NOT NULL...")
        db.execute(text("""
            ALTER TABLE users 
            ALTER COLUMN updated_at SET NOT NULL
        """))
        
        # Also add settings column if it doesn't exist
        if 'settings' not in existing_columns:
            logger.info("🔧 Adding settings column to users table...")
            try:
                db.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN settings JSON
                """))
                logger.info("✅ Settings column added successfully")
            except Exception as settings_error:
                logger.warning(f"⚠️ Could not add settings column (may already exist): {str(settings_error)}")
        
        # Commit the migration
        db.commit()
        
        logger.info("✅ Users updated_at migration completed successfully")
        
        changes = [
            "Added updated_at column to users table",
            "Set default value to NOW()",
            "Updated existing records to have updated_at = created_at",
            "Made updated_at NOT NULL"
        ]
        
        if 'settings' not in existing_columns:
            changes.append("Added settings column (JSON type) to users table")
        
        return {
            "success": True,
            "message": "Users updated_at migration completed successfully",
            "migration_type": "users_updated_at",
            "changes": changes,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Users updated_at migration failed: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Users updated_at migration failed: {str(e)}"
        )

@router.post("/migrate-all-oauth-system")
async def migrate_all_oauth_system(db: Session = Depends(get_db)):
    """
    Run all OAuth system migrations in the correct order:
    1. OAuth2 system migration (adds OAuth columns)
    2. Users updated_at migration (adds missing updated_at column)
    3. Session system migration (creates user_sessions table)
    """
    try:
        logger.info("🚀 Starting comprehensive OAuth system migration...")
        
        migration_results = []
        overall_success = True
        
        # Step 1: OAuth2 system migration
        try:
            logger.info("📋 Step 1: Running OAuth2 system migration...")
            oauth_result = await migrate_oauth2_system(db)
            migration_results.append({
                "step": 1,
                "migration": "oauth2_system",
                "status": "success",
                "result": oauth_result
            })
            logger.info("✅ Step 1 completed successfully")
        except Exception as e:
            logger.error(f"❌ Step 1 failed: {str(e)}")
            migration_results.append({
                "step": 1,
                "migration": "oauth2_system",
                "status": "failed",
                "error": str(e)
            })
            overall_success = False
        
        # Step 2: Users updated_at migration
        try:
            logger.info("📋 Step 2: Running users updated_at migration...")
            updated_at_result = await migrate_users_updated_at(db)
            migration_results.append({
                "step": 2,
                "migration": "users_updated_at",
                "status": "success",
                "result": updated_at_result
            })
            logger.info("✅ Step 2 completed successfully")
        except Exception as e:
            logger.error(f"❌ Step 2 failed: {str(e)}")
            migration_results.append({
                "step": 2,
                "migration": "users_updated_at",
                "status": "failed",
                "error": str(e)
            })
            overall_success = False
        
        # Step 3: Session system migration
        try:
            logger.info("📋 Step 3: Running session system migration...")
            session_result = await migrate_session_system(db)
            migration_results.append({
                "step": 3,
                "migration": "session_system",
                "status": "success",
                "result": session_result
            })
            logger.info("✅ Step 3 completed successfully")
        except Exception as e:
            logger.error(f"❌ Step 3 failed: {str(e)}")
            migration_results.append({
                "step": 3,
                "migration": "session_system",
                "status": "failed",
                "error": str(e)
            })
            overall_success = False
        
        # Summary
        if overall_success:
            logger.info("🎉 All OAuth system migrations completed successfully!")
            return {
                "success": True,
                "message": "All OAuth system migrations completed successfully",
                "migration_type": "comprehensive_oauth_system",
                "steps_completed": len([r for r in migration_results if r["status"] == "success"]),
                "total_steps": len(migration_results),
                "migration_results": migration_results,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            failed_steps = [r for r in migration_results if r["status"] == "failed"]
            logger.error(f"❌ Some migrations failed: {len(failed_steps)} out of {len(migration_results)}")
            return {
                "success": False,
                "message": f"Some migrations failed: {len(failed_steps)} out of {len(migration_results)}",
                "migration_type": "comprehensive_oauth_system",
                "steps_completed": len([r for r in migration_results if r["status"] == "success"]),
                "total_steps": len(migration_results),
                "failed_steps": failed_steps,
                "migration_results": migration_results,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
    except Exception as e:
        logger.error(f"💥 Comprehensive migration failed with error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comprehensive migration failed: {str(e)}"
        )

@router.get("/test-session-system")
async def test_session_system(db: Session = Depends(get_db)):
    """
    Test session system functionality
    """
    try:
        # Test OAuth endpoint
        oauth_result = await test_oauth_endpoint(db)
        
        # Test session table
        table_result = await test_session_table(db)
        
        # Test session service
        service_result = await test_session_service(db)
        
        return {
            "success": True,
            "message": "Session system test completed",
            "tests": {
                "oauth_endpoint": oauth_result,
                "session_table": table_result,
                "session_service": service_result
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Session system test failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Session system test failed: {str(e)}"
        )

@router.post("/migrate-users-settings")
async def migrate_users_settings(db: Session = Depends(get_db)):
    """Migrate database schema to add settings column to users table"""
    try:
        logger.info("🔄 Starting users settings migration...")
        
        # Check if migration is already done
        inspector = inspect(db.bind)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'settings' in existing_columns:
            logger.info("✅ Users settings migration already completed")
            return {
                "success": True,
                "message": "Users settings migration already completed",
                "migration_type": "users_settings",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Add settings column to users table
        logger.info("🔧 Adding settings column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN settings JSON
        """))
        
        # Commit the migration
        db.commit()
        
        logger.info("✅ Users settings migration completed successfully")
        
        return {
            "success": True,
            "message": "Users settings migration completed successfully",
            "migration_type": "users_settings",
            "changes": [
                "Added settings column (JSON type) to users table"
            ],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Users settings migration failed: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Users settings migration failed: {str(e)}"
        )

@router.get("/test-users-updated-at")
async def test_users_updated_at(db: Session = Depends(get_db)):
    """
    Test users updated_at column status
    """
    try:
        inspector = inspect(db.bind)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]
        
        has_updated_at = 'updated_at' in existing_columns
        
        if has_updated_at:
            # Check if there are any NULL values
            null_count = db.execute(text("""
                SELECT COUNT(*) FROM users WHERE updated_at IS NULL
            """)).scalar()
            
            return {
                "success": True,
                "message": "Users updated_at column status check",
                "status": "migrated",
                "has_updated_at": True,
                "null_values_count": null_count,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            return {
                "success": True,
                "message": "Users updated_at column status check",
                "status": "not_migrated",
                "has_updated_at": False,
                "details": "Run migration first",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
    except Exception as e:
        logger.error(f"❌ Failed to get users updated_at status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get users updated_at status: {str(e)}"
        )

@router.get("/session-system-status")
async def get_session_system_status(db: Session = Depends(get_db)):
    """
    Get current status of the session system
    """
    try:
        # Check if user_sessions table exists
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        has_sessions_table = 'user_sessions' in tables
        
        if has_sessions_table:
            # Get session count
            session_count = db.execute(text("SELECT COUNT(*) FROM user_sessions")).scalar()
            active_sessions = db.execute(text("SELECT COUNT(*) FROM user_sessions WHERE is_active = true")).scalar()
            expired_sessions = db.execute(text("SELECT COUNT(*) FROM user_sessions WHERE expires_at <= NOW()")).scalar()
            
            # Get table structure
            columns = inspector.get_columns('user_sessions')
            column_names = [col['name'] for col in columns]
            
            return {
                "success": True,
                "status": "active",
                "table_exists": True,
                "session_stats": {
                    "total_sessions": session_count,
                    "active_sessions": active_sessions,
                    "expired_sessions": expired_sessions
                },
                "table_structure": column_names,
                "timestamp": datetime.now(timezone.utc)
            }
        else:
            return {
                "success": True,
                "status": "not_migrated",
                "table_exists": False,
                "message": "Session system not yet migrated",
                "timestamp": datetime.now(timezone.utc)
            }
            
    except Exception as e:
        logger.error(f"❌ Failed to get session system status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get session system status: {str(e)}"
        )

@router.post("/cleanup-expired-sessions")
async def cleanup_expired_sessions(db: Session = Depends(get_db)):
    """
    Manually trigger cleanup of expired sessions
    """
    try:
        from ..services.session_service import session_service
        
        cleaned_count = session_service.cleanup_expired_sessions(db)
        
        return {
            "success": True,
            "message": f"Cleaned up {cleaned_count} expired sessions",
            "cleaned_count": cleaned_count,
            "timestamp": datetime.now(timezone.utc)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to cleanup expired sessions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup expired sessions: {str(e)}"
        )


@router.get("/test-notification-preferences")
async def test_notification_preferences(db: Session = Depends(get_db)):
    """
    Check status of user_notification_preferences table.
    Returns table existence, total rows, and how many users are missing a prefs row.
    """
    try:
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        table_exists = "user_notification_preferences" in tables

        if not table_exists:
            return {
                "table_exists": False,
                "total_rows": 0,
                "users_without_prefs": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        total_rows = db.execute(
            text("SELECT COUNT(*) FROM user_notification_preferences")
        ).scalar() or 0

        users_without_prefs = db.execute(
            text(
                """
                SELECT COUNT(*) FROM users u
                LEFT JOIN user_notification_preferences p
                    ON u.id = p.user_id
                WHERE p.user_id IS NULL
                """
            )
        ).scalar() or 0

        return {
            "table_exists": True,
            "total_rows": int(total_rows),
            "users_without_prefs": int(users_without_prefs),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"❌ Failed to test notification preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test notification preferences: {str(e)}",
        )


@router.post("/migrate-notification-preferences")
async def migrate_notification_preferences(db: Session = Depends(get_db)):
    """
    Create user_notification_preferences table and backfill existing users.
    Safe to run multiple times — checks before each step.
    """
    try:
        logger.info("🔄 Starting notification preferences migration...")

        # Step 1: Check if table already exists
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        table_exists = "user_notification_preferences" in tables

        if table_exists:
            # Check if all users already have prefs
            users_without_prefs = db.execute(
                text(
                    """
                    SELECT COUNT(*) FROM users u
                    LEFT JOIN user_notification_preferences p
                        ON u.id = p.user_id
                    WHERE p.user_id IS NULL
                    """
                )
            ).scalar() or 0

            if users_without_prefs == 0:
                logger.info("✅ Notification preferences migration already completed")
                return {
                    "success": True,
                    "message": "Notification preferences migration already completed",
                    "rows_created": 0,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

        # Step 2: CREATE TABLE IF NOT EXISTS
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS user_notification_preferences (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    prediction_reminders BOOLEAN NOT NULL DEFAULT TRUE,
                    match_result_updates BOOLEAN NOT NULL DEFAULT TRUE,
                    group_activity BOOLEAN NOT NULL DEFAULT TRUE,
                    reminder_24h BOOLEAN NOT NULL DEFAULT TRUE,
                    reminder_1h BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
                """
            )
        )

        # Step 3: Create index
        db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_id
                ON user_notification_preferences(user_id)
                """
            )
        )

        # Step 4a: Normalize any existing rows with NULL booleans → TRUE
        db.execute(
            text(
                """
                UPDATE user_notification_preferences
                SET
                    email_enabled = COALESCE(email_enabled, TRUE),
                    prediction_reminders = COALESCE(prediction_reminders, TRUE),
                    match_result_updates = COALESCE(match_result_updates, TRUE),
                    group_activity = COALESCE(group_activity, TRUE),
                    reminder_24h = COALESCE(reminder_24h, TRUE),
                    reminder_1h = COALESCE(reminder_1h, TRUE)
                """
            )
        )

        # Step 4b: Backfill — insert default rows for users who don't have one yet
        result = db.execute(
            text(
                """
                INSERT INTO user_notification_preferences (
                    user_id,
                    email_enabled,
                    prediction_reminders,
                    match_result_updates,
                    group_activity,
                    reminder_24h,
                    reminder_1h
                )
                SELECT
                    id,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE
                FROM users
                WHERE id NOT IN (
                    SELECT user_id FROM user_notification_preferences
                )
                """
            )
        )

        rows_created = result.rowcount or 0
        db.commit()

        logger.info(f"✅ Notification preferences migration completed, rows_created={rows_created}")

        return {
            "success": True,
            "message": "Notification preferences migration completed",
            "rows_created": int(rows_created),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"❌ Notification preferences migration failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Notification preferences migration failed: {str(e)}",
        )


@router.post("/migrate-result-notification-tracking")
async def migrate_result_notification_tracking(db: Session = Depends(get_db)):
    """
    Add result_notified_at to user_predictions and full-backfill existing PROCESSED rows.
    Safe to run multiple times.
    """
    try:
        logger.info("🔄 Starting result notification tracking migration...")

        inspector = inspect(db.bind)
        existing_columns = [col["name"] for col in inspector.get_columns("user_predictions")]

        if "result_notified_at" not in existing_columns:
            db.execute(
                text(
                    """
                    ALTER TABLE user_predictions
                    ADD COLUMN result_notified_at TIMESTAMP WITH TIME ZONE NULL
                    """
                )
            )
            logger.info("✅ Added user_predictions.result_notified_at column")

        backfill_result = db.execute(
            text(
                """
                UPDATE user_predictions
                SET result_notified_at = NOW()
                WHERE prediction_status = 'PROCESSED'
                  AND result_notified_at IS NULL
                """
            )
        )

        rows_backfilled = backfill_result.rowcount or 0
        db.commit()

        logger.info(
            "✅ Result notification tracking migration completed, rows_backfilled=%s",
            rows_backfilled,
        )
        return {
            "success": True,
            "message": "Result notification tracking migration completed",
            "rows_backfilled": int(rows_backfilled),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"❌ Result notification tracking migration failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Result notification tracking migration failed: {str(e)}",
        )

# Helper functions for testing
async def test_oauth_endpoint(db: Session):
    """Test OAuth endpoint functionality"""
    try:
        # This would test the OAuth service
        # For now, just check if the service can be imported
        from ..services.oauth_service import oauth_service
        
        return {
            "status": "success",
            "message": "OAuth service available",
            "details": "OAuth service imported successfully"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "OAuth service test failed",
            "details": str(e)
        }

async def test_session_table(db: Session):
    """Test session table functionality"""
    try:
        # Check if table exists and has correct structure
        inspector = inspect(db.bind)
        if 'user_sessions' not in inspector.get_table_names():
            return {
                "status": "error",
                "message": "Session table does not exist",
                "details": "Run migration first"
            }
        
        # Test basic operations
        test_result = db.execute(text("SELECT COUNT(*) FROM user_sessions")).scalar()
        
        return {
            "status": "success",
            "message": "Session table accessible",
            "details": f"Table contains {test_result} sessions"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "Session table test failed",
            "details": str(e)
        }

async def test_session_service(db: Session):
    """Test session service functionality"""
    try:
        from ..services.session_service import session_service
        
        return {
            "status": "success",
            "message": "Session service available",
            "details": "Session service imported successfully"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "Session service test failed",
            "details": str(e)
        }


@router.post("/test-send-email")
async def test_send_email(
    to_email: str,
    db: Session = Depends(get_db),
):
    """
    Temporary test endpoint — send a simple email to verify provider setup.
    Safe to remove after verification.
    """
    try:
        from ..services.notification_service import EmailService

        email_service = EmailService()
        sent = await email_service.send(
            to_email=to_email,
            to_name="Test User",
            subject="PrediktIt — Test Email",
            html="<h1>Test email working ✅</h1><p>Your email provider setup is correct.</p>",
            text="Test email working. Your email provider setup is correct.",
        )
        return {"sent": sent, "to": to_email}
    except Exception as e:
        logger.error(f"Error in test_send_email: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test email: {str(e)}",
        )


@router.post("/test-queue-job")
async def test_queue_job(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Push a test match_result_digest job to the Redis notification queue.
    Temporary endpoint — safe to delete after verification.
    """
    try:
        import json
        from datetime import datetime, timezone
        from ..services.cache_service import cache_instance

        if not cache_instance.redis_client:
            raise HTTPException(
                status_code=500,
                detail="Redis client is not initialized",
            )

        fixture_id = 1379249
        prediction_id = 17
        fixture = db.query(Fixture).filter_by(fixture_id=fixture_id).first()

        job = {
            "type": "match_result_digest",
            "user_id": user_id,
            "payload": {
                "league": fixture.league if fixture else "Unknown League",
                "group_names": [],
                "items": [
                    {
                        "fixture_id": fixture_id,
                        "prediction_id": prediction_id,
                        "points_earned": 1,
                    }
                ],
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "retry_count": 0,
        }

        cache_instance.redis_client.lpush("notif:jobs", json.dumps(job))
        queue_length = cache_instance.redis_client.llen("notif:jobs")

        return {
            "queued": True,
            "user_id": user_id,
            "queue_length": int(queue_length),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in test_queue_job: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue test job: {str(e)}",
        )


@router.post("/test-send-notification")
async def test_send_notification(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Directly invoke send_match_result for a user — bypasses Redis queue.
    Safe to delete after verification.
    """
    from ..services.notification_service import NotificationService
    from ..db.models import Fixture, UserPrediction, UserNotificationPreferences, User

    # Check user exists
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check prefs
    prefs = (
        db.query(UserNotificationPreferences)
        .filter_by(user_id=user_id)
        .first()
    )

    # Get any real fixture and prediction for this user
    prediction = (
        db.query(UserPrediction)
        .filter_by(user_id=user_id)
        .first()
    )
    fixture = (
        db.query(Fixture)
        .filter_by(fixture_id=prediction.fixture_id)
        .first()
        if prediction
        else None
    )

    debug = {
        "user_email": user.email,
        "has_prefs_row": prefs is not None,
        "email_enabled": prefs.email_enabled if prefs else None,
        "match_result_updates": prefs.match_result_updates if prefs else None,
        "fixture_found": fixture is not None,
        "prediction_found": prediction is not None,
    }

    if not fixture or not prediction:
        return {
            "sent": False,
            "reason": "No fixture/prediction found for user",
            "debug": debug,
        }

    notif = NotificationService(db)
    sent = await notif.send_match_result(user_id, fixture, prediction, 3)

    return {"sent": sent, "debug": debug}


@router.post("/repair-prediction-group-scoping", response_model=DataResponse)
async def repair_prediction_group_scoping_endpoint(
    dry_run: bool = Query(
        True,
        description="If true, reports actions only; no commits. Run with false after review.",
    ),
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache),
):
    """
    Fix predictions whose group_id does not match membership or fixture league.
    After a real run (dry_run=false), invalidates Redis caches for affected groups.
    """
    from ..services.prediction_group_scoping import repair_misscoped_prediction_group_ids
    from ..services.group_cache_invalidation import invalidate_group_scoped_caches

    result = repair_misscoped_prediction_group_ids(db, dry_run=dry_run)
    if not dry_run and result.get("affected_group_ids"):
        for gid in result["affected_group_ids"]:
            await invalidate_group_scoped_caches(cache, db, gid)
    return DataResponse(
        message=(
            "Dry run complete — no database changes"
            if dry_run
            else "Prediction group scoping repair applied"
        ),
        data=result,
    )