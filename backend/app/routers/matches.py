# app/routers/matches.py
from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..core.security import get_current_active_user
from ..db.database import get_db
from ..services.cache_service import get_cache, RedisCache
from ..db import (
    get_fixtures,
    get_fixture_by_id,
    get_live_matches,
    get_prediction_deadlines,
    get_group_tracked_teams
)
from ..schemas import (
    User,
    MatchStatus,
    ListResponse,
    DataResponse
)
# Import the SQLAlchemy models, not schemas
from ..db.models import Fixture, Team

router = APIRouter()

@router.get("/live", response_model=ListResponse)
async def get_live_matches_endpoint(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get all currently live matches
    """
    # Try to get from cache first (short TTL for live matches)
    cache_key = "live_matches"
    cached_matches = await cache.get(cache_key)
    
    if cached_matches:
        matches = cached_matches
    else:
        matches = await get_live_matches(db)
        # Cache for 1 minute
        await cache.set(cache_key, matches, 60)
    
    return ListResponse(
        data=matches,
        total=len(matches)
    )

# Remove debug endpoint for production security
# @router.get("/debug-user-access", response_model=DataResponse)
# async def debug_user_access(
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db)
# ):
#     """Debug endpoint to check user's group access and fixture availability"""
#     # ... debug code removed for production

@router.get("/fixtures", response_model=DataResponse)
async def get_fixtures(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    league: Optional[str] = Query(None, description="Filter by league"),
    season: Optional[str] = Query(None, description="Filter by season"),
    from_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=100, description="Number of fixtures to return"),
    offset: int = Query(0, ge=0, description="Number of fixtures to skip")
):
    """Get fixtures with optional filtering"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Get user's groups and their leagues
        from ..db.repository import get_user_groups as get_user_groups_from_db
        
        user_groups = await get_user_groups_from_db(db, current_user.id)
        
        if not user_groups:
            logger.warning(f"User {current_user.id} belongs to no groups, returning empty fixtures")
            return DataResponse(data=[], message="No groups found for user")
        
        # Collect all leagues from user's groups
        user_leagues = [group.league for group in user_groups if group.league]
        
        # Build query
        query = db.query(Fixture).filter(Fixture.league.in_(user_leagues))
        
        # Apply filters
        if league:
            query = query.filter(Fixture.league == league)
        if season:
            query = query.filter(Fixture.season == season)
        if from_date:
            query = query.filter(Fixture.date >= from_date)
        if to_date:
            query = query.filter(Fixture.date <= to_date)
        
        # Order by date
        query = query.order_by(Fixture.date.asc())
        
        # Apply pagination
        total = query.count()
        fixtures = query.offset(offset).limit(limit).all()
        
        return DataResponse(
            data=fixtures,
            total=total,
            limit=limit,
            offset=offset
        )
        
    except Exception as e:
        logger.error(f"Error fetching fixtures: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch fixtures")

@router.get("/statuses", response_model=DataResponse)
async def get_match_statuses(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all possible match statuses
    """
    statuses = [status.value for status in MatchStatus]
    
    return DataResponse(
        data=statuses,
        message="Match statuses retrieved successfully"
    )

@router.get("/deadlines", response_model=DataResponse)
async def get_prediction_deadlines_endpoint(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get prediction deadlines for upcoming fixtures
    """
    # Try cache first
    cache_key = "prediction_deadlines"
    cached_deadlines = await cache.get(cache_key)
    
    if cached_deadlines:
        deadlines = cached_deadlines
    else:
        deadlines = await get_prediction_deadlines(db)
        # Cache for 10 minutes
        await cache.set(cache_key, deadlines, 600)
    
    return DataResponse(
        data=deadlines,
        message="Prediction deadlines retrieved successfully"
    )

@router.get("/upcoming", response_model=DataResponse)
async def get_upcoming_matches(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get upcoming matches for user's leagues
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Try to get from cache
        cache_key = f"upcoming_matches:{current_user.id}"
        cached_matches = await cache.get(cache_key)
        
        if cached_matches:
            matches = cached_matches
        else:
            now = datetime.now(timezone.utc)
            next_week = now + timedelta(days=7)
            
            logger.info(f"Fetching upcoming matches from {now} to {next_week}")
            
            matches = await get_fixtures(
                db,
                status=MatchStatus.NOT_STARTED,
                from_date=now,
                to_date=next_week
            )
            
            logger.info(f"Found {len(matches)} upcoming matches")
            
            # Cache for 10 minutes
            await cache.set(cache_key, matches, 600)
        
        formatted_matches = []
        for m in matches:
            formatted_matches.append({
                "id": m.fixture_id,
                "homeTeam": {
                    "name": m.home_team,
                    "logo": m.home_team_logo
                },
                "awayTeam": {
                    "name": m.away_team,
                    "logo": m.away_team_logo
                },
                "kickoff": m.date.isoformat()
            })
        
        return DataResponse(
            data=formatted_matches
        )
    except Exception as e:
        logger.error(f"Error fetching upcoming matches: {str(e)}")
        logger.exception("Full traceback:")
        
        return DataResponse(
            data=[],
            message="No upcoming matches available"
        )

@router.get("/{match_id}", response_model=DataResponse)
async def get_match(
    match_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get match details by ID
    """
    # Try to get from cache
    cache_key = f"match:{match_id}"
    cached_match = await cache.get(cache_key)
    
    if cached_match:
        match = cached_match
    else:
        match = await get_fixture_by_id(db, match_id)
        
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Match not found"
            )
            
        # Cache completed matches longer than upcoming ones
        if match.status in [MatchStatus.FINISHED, MatchStatus.FINISHED_AET, MatchStatus.FINISHED_PEN]:
            # Cache for 24 hours
            await cache.set(cache_key, match, 86400)
        else:
            # Cache for 5 minutes
            await cache.set(cache_key, match, 300)
    
    # Get prediction deadlines
    deadlines = await get_prediction_deadlines(db)
    
    # Add prediction deadline to match data
    match_data = match.dict() if hasattr(match, 'dict') else {
        "fixture_id": match.fixture_id,
        "home_team": match.home_team,
        "away_team": match.away_team,
        "date": match.date.isoformat() if match.date else None,
        "status": match.status.value if match.status else None,
        "league": match.league,
        "season": match.season
    }
    match_data["prediction_deadline"] = deadlines.get(str(match.fixture_id))
    
    return DataResponse(
        data=match_data
    )