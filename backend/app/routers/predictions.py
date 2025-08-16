# app/routers/predictions.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import func

# Set up logger
logger = logging.getLogger(__name__)

from ..core.dependencies import get_current_active_user_dependency
from ..db.session_manager import get_db
from ..services.cache_service import get_cache, RedisCache
from ..db import (
    get_fixture_by_id,
    get_user_prediction,
    create_prediction,
    update_prediction,
    reset_prediction,
    get_prediction_by_id,
    get_user_predictions,
    get_prediction_deadlines,
    check_group_membership
)
from ..db.models import UserPrediction, Group, User, Fixture, group_members
from ..schemas import (
    Prediction, PredictionCreate, PredictionStatus, 
    MatchStatus, ListResponse, DataResponse, User as UserSchema,
    PredictionUpdate, BaseResponse
)
from ..utils.season_manager import SeasonManager
from ..services.prediction_visibility import PredictionVisibilityService

router = APIRouter()

@router.post("", response_model=DataResponse)
async def submit_prediction(
    prediction_data: PredictionCreate,
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Submit a new prediction.
    
    TIMEZONE HANDLING:
    - All deadlines checked against UTC
    - Database stores all times in UTC
    - Frontend displays times in user's local timezone
    """
    
    try:
        logger.info(f"Received prediction request: {prediction_data}")
        logger.info(f"User: {current_user.id}")
        
        # Extract data with validation
        match_id = prediction_data.match_id
        home_score = prediction_data.home_score  
        away_score = prediction_data.away_score
        
        logger.info(f"Processing prediction: match_id={match_id}, home={home_score}, away={away_score}")
        
        # Validate scores
        if not (0 <= home_score <= 20 and 0 <= away_score <= 20):
            logger.error(f"Invalid scores: home={home_score}, away={away_score}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Scores must be between 0 and 20"
            )
        
        # Get the fixture using your actual repository function
        logger.info(f"Looking up fixture: {match_id}")
        fixture = await get_fixture_by_id(db, match_id)
        
        if not fixture:
            logger.error(f"Fixture not found: {match_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Match with ID {match_id} not found"
            )
        
        logger.info(f"Found fixture: {fixture.fixture_id}, status: {fixture.status}")
        logger.info(f"Teams: {fixture.home_team} vs {fixture.away_team}")
        
        # Check if match has started
        if fixture.status != MatchStatus.NOT_STARTED:
            logger.error(f"Match already started: {fixture.status}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot predict after match has started"
            )
        
        # CRITICAL: All deadline checks must be UTC-aware
        current_time_utc = datetime.now(timezone.utc)
        logger.info(f"Current time (UTC): {current_time_utc}")
        
        if fixture.date:
            # Ensure fixture date is UTC-aware
            if fixture.date.tzinfo is None:
                # Database stored naive datetime - assume UTC
                fixture_utc = fixture.date.replace(tzinfo=timezone.utc)
                logger.warning(f"Converting naive fixture date to UTC: {fixture_utc}")
            else:
                fixture_utc = fixture.date.astimezone(timezone.utc)
            
            # Deadline is exactly kickoff time (UTC)
            deadline_utc = fixture_utc
            logger.info(f"Prediction deadline (UTC): {deadline_utc}")
            
            if current_time_utc > deadline_utc:
                # Calculate how long ago deadline passed for better error message
                time_passed = current_time_utc - deadline_utc
                minutes_passed = int(time_passed.total_seconds() / 60)
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Prediction deadline passed {minutes_passed} minutes ago. "
                           f"Deadline was at kickoff time: {deadline_utc.isoformat()}"
                )
        else:
            logger.warning("Fixture has no date, skipping deadline check")
                
        # Check for existing prediction using your actual repository function
        logger.info("Checking for existing prediction")
        existing_prediction = await get_user_prediction(db, current_user.id, match_id)
        
        if existing_prediction:
            logger.info(f"Updating existing prediction: {existing_prediction.id}")
            # Update existing using your actual repository function
            updated_prediction = await update_prediction(
                db,
                existing_prediction.id,
                score1=home_score,
                score2=away_score
            )
            
            if not updated_prediction:
                logger.error("Failed to update prediction")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update prediction"
                )
            
            # Clear cache safely
            try:
                await cache.delete(f"user_predictions:{current_user.id}")
            except Exception as cache_error:
                logger.warning(f"Cache delete failed: {cache_error}")
            
            logger.info("Prediction updated successfully")
            return DataResponse(
                data={
                    "id": updated_prediction.id,
                    "match_id": updated_prediction.fixture_id,
                    "home_score": updated_prediction.score1,
                    "away_score": updated_prediction.score2,
                    "points": updated_prediction.points,
                    "prediction_status": updated_prediction.prediction_status.value if hasattr(updated_prediction.prediction_status, 'value') else str(updated_prediction.prediction_status),
                    "created": updated_prediction.created.isoformat() if updated_prediction.created else None,
                    "user_id": updated_prediction.user_id
                },
                message="Prediction updated successfully"
            )
        
        # Create new prediction
        logger.info("Creating new prediction")
        
        # Extract week safely
        week = 0
        try:
            if hasattr(fixture, 'round') and fixture.round:
                import re
                week_match = re.search(r'\d+', str(fixture.round))
                if week_match:
                    week = int(week_match.group())
                else:
                    logger.warning(f"Could not extract week from round: {fixture.round}")
        except Exception as week_error:
            logger.warning(f"Week extraction failed: {week_error}")
            week = 0
        
        season = str(getattr(fixture, 'season', '2024'))
        
        # Get user's primary group for the prediction
        # For now, we'll use the first group the user is a member of
        user_groups = db.query(Group).join(
            group_members, Group.id == group_members.c.group_id
        ).filter(
            group_members.c.user_id == current_user.id
        ).all()
        
        group_id = user_groups[0].id if user_groups else None
        
        if not group_id:
            logger.warning(f"User {current_user.id} has no group membership for prediction")
            # For now, allow prediction without group (will be fixed by migration)
            group_id = None
        
        logger.info(f"Creating prediction: user={current_user.id}, fixture={match_id}, season={season}, week={week}, group={group_id}")
        
        # Use your actual repository function
        new_prediction = await create_prediction(
            db,
            current_user.id,
            match_id,
            home_score,
            away_score, 
            season,
            week,
            group_id=group_id  # Added: group_id parameter
        )
        
        if not new_prediction:
            logger.error("Failed to create prediction")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create prediction"
            )
        
        # Clear cache safely
        try:
            await cache.delete(f"user_predictions:{current_user.id}")
        except Exception as cache_error:
            logger.warning(f"Cache delete failed: {cache_error}")
        
        logger.info(f"Prediction created successfully: {new_prediction.id}")
        
        return DataResponse(
            data={
                "id": new_prediction.id,
                "match_id": new_prediction.fixture_id,
                "home_score": new_prediction.score1,
                "away_score": new_prediction.score2,
                "points": new_prediction.points,
                "prediction_status": new_prediction.prediction_status.value if hasattr(new_prediction.prediction_status, 'value') else str(new_prediction.prediction_status),
                "created": new_prediction.created.isoformat() if new_prediction.created else None,
                "user_id": new_prediction.user_id
            },
            message="Prediction created successfully"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Prediction submission error: {e}")
        raise

@router.get("/user", response_model=ListResponse)
async def get_user_predictions_endpoint(
    fixture_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    week: Optional[int] = Query(None),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get current user's predictions WITH fixture data
    """
    try:
        # Try to get from cache first
        cache_key = f"user_predictions:{current_user.id}"
        if not fixture_id and not status and not season and not week:
            cached_predictions = await cache.get(cache_key)
            if cached_predictions:
                return ListResponse(
                    data=cached_predictions,
                    total=len(cached_predictions)
                )
        
        # Convert status string to enum if provided
        status_enum = None
        if status:
            try:
                status_enum = PredictionStatus(status)
            except (ValueError, TypeError):
                # Invalid status, ignore it
                pass
        
        # Build query with JOIN to get fixture data
        from sqlalchemy.orm import joinedload
        
        query = db.query(UserPrediction).options(
            joinedload(UserPrediction.fixture)
        ).filter(UserPrediction.user_id == current_user.id)
        
        # Apply filters
        if fixture_id:
            query = query.filter(UserPrediction.fixture_id == fixture_id)
        
        if status_enum:
            query = query.filter(UserPrediction.prediction_status == status_enum)
        
        if season:
            query = query.filter(UserPrediction.season == season)
        
        if week:
            query = query.filter(UserPrediction.week == week)
        
        # Execute query and get results with fixtures loaded
        raw_predictions = query.order_by(UserPrediction.created.desc()).all()
        
        # Convert SQLAlchemy objects to dictionaries with fixture data
        predictions = []
        for pred in raw_predictions:
            # Access the fixture through the relationship
            fixture = pred.fixture
            
            prediction_dict = {
                "id": pred.id,
                "match_id": pred.fixture_id,
                "user_id": pred.user_id,
                
                # Include BOTH field naming conventions for compatibility
                "home_score": pred.score1,  # New naming (for API consistency)
                "away_score": pred.score2,  # New naming (for API consistency)
                "score1": pred.score1,      # Old naming (for frontend compatibility)
                "score2": pred.score2,      # Old naming (for frontend compatibility)
                
                "points": pred.points,
                "prediction_status": pred.prediction_status.value if hasattr(pred.prediction_status, 'value') else str(pred.prediction_status),
                "created": pred.created.isoformat() if pred.created else None,
                "submission_time": pred.submission_time.isoformat() if pred.submission_time else None,
                "season": pred.season,
                "week": pred.week,
                # Add fixture data
                "fixture": {
                    "fixture_id": fixture.fixture_id if fixture else None,
                    "home_team": fixture.home_team if fixture else "Home Team",
                    "away_team": fixture.away_team if fixture else "Away Team",
                    "home_team_logo": fixture.home_team_logo if fixture else None,
                    "away_team_logo": fixture.away_team_logo if fixture else None,
                    "date": fixture.date.isoformat() if fixture and fixture.date else None,
                    "league": fixture.league if fixture else "Unknown League",
                    "status": fixture.status.value if fixture and hasattr(fixture.status, 'value') else str(fixture.status) if fixture else "UNKNOWN",
                    "home_score": fixture.home_score if fixture else None,
                    "away_score": fixture.away_score if fixture else None,
                    "season": fixture.season if fixture else pred.season,
                    "round": fixture.round if fixture else None,
                    "venue": fixture.venue if fixture else None,
                    "venue_city": fixture.venue_city if fixture else None
                } if fixture else {
                    "fixture_id": pred.fixture_id,
                    "home_team": "Home Team",
                    "away_team": "Away Team",
                    "home_team_logo": None,
                    "away_team_logo": None,
                    "date": None,
                    "league": "Unknown League",
                    "status": "UNKNOWN",
                    "home_score": None,
                    "away_score": None,
                    "season": pred.season,
                    "round": None,
                    "venue": None,
                    "venue_city": None
                }
            }
            predictions.append(prediction_dict)
        
        # Cache only the complete list
        if not fixture_id and not status and not season and not week:
            await cache.set(cache_key, predictions, 300)  # Cache for 5 minutes
        
        return ListResponse(
            data=predictions,
            total=len(predictions)
        )
    except Exception as e:
        # Log the error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_user_predictions: {str(e)}")
        logger.exception("Full traceback:")
        
        return ListResponse(
            data=[],
            total=0
        )


# Add new endpoint to get available seasons for a group
@router.get("/seasons/{group_id}", response_model=ListResponse)
async def get_group_seasons(
    group_id: int = Path(...),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Get available seasons for a group based on its league
    """
    try:
        # Check if user is a member of the group
        is_member = await check_group_membership(db, group_id, current_user.id)
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group"
            )
        
        # Get group details
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Get available seasons for this league
        available_seasons = SeasonManager.get_available_seasons(group.league, years_back=5)
        
        return ListResponse(
            data=available_seasons,
            total=len(available_seasons)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting group seasons: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve group seasons"
        )

@router.post("/batch", response_model=DataResponse)
async def create_batch_predictions(
    predictions_data: Dict[str, Dict[str, int]],
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Create multiple predictions at once
    """
    results = []
    
    for fixture_id, scores in predictions_data.items():
        try:
            # Get the fixture
            fixture = await get_fixture_by_id(db, int(fixture_id))
            
            if not fixture or fixture.status != MatchStatus.NOT_STARTED:
                continue
            
            # Check if user already has a prediction
            existing_prediction = await get_user_prediction(
                db, 
                current_user.id, 
                int(fixture_id)
            )
            
            # Extract scores - handle both possible key formats
            if 'home' in scores and 'away' in scores:
                score1 = scores['home']
                score2 = scores['away']
            elif 'score1' in scores and 'score2' in scores:
                score1 = scores['score1']
                score2 = scores['score2']
            else:
                logger.warning(f"Invalid score format for fixture {fixture_id}: {scores}")
                continue
            
            if existing_prediction:
                # Update existing prediction
                prediction = await update_prediction(
                    db,
                    existing_prediction.id,
                    score1=score1,
                    score2=score2
                )
            else:
                # Create new prediction
                week = 0
                if hasattr(fixture, 'round') and fixture.round:
                    try:
                        import re
                        week_match = re.search(r'\d+', str(fixture.round))
                        if week_match:
                            week = int(week_match.group())
                    except Exception:
                        week = 0
                
                # Get user's primary group for the prediction
                user_groups = db.query(Group).join(
                    group_members, Group.id == group_members.c.group_id
                ).filter(
                    group_members.c.user_id == current_user.id
                ).all()
                
                group_id = user_groups[0].id if user_groups else None
                
                prediction = await create_prediction(
                    db,
                    current_user.id,
                    int(fixture_id),
                    score1,
                    score2,
                    fixture.season,
                    week,
                    group_id=group_id
                )
            
            if prediction:
                results.append({
                    "prediction_id": prediction.id,
                    "fixture_id": prediction.fixture_id,
                    "score1": prediction.score1,
                    "score2": prediction.score2,
                    "status": prediction.prediction_status.value if hasattr(prediction.prediction_status, 'value') else str(prediction.prediction_status)
                })
            
        except Exception as e:
            logger.error(f"Error processing batch prediction for fixture {fixture_id}: {e}")
            continue
    
    # Clear cache
    await cache.delete(f"user_predictions:{current_user.id}")
    
    return DataResponse(
        data=results,
        message="Predictions saved successfully"
    )

@router.get("/{prediction_id}", response_model=DataResponse)
async def get_prediction(
    prediction_id: int = Path(...),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Get prediction by ID
    """
    from sqlalchemy.orm import joinedload
    
    # Load prediction with fixture data
    prediction = db.query(UserPrediction).options(
        joinedload(UserPrediction.fixture)
    ).filter(UserPrediction.id == prediction_id).first()
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    # Check if prediction belongs to current user
    if prediction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Convert to dictionary with fixture data
    prediction_data = {
        "id": prediction.id,
        "match_id": prediction.fixture_id,
        "user_id": prediction.user_id,
        "home_score": prediction.score1,
        "away_score": prediction.score2,
        "score1": prediction.score1,
        "score2": prediction.score2,
        "points": prediction.points,
        "prediction_status": prediction.prediction_status.value if hasattr(prediction.prediction_status, 'value') else str(prediction.prediction_status),
        "created": prediction.created.isoformat() if prediction.created else None,
        "submission_time": prediction.submission_time.isoformat() if prediction.submission_time else None,
        "season": prediction.season,
        "week": prediction.week,
        "fixture": {
            "fixture_id": prediction.fixture.fixture_id if prediction.fixture else None,
            "home_team": prediction.fixture.home_team if prediction.fixture else "Home Team",
            "away_team": prediction.fixture.away_team if prediction.fixture else "Away Team",
            "home_team_logo": prediction.fixture.home_team_logo if prediction.fixture else None,
            "away_team_logo": prediction.fixture.away_team_logo if prediction.fixture else None,
            "date": prediction.fixture.date.isoformat() if prediction.fixture and prediction.fixture.date else None,
            "league": prediction.fixture.league if prediction.fixture else "Unknown League",
            "status": prediction.fixture.status.value if prediction.fixture and hasattr(prediction.fixture.status, 'value') else str(prediction.fixture.status) if prediction.fixture else "UNKNOWN",
            "home_score": prediction.fixture.home_score if prediction.fixture else None,
            "away_score": prediction.fixture.away_score if prediction.fixture else None,
            "season": prediction.fixture.season if prediction.fixture else prediction.season,
            "round": prediction.fixture.round if prediction.fixture else None,
            "venue": prediction.fixture.venue if prediction.fixture else None,
            "venue_city": prediction.fixture.venue_city if prediction.fixture else None
        } if prediction.fixture else {
            "fixture_id": prediction.fixture_id,
            "home_team": "Home Team",
            "away_team": "Away Team",
            "home_team_logo": None,
            "away_team_logo": None,
            "date": None,
            "league": "Unknown League",
            "status": "UNKNOWN",
            "home_score": None,
            "away_score": None,
            "season": prediction.season,
            "round": None,
            "venue": None,
            "venue_city": None
        }
    }
    
    return DataResponse(
        data=prediction_data,
        message="Prediction retrieved successfully"
    )

@router.post("/reset/{prediction_id}", response_model=DataResponse)
async def reset_prediction_endpoint(
    prediction_id: int = Path(...),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Reset a prediction to editable state
    """
    from sqlalchemy.orm import joinedload
    
    # Load prediction with fixture data
    prediction = db.query(UserPrediction).options(
        joinedload(UserPrediction.fixture)
    ).filter(UserPrediction.id == prediction_id).first()
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    # Check if prediction belongs to current user
    if prediction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check if match has already started or reached kickoff
    if not prediction.fixture:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fixture data not available"
        )
    
    if prediction.fixture.status != MatchStatus.NOT_STARTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reset prediction after match has started"
        )

    # Check if kickoff time has passed
    current_time = datetime.now(timezone.utc)
    if prediction.fixture.date:
        if prediction.fixture.date.tzinfo is None:
            fixture_utc = prediction.fixture.date.replace(tzinfo=timezone.utc)
        else:
            fixture_utc = prediction.fixture.date.astimezone(timezone.utc)
        
        if current_time > fixture_utc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reset prediction after match kickoff"
            )
    
    reset_pred = await reset_prediction(db, prediction_id)
    
    if not reset_pred:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reset prediction"
        )
    
    # Clear cache
    await cache.delete(f"user_predictions:{current_user.id}")
    
    return DataResponse(
        message="Prediction reset successfully"
    )

