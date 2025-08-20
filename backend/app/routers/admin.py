import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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