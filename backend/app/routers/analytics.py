# backend/app/routers/analytics.py
"""
Analytics Router - Handles analytics, rivalries, and bonus endpoints
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session

from ..core.dependencies import get_current_active_user_dependency
from ..db.session_manager import get_db
from ..services.cache_service import get_cache, RedisCache
from ..services.analytics_service import AnalyticsService
from ..services.rivalry_service import RivalryService
from ..services.bonus_service import BonusPointsService
from ..db.repository import check_group_membership, get_group_by_id
from ..schemas import User, ListResponse, DataResponse

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/user/{user_id}/analytics", response_model=DataResponse)
async def get_user_analytics(
    user_id: int = Path(...),
    season: str = Query(...),
    week: int = Query(...),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get comprehensive user analytics (available from Week 5)
    """
    try:
        # Verify user can access these analytics (self or group member)
        if user_id != current_user.id:
            # TODO: Add group membership check if needed
            pass
        
        analytics_service = AnalyticsService(db, cache)
        analytics = await analytics_service.calculate_user_analytics(user_id, season, week)
        
        return DataResponse(
            message="User analytics retrieved successfully",
            data=analytics
        )
        
    except Exception as e:
        logger.error(f"Error getting user analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user analytics"
        )

@router.get("/group/{group_id}/heatmap", response_model=DataResponse)
async def get_group_heatmap(
    group_id: int = Path(...),
    week: int = Query(...),
    season: str = Query(...),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get group prediction heatmap for a specific week
    """
    try:
        # Verify user is a member of the group
        is_member = await check_group_membership(db, group_id, current_user.id)
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied - not a group member"
            )
        
        analytics_service = AnalyticsService(db, cache)
        heatmap = await analytics_service.generate_group_heatmap(group_id, week, season)
        
        return DataResponse(
            message="Group heatmap generated successfully",
            data=heatmap
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating group heatmap: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate group heatmap"
        )

@router.get("/group/{group_id}/rivalries", response_model=DataResponse)
async def get_group_rivalries(
    group_id: int = Path(...),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Get current rivalry assignments for a group
    """
    try:
        # Verify user is a member of the group
        is_member = await check_group_membership(db, group_id, current_user.id)
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied - not a group member"
            )
        
        rivalry_service = RivalryService(db)
        rivalries = await rivalry_service.get_group_rivalries(group_id)
        
        return DataResponse(
            message="Group rivalries retrieved successfully",
            data=rivalries
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting group rivalries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve group rivalries"
        )

@router.post("/group/{group_id}/rivalries/assign", response_model=DataResponse)
async def assign_group_rivalries(
    group_id: int = Path(...),
    week: int = Query(...),
    season: str = Query(...),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Assign rivalries for a group (admin only)
    """
    try:
        # Check if user is group admin
        group = await get_group_by_id(db, group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        if group.admin_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group admin can assign rivalries"
            )
        
        rivalry_service = RivalryService(db)
        rivalries = await rivalry_service.assign_rivalries(group_id, week, season, group.league)
        
        return DataResponse(
            message="Rivalries assigned successfully",
            data={
                'group_id': group_id,
                'week': week,
                'season': season,
                'rivalries': rivalries
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning rivalries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign rivalries"
        )

@router.post("/bonuses/calculate", response_model=DataResponse)
async def calculate_weekly_bonuses(
    week: int = Query(...),
    season: str = Query(...),
    league: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Calculate and apply weekly bonuses (admin operation)
    """
    try:
        # TODO: Add admin verification if needed
        # For now, any authenticated user can trigger this
        
        bonus_service = BonusPointsService(db)
        results = await bonus_service.check_and_apply_weekly_bonuses(week, season, league)
        
        return DataResponse(
            message="Weekly bonuses calculated successfully",
            data=results
        )
        
    except Exception as e:
        logger.error(f"Error calculating weekly bonuses: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate weekly bonuses"
        )

@router.get("/user/{user_id}/bonus-history", response_model=DataResponse)
async def get_user_bonus_history(
    user_id: int = Path(...),
    season: str = Query(...),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Get user's bonus week history
    """
    try:
        # Verify user can access this data (self only for now)
        if user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        bonus_service = BonusPointsService(db)
        bonus_history = await bonus_service.get_user_bonus_history(user_id, season)
        
        return DataResponse(
            message="Bonus history retrieved successfully",
            data={
                'user_id': user_id,
                'season': season,
                'bonus_weeks': bonus_history
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bonus history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve bonus history"
        )

@router.get("/group/{group_id}/bonus-summary", response_model=DataResponse)
async def get_group_bonus_summary(
    group_id: int = Path(...),
    season: str = Query(...),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Get bonus summary for a group
    """
    try:
        # Verify user is a member of the group
        is_member = await check_group_membership(db, group_id, current_user.id)
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied - not a group member"
            )
        
        bonus_service = BonusPointsService(db)
        bonus_summary = await bonus_service.get_group_bonus_summary(group_id, season)
        
        return DataResponse(
            message="Group bonus summary retrieved successfully",
            data=bonus_summary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting group bonus summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve group bonus summary"
        )

@router.post("/rivalries/check-outcomes", response_model=DataResponse)
async def check_rivalry_outcomes(
    group_id: int = Query(...),
    week: int = Query(...),
    season: str = Query(...),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db)
):
    """
    Check and process rivalry outcomes for a specific week (admin operation)
    """
    try:
        # Get group info
        group = await get_group_by_id(db, group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Check if user is group admin
        if group.admin_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group admin can check rivalry outcomes"
            )
        
        rivalry_service = RivalryService(db)
        outcomes = await rivalry_service.check_rivalry_outcomes(group_id, week, season, group.league)
        
        return DataResponse(
            message="Rivalry outcomes processed successfully",
            data=outcomes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking rivalry outcomes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process rivalry outcomes"
        )

@router.delete("/analytics/cache/user/{user_id}")
async def invalidate_user_analytics_cache(
    user_id: int = Path(...),
    season: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user_dependency()),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Invalidate cached analytics for a user (useful after prediction updates)
    """
    try:
        # Verify user can invalidate this cache (self or admin)
        if user_id != current_user.id:
            # TODO: Add admin check if needed
            pass
        
        analytics_service = AnalyticsService(db, cache)
        await analytics_service.invalidate_analytics_cache(user_id, season)
        
        return DataResponse(
            message="Analytics cache invalidated successfully",
            data={'user_id': user_id, 'season': season}
        )
        
    except Exception as e:
        logger.error(f"Error invalidating analytics cache: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invalidate analytics cache"
        )