@router.get("/leaderboard/{group_id}", response_model=ListResponse)
async def get_group_leaderboard(
    group_id: int,
    season: Optional[str] = Query(None, description="Season filter"),
    week: Optional[int] = Query(None, description="Week filter"),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """Get leaderboard for a specific group"""
    try:
        # Check if user is member of the group
        if not await check_group_membership(db, group_id, current_user.id):
            raise HTTPException(status_code=403, detail="Not a member of this group")
        
        # Build cache key
        cache_key = f"leaderboard:{group_id}:{season}:{week}"
        
        # Try to get from cache first
        cached_data = await cache.get(cache_key)
        if cached_data:
            return ListResponse(data=cached_data, total=len(cached_data))
        
        # Build query
        logger.info(f"🔍 Building leaderboard query for group {group_id}, season: {season}, week: {week}")
        
        # Debug: Check if group_id column exists and has data
        try:
            from sqlalchemy import text
            group_check = db.execute(text("SELECT COUNT(*) as count FROM user_predictions WHERE group_id = :group_id"), {"group_id": group_id}).fetchone()
            logger.info(f"🔍 Found {group_check.count} predictions for group {group_id}")
        except Exception as check_error:
            logger.error(f"❌ Error checking group_id column: {check_error}")
            logger.error(f"❌ Check error type: {type(check_error).__name__}")
        
        query = db.query(
            User.username,
            User.id.label('user_id'),
            func.count(UserPrediction.id).label('total_predictions'),
            func.sum(UserPrediction.points).label('total_points'),
            func.avg(UserPrediction.points).label('average_points')
        ).join(
            UserPrediction, User.id == UserPrediction.user_id
        ).filter(
            UserPrediction.group_id == group_id
        )
        
        # Apply filters - FIXED: Handle week filter properly
        if season:
            logger.info(f"🔍 Adding season filter: {season}")
            query = query.join(Fixture, UserPrediction.fixture_id == Fixture.fixture_id)
            query = query.filter(Fixture.season == season)
        if week and week > 0:  # Only apply week filter if it's a valid week number
            logger.info(f"🔍 Adding week filter: {week}")
            query = query.join(Fixture, UserPrediction.fixture_id == Fixture.fixture_id)
            query = query.filter(Fixture.week == week)
        
        # Group and order - FIXED: Handle NULL values properly
        query = query.group_by(User.id, User.username).order_by(
            func.coalesce(func.sum(UserPrediction.points), 0).desc(),
            func.coalesce(func.avg(UserPrediction.points), 0).desc()
        )
        
        # Execute query
        logger.info("🔍 Executing leaderboard query...")
        try:
            # Debug: Log the actual SQL being generated
            sql_statement = query.statement.compile(compile_kwargs={'literal_binds': True})
            logger.info(f"🔍 Generated SQL: {sql_statement}")
            
            results = query.all()
            logger.info(f"✅ Query executed successfully, found {len(results)} results")
        except Exception as query_error:
            logger.error(f"❌ Query execution failed: {query_error}")
            logger.error(f"❌ Query error type: {type(query_error).__name__}")
            logger.error(f"❌ Query SQL: {sql_statement}")
            raise
        
        # Format results - ENHANCED: Add missing stats
        leaderboard = []
        for i, result in enumerate(results, 1):
            # Calculate additional stats
            total_points = result.total_points or 0
            total_predictions = result.total_predictions or 0
            average_points = float(result.average_points or 0)
            
            # Calculate perfect predictions (3 points) and accuracy
            perfect_predictions = 0
            accuracy_percentage = 0.0
            
            if total_predictions > 0:
                # Get perfect predictions count
                perfect_result = db.execute(text("""
                    SELECT COUNT(*) as count 
                    FROM user_predictions 
                    WHERE user_id = :user_id 
                    AND group_id = :group_id 
                    AND points = 3
                """), {"user_id": result.user_id, "group_id": group_id}).fetchone()
                
                perfect_predictions = perfect_result.count if perfect_result else 0
                
                # Calculate accuracy percentage (predictions with any points)
                accurate_result = db.execute(text("""
                    SELECT COUNT(*) as count 
                    FROM user_predictions 
                    WHERE user_id = :user_id 
                    AND group_id = :group_id 
                    AND points > 0
                """), {"user_id": result.user_id, "group_id": group_id}).fetchone()
                
                accurate_count = accurate_result.count if accurate_result else 0
                accuracy_percentage = (accurate_count / total_predictions) * 100 if total_predictions > 0 else 0.0
            
            leaderboard.append({
                "rank": i,
                "username": result.username,
                "user_id": result.user_id,
                "total_predictions": total_predictions,
                "total_points": total_points,
                "average_points": average_points,
                "perfect_predictions": perfect_predictions,
                "accuracy_percentage": round(accuracy_percentage, 1)
            })
        
        # Cache the result for 5 minutes
        await cache.set(cache_key, leaderboard, expiry=300)
        
        return ListResponse(data=leaderboard, total=len(leaderboard))
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"❌ Error fetching leaderboard: {str(e)}")
        logger.error(f"❌ Exception type: {type(e).__name__}")
        logger.error(f"❌ Full traceback: {error_details}")
        
        # Provide more specific error details to the client
        error_message = f"Leaderboard query failed: {type(e).__name__}"
        if str(e):
            error_message += f" - {str(e)}"
        
        raise HTTPException(status_code=500, detail=error_message)


