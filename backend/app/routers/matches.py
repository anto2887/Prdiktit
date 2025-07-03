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
    Fixture,
    MatchStatus,
    ListResponse,
    DataResponse
)
from ..db.models import Team

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

# Add this debug endpoint to your matches router first to understand what's happening
@router.get("/debug-user-access", response_model=DataResponse)
async def debug_user_access(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Debug endpoint to check user's group access and tracked teams
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Debug: Checking access for user {current_user.id}")
        
        # Import the function we need
        from ..db.repository import get_user_groups as get_user_groups_from_db
        
        # Get user's groups
        user_groups = await get_user_groups_from_db(db, current_user.id)
        logger.info(f"Debug: User {current_user.id} belongs to {len(user_groups)} groups")
        
        debug_info = {
            "user_id": current_user.id,
            "groups_count": len(user_groups),
            "groups": [],
            "all_leagues": set(),
            "all_tracked_teams": set(),
            "fixture_counts": {}
        }
        
        # Process each group
        for group in user_groups:
            group_info = {
                "id": group.id,
                "name": group.name,
                "league": group.league,
                "admin_id": group.admin_id
            }
            
            # Get tracked teams for this group
            tracked_teams = await get_group_tracked_teams(db, group.id)
            group_info["tracked_teams_count"] = len(tracked_teams)
            group_info["tracked_team_ids"] = list(tracked_teams)
            
            # Get team names
            if tracked_teams:
                tracked_team_objects = db.query(Team).filter(Team.id.in_(tracked_teams)).all()
                group_info["tracked_team_names"] = [team.team_name for team in tracked_team_objects]
            else:
                group_info["tracked_team_names"] = []
            
            debug_info["groups"].append(group_info)
            debug_info["all_leagues"].add(group.league)
            debug_info["all_tracked_teams"].update(tracked_teams)
        
        # Convert sets to lists for JSON serialization
        debug_info["all_leagues"] = list(debug_info["all_leagues"])
        debug_info["all_tracked_teams"] = list(debug_info["all_tracked_teams"])
        
        # Check fixture counts for each league
        for league in debug_info["all_leagues"]:
            total_fixtures = db.query(Fixture).filter(Fixture.league == league).count()
            upcoming_fixtures = db.query(Fixture).filter(
                Fixture.league == league,
                Fixture.status == MatchStatus.NOT_STARTED,
                Fixture.date >= datetime.now(timezone.utc)
            ).count()
            
            debug_info["fixture_counts"][league] = {
                "total": total_fixtures,
                "upcoming": upcoming_fixtures
            }
        
        # Check if there are any fixtures for tracked teams
        if debug_info["all_tracked_teams"]:
            tracked_team_objects = db.query(Team).filter(Team.id.in_(debug_info["all_tracked_teams"])).all()
            tracked_team_names = [team.team_name for team in tracked_team_objects]
            
            fixtures_with_tracked_teams = db.query(Fixture).filter(
                or_(
                    Fixture.home_team.in_(tracked_team_names),
                    Fixture.away_team.in_(tracked_team_names)
                )
            ).count()
            
            debug_info["fixtures_with_tracked_teams"] = fixtures_with_tracked_teams
            debug_info["tracked_team_names_all"] = tracked_team_names
        
        return DataResponse(data=debug_info)
        
    except Exception as e:
        logger.error(f"Debug error: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return DataResponse(
            data={"error": str(e), "traceback": traceback.format_exc()}
        )

# Now here's a simplified fixtures endpoint that we can debug step by step
@router.get("/fixtures", response_model=ListResponse)
async def get_fixtures_endpoint(
    league: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_: Optional[str] = Query(None, alias="from"),    
    to: Optional[str] = Query(None),                       
    team_id: Optional[int] = Query(None),
    limit: Optional[int] = Query(100),                    
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get fixtures with filters - DEBUG VERSION
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Fixtures endpoint called with: league={league}, season={season}, status={status}, from_={from_}, to={to}, team_id={team_id}")
    
    # Convert date strings to datetime if provided
    from_datetime = None
    to_datetime = None
    
    if from_:
        try:
            if 'T' in from_:
                from_ = from_.replace('Z', '+00:00') if 'Z' in from_ else from_
                from_datetime = datetime.fromisoformat(from_)
            else:
                from_datetime = datetime.strptime(from_, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception as e:
            logger.warning(f"Invalid from_ format: {from_}. Error: {str(e)}")
            from_datetime = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    if to:
        try:
            if 'T' in to:
                to = to.replace('Z', '+00:00') if 'Z' in to else to
                to_datetime = datetime.fromisoformat(to)
            else:
                to_datetime = datetime.strptime(to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except Exception as e:
            logger.warning(f"Invalid to format: {to}. Error: {str(e)}")
            to_datetime = (datetime.now(timezone.utc) + timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=0)
    
    # Convert status string to enum if provided
    status_enum = None
    if status:
        try:
            status_enum = MatchStatus(status)
        except (ValueError, TypeError):
            logger.warning(f"Invalid status provided: {status}")
            pass
    
    try:
        # STEP 1: Check if user has groups
        from ..db.repository import get_user_groups as get_user_groups_from_db
        
        user_groups = await get_user_groups_from_db(db, current_user.id)
        logger.info(f"STEP 1: User {current_user.id} belongs to {len(user_groups)} groups")
        
        if not user_groups:
            logger.info("STEP 1: User belongs to no groups, returning empty fixtures")
            return ListResponse(
                data=[],
                total=0,
                message="Join a group to see fixtures"
            )
        
        # STEP 2: Get leagues and tracked teams
        user_leagues = set()
        all_tracked_teams = set()
        
        for group in user_groups:
            user_leagues.add(group.league)
            tracked_teams = await get_group_tracked_teams(db, group.id)
            all_tracked_teams.update(tracked_teams)
            logger.info(f"STEP 2: Group {group.name} - League: {group.league}, Tracked teams: {len(tracked_teams)}")
        
        logger.info(f"STEP 2: Total leagues: {user_leagues}, Total tracked teams: {len(all_tracked_teams)}")
        
        # STEP 3: Build basic query without team filtering first
        query = db.query(Fixture)
        
        # Filter by leagues
        if league:
            if league not in user_leagues:
                logger.warning(f"STEP 3: User requested league {league} but only has access to {user_leagues}")
                return ListResponse(data=[], total=0, message=f"You don't have access to {league} fixtures")
            query = query.filter(Fixture.league == league)
        else:
            query = query.filter(Fixture.league.in_(user_leagues))
        
        # Apply other filters
        if season:
            query = query.filter(Fixture.season == season)
        if status_enum:
            query = query.filter(Fixture.status == status_enum)
        if from_datetime:
            query = query.filter(Fixture.date >= from_datetime)
        if to_datetime:
            query = query.filter(Fixture.date <= to_datetime)
        if team_id:
            team = db.query(Team).filter(Team.id == team_id).first()
            if team:
                query = query.filter(
                    or_(
                        Fixture.home_team == team.team_name,
                        Fixture.away_team == team.team_name
                    )
                )
        
        # STEP 4: Get count before team filtering
        fixtures_before_team_filter = query.count()
        logger.info(f"STEP 4: Fixtures before team filtering: {fixtures_before_team_filter}")
        
        # STEP 5: Apply team filtering only if teams are tracked
        if all_tracked_teams:
            tracked_team_objects = db.query(Team).filter(Team.id.in_(all_tracked_teams)).all()
            tracked_team_names = [team.team_name for team in tracked_team_objects]
            logger.info(f"STEP 5: Applying team filter for: {tracked_team_names}")
            
            query = query.filter(
                or_(
                    Fixture.home_team.in_(tracked_team_names),
                    Fixture.away_team.in_(tracked_team_names)
                )
            )
        else:
            logger.info("STEP 5: No teams tracked, showing all fixtures in user's leagues")
        
        # STEP 6: Get final results
        fixtures = query.order_by(Fixture.date).limit(limit).all()
        logger.info(f"STEP 6: Final fixtures count: {len(fixtures)}")
        
        # Convert to dictionaries
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
        
        return ListResponse(
            data=fixtures_dict,
            total=len(fixtures_dict)
        )
        
    except Exception as e:
        logger.error(f"Error fetching fixtures: {str(e)}")
        logger.exception("Full traceback:")
        
        return ListResponse(
            data=[],
            total=0,
            message=f"Error: {str(e)}"
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