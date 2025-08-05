# app/routers/predictions.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session

# Set up logger
logger = logging.getLogger(__name__)

from ..core.security import get_current_active_user
from ..db.database import get_db
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
from ..db.models import UserPrediction, Group
from ..schemas import (
    Prediction, PredictionCreate, PredictionStatus, 
    MatchStatus, ListResponse, DataResponse, User,
    PredictionUpdate, BaseResponse
)
from ..utils.season_manager import SeasonManager
from ..services.prediction_visibility import PredictionVisibilityService

router = APIRouter()

@router.post("", response_model=DataResponse)
async def submit_prediction(
    prediction_data: PredictionCreate,
    current_user: User = Depends(get_current_active_user),
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
        
        logger.info(f"Creating prediction: user={current_user.id}, fixture={match_id}, season={season}, week={week}")
        
        # Use your actual repository function
        new_prediction = await create_prediction(
            db,
            current_user.id,
            match_id,
            home_score,
            away_score, 
            season,
            week
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
        return ListResponse(data=[], total=0)

@router.post("/batch", response_model=DataResponse)
async def create_batch_predictions(
    predictions_data: Dict[str, Dict[str, int]],
    current_user: User = Depends(get_current_active_user),
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
            
            # Extract scores
            score1 = scores.home
            score2 = scores.away
            
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
                week = int(fixture.round.split(' ')[-1]) if 'round' in fixture.round.lower() else 0
                
                prediction = await create_prediction(
                    db,
                    current_user.id,
                    int(fixture_id),
                    score1,
                    score2,
                    fixture.season,
                    week
                )
            
            results.append({
                "prediction_id": prediction.id,
                "fixture_id": prediction.fixture_id,
                "score1": prediction.score1,
                "score2": prediction.score2,
                "status": prediction.prediction_status.value
            })
            
        except Exception as e:
            # Skip any fixtures with errors
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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get prediction by ID
    """
    prediction = await get_prediction_by_id(db, prediction_id)
    
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
    
    return DataResponse(
        data=prediction,
        message="Prediction retrieved successfully"
    )

@router.post("/reset/{prediction_id}", response_model=DataResponse)
async def reset_prediction_endpoint(
    prediction_id: int = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Reset a prediction to editable state
    """
    prediction = await get_prediction_by_id(db, prediction_id)
    
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
    group_id: int = Path(...),
    season: Optional[str] = Query(None),
    week: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group leaderboard showing member rankings by total points
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"🔍 DEBUGGING: group_id={group_id}, season={season}, week={week}")
        
        # Check if user is a member of the group
        is_member = await check_group_membership(db, group_id, current_user.id)
        logger.info(f"🔍 User {current_user.id} is member of group {group_id}: {is_member}")
        
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group"
            )
        
        # Get group details to determine league
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        logger.info(f"🔍 Group found: {group.name}, league: {group.league}")
        
        # Normalize season format for database query
        if season:
            normalized_season = SeasonManager.normalize_season_for_query(group.league, season)
        else:
            normalized_season = SeasonManager.get_current_season(group.league)
        
        logger.info(f"🔍 Normalized season: {normalized_season}")
        logger.info(f"🔍 Will filter predictions to only include fixtures from league: {group.league}")
        
        # Skip cache for debugging
        logger.info("🔍 Skipping cache for debugging")
        
        # First, let's check what group members exist
        from sqlalchemy import func, text, case
        from ..db.models import group_members, User as UserModel, UserPrediction
        
        # Check group members first
        members_query = db.query(
            UserModel.id.label('user_id'),
            UserModel.username
        ).select_from(
            UserModel
        ).join(
            group_members,
            UserModel.id == group_members.c.user_id
        ).filter(
            group_members.c.group_id == group_id
        )
        
        all_members = members_query.all()
        logger.info(f"🔍 Found {len(all_members)} group members: {[m.username for m in all_members]}")
        
        # Check what seasons exist in predictions
        seasons_query = db.query(UserPrediction.season).distinct().all()
        existing_seasons = [s[0] for s in seasons_query if s[0]]
        logger.info(f"🔍 Existing seasons in database: {existing_seasons}")
        
        # Check predictions for group members specifically
        member_ids = [m.user_id for m in all_members]
        if member_ids:
            predictions_query = db.query(
                UserPrediction.user_id,
                UserPrediction.season,
                func.count(UserPrediction.id).label('count')
            ).filter(
                UserPrediction.user_id.in_(member_ids)
            ).group_by(
                UserPrediction.user_id,
                UserPrediction.season
            ).all()
            
            logger.info(f"🔍 Predictions by group members:")
            for pred in predictions_query:
                username = next((m.username for m in all_members if m.user_id == pred.user_id), f"User{pred.user_id}")
                logger.info(f"   {username} (ID:{pred.user_id}): {pred.count} predictions in season {pred.season}")
        
        # Now build the main query but with better debugging
        from ..db.models import Fixture
        
        query = db.query(
            UserModel.id.label('user_id'),
            UserModel.username,
            func.coalesce(func.sum(UserPrediction.points), 0).label('total_points'),
            func.count(UserPrediction.id).label('total_predictions'),
            func.sum(case((UserPrediction.points == 3, 1), else_=0)).label('perfect_scores'),
            func.sum(case((UserPrediction.points == 1, 1), else_=0)).label('correct_results'),
            func.sum(case((UserPrediction.points == 0, 1), else_=0)).label('incorrect_predictions')
        ).select_from(
            UserModel
        ).join(
            group_members,
            UserModel.id == group_members.c.user_id
        ).outerjoin(
            UserPrediction,
            (UserModel.id == UserPrediction.user_id) & (UserPrediction.season == normalized_season)
        ).outerjoin(
            Fixture,
            UserPrediction.fixture_id == Fixture.fixture_id
        ).filter(
            group_members.c.group_id == group_id
        ).filter(
            (Fixture.league == group.league) | (UserPrediction.id.is_(None))
        )
        
        # Apply week filter if provided
        if week:
            query = query.filter(UserPrediction.week == week)
            logger.info(f"🔍 Applied week filter: {week}")
        
        # Group by user and order by total points descending
        query = query.group_by(
            UserModel.id, 
            UserModel.username
        ).order_by(
            text('total_points DESC'),
            text('total_predictions DESC'),
            UserModel.username
        )
        
        # Log the SQL query for debugging
        logger.info(f"🔍 SQL Query: {str(query)}")
        
        # Execute query
        results = query.all()
        
        logger.info(f"🔍 Query returned {len(results)} results")
        for result in results:
            logger.info(f"   {result.username}: {result.total_points} points, {result.total_predictions} predictions")
        
        # Build leaderboard data
        leaderboard = []
        for rank, result in enumerate(results, 1):
            # Calculate accuracy
            total_preds = result.total_predictions or 0
            accuracy = 0
            if total_preds > 0:
                correct_preds = (result.perfect_scores or 0) + (result.correct_results or 0)
                accuracy = round((correct_preds / total_preds) * 100, 1)
            
            # Calculate average points per prediction
            avg_points = 0
            if total_preds > 0:
                avg_points = round((result.total_points or 0) / total_preds, 2)
            
            leaderboard_entry = {
                "rank": rank,
                "user_id": result.user_id,
                "username": result.username,
                "total_points": result.total_points or 0,
                "total_predictions": total_preds,
                "perfect_scores": result.perfect_scores or 0,
                "correct_results": result.correct_results or 0,
                "incorrect_predictions": result.incorrect_predictions or 0,
                "accuracy_percentage": accuracy,
                "average_points": avg_points
            }
            leaderboard.append(leaderboard_entry)
            logger.info(f"🔍 Added to leaderboard: {leaderboard_entry}")
        
        # If no users have predictions, include all group members with zero stats
        if not leaderboard:
            logger.info("🔍 No predictions found, including all group members with zero stats")
            for rank, member in enumerate(all_members, 1):
                zero_entry = {
                    "rank": rank,
                    "user_id": member.user_id,
                    "username": member.username,
                    "total_points": 0,
                    "total_predictions": 0,
                    "perfect_scores": 0,
                    "correct_results": 0,
                    "incorrect_predictions": 0,
                    "accuracy_percentage": 0,
                    "average_points": 0
                }
                leaderboard.append(zero_entry)
                logger.info(f"🔍 Added zero-stats member: {zero_entry}")
        
        logger.info(f"🔍 Final leaderboard has {len(leaderboard)} entries")
        
        return ListResponse(
            data=leaderboard,
            total=len(leaderboard)
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"🔍 ERROR in leaderboard: {e}")
        logger.exception("🔍 Full traceback:")
        
        # Return empty leaderboard on error
        return ListResponse(
            data=[],
            total=0
        )


@router.get("/group/{group_id}/week/{week}", response_model=DataResponse)
async def get_group_predictions_for_week(
    group_id: int = Path(...),
    week: int = Path(...),
    season: str = Query(...),
    current_user: User = Depends(get_current_active_user),
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
        await cache.set(cache_key, predictions, ttl=600)
        
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
    current_user: User = Depends(get_current_active_user),
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
        await cache.set(cache_key, summary, ttl=900)
        
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
    current_user: User = Depends(get_current_active_user),
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