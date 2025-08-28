import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text

# Set up logger for this module
logger = logging.getLogger(__name__)

from ..core.dependencies import get_current_active_user_dependency
from ..db.session_manager import get_db
from ..schemas import DataResponse, User

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
    current_user: User = Depends(get_current_active_user_dependency()),
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
    current_user: User = Depends(get_current_active_user_dependency()),
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
    current_user: User = Depends(get_current_active_user_dependency()),
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
    current_user: User = Depends(get_current_active_user_dependency()),
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
        
        # Commit the migration
        db.commit()
        
        logger.info("✅ Users updated_at migration completed successfully")
        
        return {
            "success": True,
            "message": "Users updated_at migration completed successfully",
            "migration_type": "users_updated_at",
            "changes": [
                "Added updated_at column to users table",
                "Set default value to NOW()",
                "Updated existing records to have updated_at = created_at",
                "Made updated_at NOT NULL"
            ],
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