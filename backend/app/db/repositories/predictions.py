from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models import (
    UserPrediction, PredictionStatus, MatchStatus,
    UserResults
)
from .matches import get_fixture_by_id

async def get_prediction_by_id(db: Session, prediction_id: int) -> Optional[UserPrediction]:
    """
    Get prediction by ID
    """
    return db.query(UserPrediction).filter(UserPrediction.id == prediction_id).first()

async def get_user_prediction(
    db: Session, 
    user_id: int, 
    fixture_id: int
) -> Optional[UserPrediction]:
    """
    Get user's prediction for a fixture
    """
    return db.query(UserPrediction).filter(
        UserPrediction.user_id == user_id,
        UserPrediction.fixture_id == fixture_id
    ).first()

async def get_user_predictions(
    db: Session, 
    user_id: int,
    fixture_id: Optional[int] = None,
    status: Optional[PredictionStatus] = None,
    season: Optional[str] = None,
    week: Optional[int] = None
) -> List[UserPrediction]:
    """
    Get user predictions with filters
    """
    query = db.query(UserPrediction).filter(UserPrediction.user_id == user_id)
    
    if fixture_id:
        query = query.filter(UserPrediction.fixture_id == fixture_id)
    
    if status:
        query = query.filter(UserPrediction.prediction_status == status)
    
    if season:
        query = query.filter(UserPrediction.season == season)
    
    if week:
        query = query.filter(UserPrediction.week == week)
        
    return query.order_by(UserPrediction.created.desc()).all()

async def create_prediction(
    db: Session, 
    user_id: int, 
    fixture_id: int, 
    score1: int,
    score2: int,
    season: str,
    week: int
) -> UserPrediction:
    """
    Create a new prediction
    """
    prediction = UserPrediction(
        user_id=user_id,
        fixture_id=fixture_id,
        score1=score1,
        score2=score2,
        season=season,
        week=week,
        prediction_status=PredictionStatus.SUBMITTED,
        submission_time=datetime.now(timezone.utc)
    )
    
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction

async def update_prediction(
    db: Session, 
    prediction_id: int, 
    score1: Optional[int] = None,
    score2: Optional[int] = None
) -> Optional[UserPrediction]:
    """
    Update an existing prediction
    """
    prediction = await get_prediction_by_id(db, prediction_id)
    
    if not prediction:
        return None
        
    if prediction.prediction_status != PredictionStatus.EDITABLE and \
       prediction.prediction_status != PredictionStatus.SUBMITTED:
        return None
        
    if score1 is not None:
        prediction.score1 = score1
        
    if score2 is not None:
        prediction.score2 = score2
        
    prediction.prediction_status = PredictionStatus.SUBMITTED
    prediction.submission_time = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(prediction)
    return prediction

async def reset_prediction(db: Session, prediction_id: int) -> Optional[UserPrediction]:
    """
    Reset a prediction to editable state
    """
    prediction = await get_prediction_by_id(db, prediction_id)
    
    if not prediction:
        return None
        
    if prediction.prediction_status != PredictionStatus.SUBMITTED:
        return None
        
    prediction.prediction_status = PredictionStatus.EDITABLE
    prediction.last_modified = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(prediction)
    return prediction

async def process_match_predictions(db: Session, fixture_id: int) -> int:
    """
    Process all predictions for a match and update points
    """
    fixture = await get_fixture_by_id(db, fixture_id)
    
    if not fixture:
        return 0
        
    if fixture.status != MatchStatus.FINISHED and \
       fixture.status != MatchStatus.FINISHED_AET and \
       fixture.status != MatchStatus.FINISHED_PEN:
        return 0
        
    # Get all predictions for this match that are locked (not processed yet)
    predictions = db.query(UserPrediction).filter(
        UserPrediction.fixture_id == fixture_id,
        UserPrediction.prediction_status == PredictionStatus.LOCKED
    ).all()
    
    count = 0
    for prediction in predictions:
        # Calculate points
        points = calculate_points(
            prediction.score1,
            prediction.score2,
            fixture.home_score,
            fixture.away_score
        )
        
        # Update prediction
        prediction.points = points
        prediction.prediction_status = PredictionStatus.PROCESSED
        prediction.processed_at = datetime.now(timezone.utc)
        
        # Update user results
        user_result = db.query(UserResults).filter(
            UserResults.user_id == prediction.user_id,
            UserResults.season == prediction.season
        ).first()
        
        if not user_result:
            user_result = UserResults(
                user_id=prediction.user_id,
                points=0,
                season=prediction.season,
                week=prediction.week
            )
            db.add(user_result)
            
        user_result.points += points
        count += 1
        
    db.commit()
    return count

async def lock_predictions_for_match(db: Session, fixture_id: int) -> int:
    """
    Lock all predictions for a match (transition from SUBMITTED to LOCKED)
    """
    predictions = db.query(UserPrediction).filter(
        UserPrediction.fixture_id == fixture_id,
        UserPrediction.prediction_status == PredictionStatus.SUBMITTED
    ).all()
    
    count = 0
    for prediction in predictions:
        prediction.prediction_status = PredictionStatus.LOCKED
        count += 1
        
    db.commit()
    return count

def calculate_points(
    pred_home: int, 
    pred_away: int, 
    actual_home: int, 
    actual_away: int
) -> int:
    """
    Calculate points for a prediction
    
    3 points - Exact score
    1 point - Correct result (win/draw/loss)
    0 points - Incorrect
    """
    # Exact score match
    if pred_home == actual_home and pred_away == actual_away:
        return 3
        
    # Correct result
    pred_result = pred_home - pred_away
    actual_result = actual_home - actual_away
    
    if (pred_result > 0 and actual_result > 0) or \
       (pred_result < 0 and actual_result < 0) or \
       (pred_result == 0 and actual_result == 0):
        return 1
        
    return 0 