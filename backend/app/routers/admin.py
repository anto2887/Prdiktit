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
        
        # Create user_sessions table
        create_sessions_table = """
        CREATE TABLE IF NOT EXISTS user_sessions (
            id VARCHAR(36) PRIMARY KEY,
            user_id INTEGER NOT NULL,
            session_id VARCHAR(64) UNIQUE NOT NULL,
            access_token TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE,
            user_agent TEXT,
            ip_address VARCHAR(45)
        );
        """
        
        # Create indexes for performance
        create_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);"
        ]
        
        # Add foreign key constraint
        add_foreign_key = """
        ALTER TABLE user_sessions 
        ADD CONSTRAINT IF NOT EXISTS fk_user_sessions_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        """
        
        # Execute migration
        db.execute(text(create_sessions_table))
        db.commit()
        
        for index_sql in create_indexes:
            db.execute(text(index_sql))
            db.commit()
        
        db.execute(text(add_foreign_key))
        db.commit()
        
        logger.info("✅ Session system migration completed successfully")
        
        return {
            "success": True,
            "message": "Session system migration completed successfully",
            "migration_type": "session_system",
            "changes": [
                "Created user_sessions table",
                "Added session management indexes",
                "Added foreign key constraints"
            ],
            "timestamp": datetime.now(timezone.utc)
        }
        
    except Exception as e:
        logger.error(f"❌ Session system migration failed: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Session system migration failed: {str(e)}"
        )

@router.get("/test-session-system")
async def test_session_system(db: Session = Depends(get_db)):
    """
    Test the session system endpoints and functionality
    """
    try:
        logger.info("🧪 Testing session system...")
        
        # Test OAuth endpoint
        oauth_test = await test_oauth_endpoint(db)
        
        # Test session table exists
        session_table_test = await test_session_table(db)
        
        # Test session service
        session_service_test = await test_session_service(db)
        
        return {
            "success": True,
            "message": "Session system test completed",
            "tests": {
                "oauth_endpoint": oauth_test,
                "session_table": session_table_test,
                "session_service": session_service_test
            },
            "timestamp": datetime.now(timezone.utc)
        }
        
    except Exception as e:
        logger.error(f"❌ Session system test failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Session system test failed: {str(e)}"
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