@router.post("/migrate-group-id-field", response_model=DataResponse)
async def migrate_group_id_field(
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """Migrate UserPrediction table to add group_id field and populate data"""
    try:
        logger.info("🚀 Starting group_id field migration...")
        
        # No admin check required - following same pattern as migrate-points-field
        logger.info("✅ Starting migration (no admin check required)")
        
        # Test database connection
        try:
            from sqlalchemy import text
            test_query = db.execute(text("SELECT 1"))
            logger.info("✅ Database connection test passed")
        except Exception as db_error:
            logger.error(f"❌ Database connection failed: {db_error}")
            raise HTTPException(status_code=500, detail=f"Database connection failed: {str(db_error)}")
        
        # Step 1: Check if migration is already done
        try:
            # Check if column exists using raw SQL (safer than ORM when field doesn't exist)
            from sqlalchemy import text
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'user_predictions' 
                AND column_name = 'group_id'
            """)).fetchone()
            
            if result:
                logger.info("✅ group_id field already exists")
                
                # Check if data is populated using raw SQL
                null_count_result = db.execute(text("""
                    SELECT COUNT(*) as count 
                    FROM user_predictions 
                    WHERE group_id IS NULL
                """)).fetchone()
                
                null_count = null_count_result.count if null_count_result else 0
                
                if null_count == 0:
                    logger.info("✅ All predictions already have group_id populated")
                    return DataResponse(
                        message="Migration already completed - group_id field exists and is populated",
                        data={"migration_status": "already_completed", "records_processed": 0}
                    )
                else:
                    logger.info(f"⚠️ group_id field exists but {null_count} records need population")
            else:
                logger.info("🔧 group_id field doesn't exist, proceeding with migration")
        except Exception as e:
            logger.info(f"🔧 Error checking column existence, proceeding with migration: {e}")
        
        # Step 2: Add group_id column (if not exists)
        try:
            db.execute(text("ALTER TABLE user_predictions ADD COLUMN IF NOT EXISTS group_id INTEGER"))
            db.commit()
            logger.info("✅ Added group_id column to user_predictions table")
        except Exception as e:
            logger.warning(f"⚠️ Column addition failed (might already exist): {e}")
            db.rollback()
        
        # Step 3: Add foreign key constraint (if not exists)
        try:
            db.execute(text("""
                ALTER TABLE user_predictions 
                ADD CONSTRAINT IF NOT EXISTS fk_user_predictions_group 
                FOREIGN KEY (group_id) REFERENCES groups(id)
            """))
            db.commit()
            logger.info("✅ Added foreign key constraint for group_id")
        except Exception as e:
            logger.warning(f"⚠️ Foreign key constraint addition failed: {e}")
            db.rollback()
        
        # Step 4: Add index for performance (if not exists)
        try:
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_predictions_group ON user_predictions(group_id)"))
            db.commit()
            logger.info("✅ Added index for group_id field")
        except Exception as e:
            logger.warning(f"⚠️ Index creation failed: {e}")
            db.rollback()
        
        # Step 5: Populate existing data with group_id
        logger.info("🔄 Starting data population...")
        
        # Get all predictions without group_id using raw SQL
        predictions_result = db.execute(text("""
            SELECT id, user_id 
            FROM user_predictions 
            WHERE group_id IS NULL
        """)).fetchall()
        
        total_predictions = len(predictions_result)
        logger.info(f"📊 Found {total_predictions} predictions to update")
        
        updated_count = 0
        failed_count = 0
        errors = []
        
        for prediction_row in predictions_result:
            try:
                prediction_id = prediction_row.id
                user_id = prediction_row.user_id
                
                # Find user's group membership using raw SQL
                user_groups_result = db.execute(text("""
                    SELECT g.id 
                    FROM groups g
                    JOIN group_members gm ON g.id = gm.group_id
                    WHERE gm.user_id = :user_id
                    LIMIT 1
                """), {"user_id": user_id}).fetchall()
                
                if user_groups_result:
                    # Use the first approved group
                    group_id = user_groups_result[0].id
                    
                    # Update the prediction using raw SQL
                    db.execute(text("""
                        UPDATE user_predictions 
                        SET group_id = :group_id 
                        WHERE id = :prediction_id
                    """), {"group_id": group_id, "prediction_id": prediction_id})
                    
                    updated_count += 1
                    
                    if updated_count % 100 == 0:
                        logger.info(f"🔄 Updated {updated_count}/{total_predictions} predictions...")
                else:
                    # User has no group membership - skip this prediction
                    logger.warning(f"⚠️ User {user_id} has no group membership for prediction {prediction_id}")
                    failed_count += 1
                    errors.append(f"User {user_id} has no group membership")
                    
            except Exception as e:
                logger.error(f"❌ Error updating prediction {prediction_id}: {e}")
                failed_count += 1
                errors.append(f"Prediction {prediction_id}: {str(e)}")
        
        # Commit all changes
        db.commit()
        logger.info(f"✅ Successfully updated {updated_count} predictions")
        
        # Step 6: Final validation using raw SQL
        remaining_null_result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM user_predictions 
            WHERE group_id IS NULL
        """)).fetchone()
        remaining_null = remaining_null_result.count if remaining_null_result else 0
        logger.info(f"📊 Remaining predictions without group_id: {remaining_null}")
        
        # Step 7: Make group_id non-nullable (only if all data is populated)
        if remaining_null == 0:
            try:
                db.execute(text("ALTER TABLE user_predictions ALTER COLUMN group_id SET NOT NULL"))
                db.commit()
                logger.info("✅ Made group_id field non-nullable")
            except Exception as e:
                logger.warning(f"⚠️ Could not make group_id non-nullable: {e}")
                db.rollback()
        
        # Migration summary
        migration_result = {
            "migration_id": f"migrate_group_id_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            "steps_completed": 7,
            "records_processed": total_predictions,
            "records_updated": updated_count,
            "records_failed": failed_count,
            "remaining_null": remaining_null,
            "errors": errors[:10],  # Limit error list
            "migration_status": "completed" if remaining_null == 0 else "partial",
            "group_id_non_nullable": remaining_null == 0
        }
        
        logger.info(f"🎉 Migration completed: {migration_result}")
        
        return DataResponse(
            message="Group ID migration completed successfully",
            data=migration_result
        )
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"❌ Migration failed: {e}")
        logger.error(f"❌ Full traceback: {error_details}")
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Migration failed: {str(e)} - Type: {type(e).__name__}"
        )


