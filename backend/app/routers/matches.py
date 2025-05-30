# app/routers/matches.py
from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..core.security import get_current_active_user
from ..db.session import get_db
from ..services.cache_service import get_cache, RedisCache
from ..db.repositories import (
    get_fixtures,
    get_fixture_by_id,
    get_live_matches,
    get_prediction_deadlines
)
from ..schemas.prediction import Match, MatchDetail, MatchList, MatchStatus, MatchListResponse
from ..schemas.user import UserInDB

router = APIRouter()

@router.get("/live", response_model=MatchListResponse)
async def get_live_matches_endpoint(
    current_user: UserInDB = Depends(get_current_active_user),
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
    
    return {
        "status": "success",
        "matches": matches,
        "total": len(matches)
    }

@router.get("/fixtures", response_model=MatchListResponse)
async def get_fixtures_endpoint(
    league: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    team_id: Optional[int] = Query(None),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get fixtures with filters
    """
    # Import logging
    import logging
    logger = logging.getLogger(__name__)
    
    # Convert date strings to datetime if provided
    from_datetime = None
    to_datetime = None
    
    if from_date:
        try:
            # Handle different date formats
            if 'T' in from_date:
                # ISO format with time
                from_date = from_date.replace('Z', '+00:00') if 'Z' in from_date else from_date
                from_datetime = datetime.fromisoformat(from_date)
            else:
                # Date only format (YYYY-MM-DD)
                from_datetime = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception as e:
            logger.warning(f"Invalid from_date format: {from_date}. Error: {str(e)}")
            # Default to current day
            from_datetime = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    if to_date:
        try:
            # Handle different date formats
            if 'T' in to_date:
                # ISO format with time
                to_date = to_date.replace('Z', '+00:00') if 'Z' in to_date else to_date
                to_datetime = datetime.fromisoformat(to_date)
            else:
                # Date only format (YYYY-MM-DD)
                to_datetime = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except Exception as e:
            logger.warning(f"Invalid to_date format: {to_date}. Error: {str(e)}")
            # Default to 7 days from now
            to_datetime = (datetime.now(timezone.utc) + timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=0)
    
    # Convert status string to enum if provided
    status_enum = None
    if status:
        try:
            status_enum = MatchStatus(status)
        except (ValueError, TypeError):
            # Invalid status, ignore it
            pass
    
    # Build cache key from query parameters
    cache_params = f"{league}:{season}:{status}:{from_date}:{to_date}:{team_id}"
    cache_key = f"fixtures:{cache_params}"
    
    # Try to get from cache
    cached_fixtures = await cache.get(cache_key)
    
    if cached_fixtures:
        fixtures = cached_fixtures
    else:
        try:
            fixtures = await get_fixtures(
                db,
                league=league,
                season=season,
                status=status_enum,
                from_date=from_datetime,
                to_date=to_datetime,
                team_id=team_id
            )
            
            # Cache for 5 minutes
            await cache.set(cache_key, fixtures, 300)
        except Exception as e:
            logger.error(f"Error fetching fixtures: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch fixtures: {str(e)}"
            )
    
    return {
        "status": "success",
        "matches": fixtures,
        "total": len(fixtures)
    }

@router.get("/statuses", response_model=dict)
async def get_match_statuses(
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    Get all possible match statuses
    """
    statuses = [status.value for status in MatchStatus]
    
    return {
        "status": "success",
        "matches": statuses
    }

@router.get("/upcoming", response_model=dict)
async def get_upcoming_matches(
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get upcoming matches for user's leagues
    """
    # TODO: Implement actual league membership check
    # For now, return upcoming matches for the next 7 days
    
    # Try to get from cache
    cache_key = f"upcoming_matches:{current_user.id}"
    cached_matches = await cache.get(cache_key)
    
    if cached_matches:
        matches = cached_matches
    else:
        now = datetime.now(timezone.utc)
        next_week = now + timedelta(days=7)
        
        matches = await get_fixtures(
            db,
            status=MatchStatus.NOT_STARTED,
            from_date=now,
            to_date=next_week
        )
        
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
    
    return {
        "status": "success",
        "matches": formatted_matches
    }

@router.get("/{match_id}", response_model=dict)
async def get_match(
    match_id: int,
    current_user: UserInDB = Depends(get_current_active_user),
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
    deadlines = await get_prediction_deadlines()
    
    # Convert match to MatchDetail
    match_detail = MatchDetail.from_orm(match)
    match_detail.prediction_deadline = deadlines.get(str(match.fixture_id))
    
    return {
        "status": "success",
        "matches": match_detail
    }