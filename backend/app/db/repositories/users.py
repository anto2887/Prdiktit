# app/db/repositories/users.py
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case, literal

from ..models import User, UserPrediction, PredictionStatus

async def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """
    Get user by ID
    """
    return db.query(User).filter(User.id == user_id).first()

async def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    Get user by username
    """
    return db.query(User).filter(User.username == username).first()

async def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Get user by email
    """
    return db.query(User).filter(User.email == email).first()

async def create_user(db: Session, **user_data) -> User:
    """
    Create a new user
    """
    db_user = User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

async def update_user(db: Session, user_id: int, **user_data) -> Optional[User]:
    """
    Update user
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        return None
        
    for key, value in user_data.items():
        setattr(user, key, value)
        
    db.commit()
    db.refresh(user)
    return user

async def delete_user(db: Session, user_id: int) -> bool:
    """
    Delete user
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        return False
        
    db.delete(user)
    db.commit()
    return True

async def get_user_stats(db: Session, user_id: int) -> dict:
    """
    Get user statistics
    """
    try:
        # Get total points - simple sum
        total_points_result = db.query(
            func.sum(UserPrediction.points)
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).scalar()
        
        total_points = int(total_points_result or 0)

        # Get basic prediction stats using separate queries for better compatibility
        total_predictions_result = db.query(
            func.count(UserPrediction.id)
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).scalar()
        
        total_predictions = int(total_predictions_result or 0)
        
        # Get perfect predictions (3 points) count
        perfect_predictions_result = db.query(
            func.count(UserPrediction.id)
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED,
            UserPrediction.points == 3
        ).scalar()
        
        perfect_predictions = int(perfect_predictions_result or 0)
        
        # Calculate average points
        average_points = 0.0
        if total_predictions > 0:
            average_points = total_points / total_predictions

        return {
            "total_points": total_points,
            "total_predictions": total_predictions,
            "perfect_predictions": perfect_predictions,
            "average_points": round(average_points, 2)
        }
        
    except Exception as e:
        # Log the error and return default values
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching user stats for user {user_id}: {str(e)}")
        
        # Return default values instead of raising the exception
        return {
            "total_points": 0,
            "total_predictions": 0,
            "perfect_predictions": 0,
            "average_points": 0.0
        }