@router.get("/test-migration-endpoint")
async def test_migration_endpoint():
    """Simple test endpoint to verify the router is working"""
    return {"message": "Migration endpoint is accessible", "status": "working"}


@router.post("/rollback-group-id-migration", response_model=DataResponse)
async def rollback_group_id_migration(
    migration_id: str = Query(..., description="Migration ID to rollback"),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """Rollback the group_id migration if something goes wrong"""
    try:
        # No admin check required - following same pattern as migrate-points-field
        
        logger.info(f"🔄 Starting rollback for migration: {migration_id}")
        
        # Step 1: Remove foreign key constraint
        try:
            from sqlalchemy import text
            db.execute(text("ALTER TABLE user_predictions DROP CONSTRAINT IF EXISTS fk_user_predictions_group"))
            db.commit()
            logger.info("✅ Removed foreign key constraint")
        except Exception as e:
            logger.warning(f"⚠️ Foreign key removal failed: {e}")
            db.rollback()
        
        # Step 2: Remove index
        try:
            db.execute(text("DROP INDEX IF EXISTS idx_user_predictions_group"))
            db.commit()
            logger.info("✅ Removed group_id index")
        except Exception as e:
            logger.warning(f"⚠️ Index removal failed: {e}")
            db.rollback()
        
        # Step 3: Remove group_id column
        try:
            db.execute(text("ALTER TABLE user_predictions DROP COLUMN IF EXISTS group_id"))
            db.commit()
            logger.info("✅ Removed group_id column")
        except Exception as e:
            logger.warning(f"⚠️ Column removal failed: {e}")
            db.rollback()
        
        # Step 4: Restore original unique constraint
        try:
            db.execute(text("ALTER TABLE user_predictions ADD CONSTRAINT IF NOT EXISTS _user_fixture_uc UNIQUE (user_id, fixture_id)"))
            db.commit()
            logger.info("✅ Restored original unique constraint")
        except Exception as e:
            logger.warning(f"⚠️ Constraint restoration failed: {e}")
            db.rollback()
        
        rollback_result = {
            "migration_id": migration_id,
            "rollback_status": "completed",
            "steps_completed": 4,
            "message": "Successfully rolled back group_id migration"
        }
        
        logger.info(f"🔄 Rollback completed: {rollback_result}")
        
        return DataResponse(
            message="Group ID migration rollback completed successfully",
            data=rollback_result
        )
        
    except Exception as e:
        logger.error(f"❌ Rollback failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Rollback failed: {str(e)}"
        )


@router.get("/group/{group_id}/week/{week}", response_model=DataResponse)
async def get_group_predictions_for_week(
    group_id: int = Path(...),
    week: int = Path(...),
    season: str = Query(...),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get all group member predictions for a specific week
    Only shows predictions for matches where kickoff has passed
    """
    try:
        # Try cache first
        cache_key = f"group_predictions:{group_id}:{week}:{season}"
        cached_predictions = await cache.get(cache_key)
        
        if cached_predictions:
            return DataResponse(
                message="Group predictions retrieved successfully (cached)",
                data=cached_predictions
            )
        
        visibility_service = PredictionVisibilityService(db)
        predictions = await visibility_service.get_group_predictions_for_week(
            group_id, week, season, current_user.id
        )
        
        # Cache for 10 minutes (predictions visibility can change frequently)
        await cache.set(cache_key, predictions, expiry=600)
        
        return DataResponse(
            message="Group predictions retrieved successfully",
            data=predictions
        )
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting group predictions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve group predictions"
        )


@router.get("/match/{fixture_id}/summary", response_model=DataResponse)
async def get_match_prediction_summary(
    fixture_id: int = Path(...),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get prediction summary for a specific match (if visible)
    """
    try:
        # Try cache first
        cache_key = f"match_summary:{fixture_id}"
        cached_summary = await cache.get(cache_key)
        
        if cached_summary:
            return DataResponse(
                message="Match prediction summary retrieved successfully (cached)",
                data=cached_summary
            )
        
        visibility_service = PredictionVisibilityService(db)
        summary = await visibility_service.get_match_prediction_summary(fixture_id, current_user.id)
        
        # Cache for 15 minutes
        await cache.set(cache_key, summary, expiry=900)
        
        return DataResponse(
            message="Match prediction summary retrieved successfully",
            data=summary
        )
        
    except Exception as e:
        logger.error(f"Error getting match summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve match prediction summary"
        )


@router.get("/group/{group_id}/visibility-schedule", response_model=DataResponse)
async def get_visibility_schedule(
    group_id: int = Path(...),
    week: int = Query(...),
    season: str = Query(...),
    current_user: UserSchema = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Get schedule of when group predictions will become visible
    """
    try:
        visibility_service = PredictionVisibilityService(db)
        schedule = await visibility_service.get_upcoming_visibility_schedule(
            group_id, week, season, current_user.id
        )
        
        return DataResponse(
            message="Visibility schedule retrieved successfully",
            data={
                'group_id': group_id,
                'week': week,
                'season': season,
                'schedule': schedule
            }
        )
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting visibility schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve visibility schedule"
        )