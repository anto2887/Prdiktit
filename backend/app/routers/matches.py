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
    Get currently live matches for user's tracked teams
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Try to get from cache first (short TTL for live matches)
        cache_key = f"live_matches:{current_user.id}"
        cached_matches = await cache.get(cache_key)
        
        if cached_matches:
            matches = cached_matches
        else:
            # Get user's groups and tracked teams
            from ..db.repository import get_user_groups as get_user_groups_from_db
            user_groups = await get_user_groups_from_db(db, current_user.id)
            
            if not user_groups:
                logger.warning(f"User {current_user.id} belongs to no groups, returning empty live matches")
                return ListResponse(data=[], total=0)
            
            # Collect all tracked teams from user's groups
            all_tracked_teams = set()
            for group in user_groups:
                group_tracked_teams = await get_group_tracked_teams(db, group.id)
                all_tracked_teams.update(group_tracked_teams)
            
            tracked_team_ids = list(all_tracked_teams)
            logger.info(f"User {current_user.id} has tracked teams: {tracked_team_ids}")
            
            # Get all live matches
            raw_matches = await get_live_matches(db)
            logger.info(f"Found {len(raw_matches)} live matches before team filtering")
            
            # ADDED: Filter by tracked teams
            if tracked_team_ids:
                # Get team names for the tracked team IDs
                from ..db.models import Team
                tracked_teams = db.query(Team).filter(Team.id.in_(tracked_team_ids)).all()
                tracked_team_names = [team.team_name for team in tracked_teams]
                logger.info(f"Tracked team names: {tracked_team_names}")
                
                # Filter matches to only include those involving tracked teams
                team_filtered_matches = [
                    match for match in raw_matches
                    if match.home_team in tracked_team_names or match.away_team in tracked_team_names
                ]
                
                logger.info(f"After team filtering: {len(team_filtered_matches)} live matches involving tracked teams")
            else:
                # If no tracked teams, show all matches (fallback)
                team_filtered_matches = raw_matches
                logger.warning(f"No tracked teams found for user {current_user.id}, showing all live matches")
            
            # Serialize live matches to prevent SQLAlchemy object serialization errors
            from ..utils.serializers import serialize_fixtures_list
            matches = serialize_fixtures_list(team_filtered_matches)
            # Cache for 1 minute
            await cache.set(cache_key, matches, 60)
        
        return ListResponse(
            data=matches,
            total=len(matches)
        )
        
    except Exception as e:
        logger.error(f"Error fetching live matches: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to fetch live matches")

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
    status: Optional[str] = Query(None, description="Filter by match status (e.g., NOT_STARTED, FINISHED)"),
    from_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=100, description="Number of fixtures to return"),
    offset: int = Query(0, ge=0, description="Number of fixtures to skip")
):
    """Get fixtures with optional filtering"""
    import logging
    from datetime import datetime
    logger = logging.getLogger(__name__)
    
    try:
        # Get user's groups and their leagues
        from ..db.repository import get_user_groups as get_user_groups_from_db, get_fixtures as get_fixtures_from_repo
        
        user_groups = await get_user_groups_from_db(db, current_user.id)
        
        if not user_groups:
            logger.warning(f"User {current_user.id} belongs to no groups, returning empty fixtures")
            return DataResponse(data=[], message="No groups found for user")
        
        # Collect all leagues from user's groups
        user_leagues = [group.league for group in user_groups if group.league]
        logger.info(f"User {current_user.id} belongs to leagues: {user_leagues}")
        
        # ADDED: Collect all tracked teams from user's groups
        all_tracked_teams = set()
        for group in user_groups:
            group_tracked_teams = await get_group_tracked_teams(db, group.id)
            all_tracked_teams.update(group_tracked_teams)
        
        tracked_team_ids = list(all_tracked_teams)
        logger.info(f"User {current_user.id} has tracked teams: {tracked_team_ids}")
        
        # Parse date strings to datetime objects if provided
        parsed_from_date = None
        parsed_to_date = None
        
        if from_date:
            try:
                parsed_from_date = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
                logger.info(f"Parsed from_date: {parsed_from_date}")
            except ValueError as e:
                logger.warning(f"Invalid from_date format: {from_date}, error: {e}")
        
        if to_date:
            try:
                parsed_to_date = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
                logger.info(f"Parsed to_date: {parsed_to_date}")
            except ValueError as e:
                logger.warning(f"Invalid to_date format: {to_date}, error: {e}")
        
        # Log the filters being applied
        logger.info(f"Applying filters - league: {league}, season: {season}, status: {status}, from: {parsed_from_date}, to: {parsed_to_date}")
        
        # FIXED: Use repository function instead of manual query building
        # This ensures all filtering logic works correctly and avoids code duplication
        all_fixtures = await get_fixtures_from_repo(
            db=db,
            league=league,  # Will be None if not specified, repository handles user league filtering
            season=season,
            status=status,  # Repository handles MatchStatus enum conversion
            from_date=parsed_from_date,
            to_date=parsed_to_date,
            limit=limit + offset  # Get more to handle pagination after league filtering
        )
        
        # Filter by user's leagues (since repository doesn't handle user-specific league filtering)
        user_league_fixtures = [
            fixture for fixture in all_fixtures 
            if fixture.league in user_leagues
        ]
        
        logger.info(f"Found {len(user_league_fixtures)} fixtures matching user's leagues")
        
        # ADDED: Filter by tracked teams - only show matches involving user's tracked teams
        if tracked_team_ids:
            # Get team names for the tracked team IDs
            from ..db.models import Team
            tracked_teams = db.query(Team).filter(Team.id.in_(tracked_team_ids)).all()
            tracked_team_names = [team.team_name for team in tracked_teams]
            logger.info(f"Tracked team names: {tracked_team_names}")
            
            # Filter fixtures to only include matches involving tracked teams
            team_filtered_fixtures = [
                fixture for fixture in user_league_fixtures
                if fixture.home_team in tracked_team_names or fixture.away_team in tracked_team_names
            ]
            
            logger.info(f"After team filtering: {len(team_filtered_fixtures)} fixtures involving tracked teams")
        else:
            # If no tracked teams, show all league fixtures (fallback)
            team_filtered_fixtures = user_league_fixtures
            logger.warning(f"No tracked teams found for user {current_user.id}, showing all league fixtures")
        
        # Apply pagination to filtered results
        total = len(team_filtered_fixtures)
        paginated_fixtures = team_filtered_fixtures[offset:offset + limit]
        
        # Serialize fixtures to prevent SQLAlchemy object serialization errors
        from ..utils.serializers import serialize_fixtures_list
        serialized_fixtures = serialize_fixtures_list(paginated_fixtures)
        
        logger.info(f"Returning {len(serialized_fixtures)} fixtures to user {current_user.id}")
        
        return DataResponse(
            data=serialized_fixtures,
            total=total,
            limit=limit,
            offset=offset
        )
        
    except Exception as e:
        logger.error(f"Error fetching fixtures: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
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
    Get upcoming matches for user's tracked teams
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
            # Get user's groups and tracked teams
            from ..db.repository import get_user_groups as get_user_groups_from_db
            user_groups = await get_user_groups_from_db(db, current_user.id)
            
            if not user_groups:
                logger.warning(f"User {current_user.id} belongs to no groups, returning empty matches")
                return DataResponse(data=[], message="No groups found for user")
            
            # Collect all tracked teams from user's groups
            all_tracked_teams = set()
            for group in user_groups:
                group_tracked_teams = await get_group_tracked_teams(db, group.id)
                all_tracked_teams.update(group_tracked_teams)
            
            tracked_team_ids = list(all_tracked_teams)
            logger.info(f"User {current_user.id} has tracked teams: {tracked_team_ids}")
            
            now = datetime.now(timezone.utc)
            next_week = now + timedelta(days=7)
            
            logger.info(f"Fetching upcoming matches from {now} to {next_week}")
            
            raw_matches = await get_fixtures(
                db,
                status=MatchStatus.NOT_STARTED,
                from_date=now,
                to_date=next_week
            )
            
            logger.info(f"Found {len(raw_matches)} upcoming matches before team filtering")
            
            # ADDED: Filter by tracked teams
            if tracked_team_ids:
                # Get team names for the tracked team IDs
                from ..db.models import Team
                tracked_teams = db.query(Team).filter(Team.id.in_(tracked_team_ids)).all()
                tracked_team_names = [team.team_name for team in tracked_teams]
                logger.info(f"Tracked team names: {tracked_team_names}")
                
                # Filter matches to only include those involving tracked teams
                team_filtered_matches = [
                    match for match in raw_matches
                    if match.home_team in tracked_team_names or match.away_team in tracked_team_names
                ]
                
                logger.info(f"After team filtering: {len(team_filtered_matches)} matches involving tracked teams")
            else:
                # If no tracked teams, show all matches (fallback)
                team_filtered_matches = raw_matches
                logger.warning(f"No tracked teams found for user {current_user.id}, showing all matches")
            
            # Serialize matches before caching to prevent SQLAlchemy object caching
            from ..utils.serializers import serialize_fixtures_list
            matches = serialize_fixtures_list(team_filtered_matches)
            
            # Cache for 10 minutes
            await cache.set(cache_key, matches, 600)
        
        formatted_matches = []
        for m in matches:
            # Handle both raw objects (from cache miss) and dicts (from cache hit)
            if isinstance(m, dict):
                formatted_matches.append({
                    "id": m["fixture_id"],
                    "homeTeam": {
                        "name": m["home_team"],
                        "logo": m["home_team_logo"]
                    },
                    "awayTeam": {
                        "name": m["away_team"],
                        "logo": m["away_team_logo"]
                    },
                    "kickoff": m["date"],
                    "status": m["status"],
                    "venue": m.get("venue", ""),
                    "round": m.get("round", "")
                })
            else:
                # Raw object handling (shouldn't happen with serialization, but safety fallback)
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
                    "kickoff": m.date.isoformat() if m.date else None,
                    "status": m.status.value if hasattr(m.status, 'value') else str(m.status),
                    "venue": m.venue or "",
                    "round": m.round or ""
                })
        
        return DataResponse(
            data=formatted_matches,
            message="Upcoming matches retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Error fetching upcoming matches: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to fetch upcoming matches")

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
        raw_match = await get_fixture_by_id(db, match_id)
        
        if not raw_match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Match not found"
            )
        
        # Serialize match before caching to prevent SQLAlchemy object caching
        from ..utils.serializers import fixture_to_dict
        match = fixture_to_dict(raw_match)
            
        # Cache completed matches longer than upcoming ones
        if raw_match.status in [MatchStatus.FINISHED, MatchStatus.FINISHED_AET, MatchStatus.FINISHED_PEN]:
            # Cache for 24 hours
            await cache.set(cache_key, match, 86400)
        else:
            # Cache for 5 minutes
            await cache.set(cache_key, match, 300)
    
    # Get prediction deadlines
    deadlines = await get_prediction_deadlines(db)
    
    # Add prediction deadline to match data
    # Handle both cached dict and raw object
    if isinstance(match, dict):
        match_data = match.copy()
        match_data["prediction_deadline"] = deadlines.get(str(match["fixture_id"]))
    else:
        # Fallback for raw objects (shouldn't happen with our fix)
        match_data = {
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