# app/routers/users.py
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..core.security import get_current_active_user, get_password_hash
from ..db.database import get_db
from ..db import (
    get_user_by_id, 
    update_user,
    get_user_stats,
    get_user_predictions
)
from ..services.cache_service import get_cache, RedisCache
from ..schemas import (
    User, 
    UserCreate, 
    UserStats, 
    BaseResponse, 
    DataResponse, 
    ListResponse,
    PredictionStatus
)

router = APIRouter()

@router.get("/profile", response_model=DataResponse)
async def get_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get current user profile and stats
    """
    try:
        # Try to get stats from cache first
        cache_key = f"user_stats:{current_user.id}"
        cached_stats = await cache.get(cache_key)
        
        if not cached_stats:
            stats = await get_user_stats(db, current_user.id)
            await cache.set(cache_key, stats, 1800)
        else:
            stats = cached_stats
        
        if not stats:
            stats = {
                "total_points": 0,
                "total_predictions": 0,
                "perfect_predictions": 0,
                "average_points": 0.0
            }
        
        return DataResponse(
            data={
                "user": {
                    "id": current_user.id,
                    "username": current_user.username,
                    "email": current_user.email,
                    "is_active": current_user.is_active,
                    "created_at": current_user.created_at
                },
                "stats": UserStats(
                    total_points=stats["total_points"],
                    total_predictions=stats["total_predictions"],
                    perfect_predictions=stats["perfect_predictions"],
                    average_points=stats["average_points"]
                )
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_profile: {str(e)}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch profile: {str(e)}"
        )

@router.put("/profile", response_model=BaseResponse)
async def update_profile(
    profile_update: UserCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Update current user profile
    """
    user_data = profile_update.dict(exclude_unset=True)
    
    # If password is being updated, hash it
    if "password" in user_data:
        user_data["hashed_password"] = get_password_hash(user_data.pop("password"))
    
    updated_user = await update_user(db, current_user.id, **user_data)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Clear user cache
    await cache.delete(f"user_stats:{current_user.id}")
    
    return BaseResponse(
        status="success",
        message="Profile updated successfully"
    )

@router.get("/stats", response_model=DataResponse)
async def get_user_statistics(
    user_id: int = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get user statistics
    """
    target_id = user_id or current_user.id
    
    # Only allow viewing other users' stats if they are in the same group
    if user_id and user_id != current_user.id:
        # TODO: Implement group membership check
        pass
    
    # Try to get stats from cache
    cache_key = f"user_stats:{target_id}"
    cached_stats = await cache.get(cache_key)
    
    if not cached_stats:
        # Get stats from database
        stats = await get_user_stats(db, target_id)
        # Cache for 30 minutes
        await cache.set(cache_key, stats, 1800)
    else:
        stats = cached_stats
    
    target_user = await get_user_by_id(db, target_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return DataResponse(
        data={
            "username": target_user.username,
            "stats": stats
        }
    )

@router.get("/predictions", response_model=ListResponse)
async def get_prediction_history(
    user_id: int = Query(None),
    season: str = Query(None),
    week: int = Query(None),
    status: PredictionStatus = Query(None),
    fixture_id: int = Query(None),
    group_id: int = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user prediction history with optional filters
    """
    target_id = user_id or current_user.id
    
    # Only allow viewing other users' predictions if they are in the same group
    if user_id and user_id != current_user.id and group_id:
        # TODO: Implement group membership check
        pass
    
    predictions = await get_user_predictions(
        db,
        target_id,
        fixture_id=fixture_id,
        status=status,
        season=season,
        week=week
    )
    
    return ListResponse(
        data=predictions,
        total=len(predictions)
    )