# app/routers/matches.py
from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..core.security import get_current_active_user
from ..db.database import get_db
from ..services.cache_service import get_cache, RedisCache
from ..db import (
    get_fixtures,
    get_fixture_by_id,
    get_live_matches,
    get_prediction_deadlines
)
from ..schemas import (
    User,
    Fixture,
    MatchStatus,
    ListResponse,
    DataResponse
)

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

@router.get("/fixtures", response_model=ListResponse)
async def get_fixtures_endpoint(
    league: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_: Optional[str] = Query(None, alias="from"),    # Accept 'from' parameter
    to: Optional[str] = Query(None),                      # Accept 'to' parameter  
    team_id: Optional[int] = Query(None),
    limit: Optional[int] = Query(100),                    # Add limit parameter
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get fixtures with filters
    """
    # Import logging
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Fixtures endpoint called with: league={league}, season={season}, status={status}, from_={from_}, to={to}, team_id={team_id}")
    
    # Convert date strings to datetime if provided
    from_datetime = None
    to_datetime = None
    
    if from_:
        try:
            # Handle different date formats
            if 'T' in from_:
                # ISO format with time
                from_ = from_.replace('Z', '+00:00') if 'Z' in from_ else from_
                from_datetime = datetime.fromisoformat(from_)
            else:
                # Date only format (YYYY-MM-DD)
                from_datetime = datetime.strptime(from_, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception as e:
            logger.warning(f"Invalid from_ format: {from_}. Error: {str(e)}")
            # Default to current day
            from_datetime = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    if to:
        try:
            # Handle different date formats
            if 'T' in to:
                # ISO format with time
                to = to.replace('Z', '+00:00') if 'Z' in to else to
                to_datetime = datetime.fromisoformat(to)
            else:
                # Date only format (YYYY-MM-DD)
                to_datetime = datetime.strptime(to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except Exception as e:
            logger.warning(f"Invalid to format: {to}. Error: {str(e)}")
            # Default to 7 days from now
            to_datetime = (datetime.now(timezone.utc) + timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=0)
    
    # Convert status string to enum if provided
    status_enum = None
    if status:
        try:
            status_enum = MatchStatus(status)
        except (ValueError, TypeError):
            # Invalid status, ignore it
            logger.warning(f"Invalid status provided: {status}")
            pass
    
    # Build cache key from query parameters
    cache_params = f"{league}:{season}:{status}:{from_}:{to}:{team_id}:{limit}"
    cache_key = f"fixtures:{cache_params}"
    
    # Try to get from cache
    cached_fixtures = await cache.get(cache_key)
    
    if cached_fixtures:
        fixtures = cached_fixtures
        logger.info(f"Returning {len(fixtures)} cached fixtures")
    else:
        try:
            logger.info(f"Fetching fixtures from database with: league={league}, season={season}, status={status_enum}, from_date={from_datetime}, to_date={to_datetime}, team_id={team_id}, limit={limit}")
            
            # Call get_fixtures with the correct parameter names and add limit
            fixtures = await get_fixtures(
                db,
                league=league,
                season=season,
                status=status_enum,
                from_date=from_datetime,  # Repository expects from_date
                to_date=to_datetime,      # Repository expects to_date
                team_id=team_id,
                limit=limit               # Add the missing limit parameter
            )
            
            logger.info(f"Retrieved {len(fixtures)} fixtures from database")
            
            # Convert SQLAlchemy objects to dictionaries for serialization
            fixtures_dict = []
            for fixture in fixtures:
                fixture_dict = {
                    "fixture_id": fixture.fixture_id,
                    "home_team": fixture.home_team,
                    "away_team": fixture.away_team,
                    "home_team_logo": fixture.home_team_logo,
                    "away_team_logo": fixture.away_team_logo,
                    "date": fixture.date.isoformat() if fixture.date else None,
                    "league": fixture.league,
                    "season": fixture.season,
                    "round": fixture.round,
                    "status": fixture.status.value if fixture.status else None,
                    "home_score": fixture.home_score,
                    "away_score": fixture.away_score,
                    "venue": fixture.venue,
                    "venue_city": getattr(fixture, 'venue_city', None),
                    "referee": getattr(fixture, 'referee', None)
                }
                fixtures_dict.append(fixture_dict)
            
            fixtures = fixtures_dict
            
            # Cache for 5 minutes
            await cache.set(cache_key, fixtures, 300)
        except Exception as e:
            logger.error(f"Error fetching fixtures: {str(e)}")
            logger.exception("Full traceback:")
            
            # Return empty result instead of raising 500 error
            return ListResponse(
                data=[],
                total=0,
                message="No fixtures available at the moment"
            )
    
    return ListResponse(
        data=fixtures,
        total=len(fixtures)
    )

@router.get("/statuses", response_model=DataResponse)
async def get_match_statuses(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all possible match statuses
    """
    statuses = [status.value for status in MatchStatus]
    
    return DataResponse(
        data=statuses
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