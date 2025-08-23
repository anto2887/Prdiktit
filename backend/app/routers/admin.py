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