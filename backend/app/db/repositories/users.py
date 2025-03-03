# app/db/repositories/users.py
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

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
    # Get total points
    total_points = db.query(
        func.sum(UserPrediction.points)
    ).filter(
        UserPrediction.user_id == user_id
    ).scalar() or 0

    # Get prediction stats
    prediction_stats = db.query(
        func.count(UserPrediction.id).label('total_predictions'),
        func.sum(
            func.case(
                [(UserPrediction.points == 3, 1)],
                else_=0
            )
        ).label('perfect_predictions'),
        func.avg(UserPrediction.points).label('average_points')
    ).filter(
        UserPrediction.user_id == user_id,
        UserPrediction.prediction_status == PredictionStatus.PROCESSED
    ).first()

    return {
        "total_points": int(total_points),
        "total_predictions": int(prediction_stats.total_predictions or 0),
        "perfect_predictions": int(prediction_stats.perfect_predictions or 0),
        "average_points": float(prediction_stats.average_points or 0)
    }