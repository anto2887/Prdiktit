import logging
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware

from ..core.config import settings
from .cache_service import setup_redis_cache
from .football_api import football_api_service
from ..middleware.rate_limiter import RateLimitMiddleware

logger = logging.getLogger(__name__)

async def import_teams_on_startup(app: FastAPI) -> None:
    """Import teams from API if not already in database"""
    from ..db.database import SessionLocal
    from ..db.models import Team
    
    db = SessionLocal()
    try:
        # Import per API league_id when that competition has no tagged rows yet.
        # (Previously: only ran when the entire teams table was empty, so World Cup
        # never imported after any other league was loaded.)
        leagues = {
            "Premier League": {"id": 39, "season": 2025},
            "La Liga": {"id": 140, "season": 2025},
            "UEFA Champions League": {"id": 2, "season": 2025},
            "World Cup": {"id": 1, "season": 2026},
            "MLS": {"id": 253, "season": 2025},
            "FIFA Club World Cup": {"id": 15, "season": 2025},
        }

        for league_name, league_config in leagues.items():
            api_league_id = league_config["id"]
            already = db.query(Team).filter(Team.league_id == api_league_id).count()
            if already > 0:
                logger.info(
                    "Skipping team import for %s: already have %s team(s) with league_id=%s",
                    league_name,
                    already,
                    api_league_id,
                )
                continue

            logger.info(
                "Importing teams for %s (API league_id=%s, season=%s)",
                league_name,
                api_league_id,
                league_config["season"],
            )
            params = {
                "league": api_league_id,
                "season": league_config["season"],
            }

            teams_data = await football_api_service.make_api_request("teams", params)

            if teams_data:
                logger.info("Found %s teams for %s", len(teams_data), league_name)
                count = 0
                for team_data in teams_data:
                    existing_team = (
                        db.query(Team)
                        .filter(Team.team_id == team_data["team"]["id"])
                        .first()
                    )
                    if existing_team:
                        logger.info(
                            "Team %s already exists, skipping",
                            team_data["team"]["name"],
                        )
                        continue

                    team = Team(
                        team_id=team_data["team"]["id"],
                        team_name=team_data["team"]["name"],
                        team_logo=team_data["team"]["logo"],
                        country=team_data["team"]["country"],
                        league_id=api_league_id,
                    )
                    db.add(team)
                    count += 1

                db.commit()
                logger.info("Added %s teams for %s", count, league_name)
            else:
                logger.warning("No teams returned from API for %s", league_name)
    except Exception as e:
        logger.error(f"Error importing teams: {e}")
        db.rollback()
    finally:
        db.close()

async def import_fixtures_on_startup(app: FastAPI) -> None:
    """Import fixtures from API if not already in database"""
    from ..db.database import SessionLocal
    from ..db.models import Fixture, MatchStatus
    from datetime import datetime, timezone, timedelta
    
    db = SessionLocal()
    try:
        # Import per competition_id + season when that slice has no rows yet (same idea as team import).
        today = datetime.now(timezone.utc)
        from_date = today - timedelta(days=30)
        to_date = today + timedelta(days=60)

        leagues = {
            "Premier League": {"id": 39, "season": 2025},
            "La Liga": {"id": 140, "season": 2025},
            "UEFA Champions League": {"id": 2, "season": 2025},
            "World Cup": {"id": 1, "season": 2026},
            "MLS": {"id": 253, "season": 2025},
            "FIFA Club World Cup": {"id": 15, "season": 2025},
        }

        total_imported = 0

        for league_name, league_config in leagues.items():
            season_str = str(league_config["season"])
            api_id = league_config["id"]
            existing = (
                db.query(Fixture)
                .filter(
                    Fixture.competition_id == api_id,
                    Fixture.season == season_str,
                )
                .count()
            )
            if existing > 0:
                logger.info(
                    "Skipping fixture import for %s: already have %s fixture(s) "
                    "(competition_id=%s, season=%s)",
                    league_name,
                    existing,
                    api_id,
                    season_str,
                )
                continue

            if league_name == "World Cup":
                range_from = today - timedelta(days=120)
                range_to = today + timedelta(days=500)
            else:
                range_from, range_to = from_date, to_date

            logger.info(
                "Importing fixtures for %s from %s to %s (competition_id=%s, season=%s)",
                league_name,
                range_from.date(),
                range_to.date(),
                api_id,
                season_str,
            )
            fixtures_data = await football_api_service.make_api_request(
                "fixtures",
                {
                    "league": league_config["id"],
                    "season": league_config["season"],
                    "from": range_from.strftime("%Y-%m-%d"),
                    "to": range_to.strftime("%Y-%m-%d"),
                },
            )
            if not fixtures_data:
                logger.warning("No fixtures data for %s", league_name)
                continue

            count = 0
            for fixture_data in fixtures_data:
                try:
                    fixture_id = fixture_data["fixture"]["id"]

                    existing_fx = (
                        db.query(Fixture)
                        .filter(Fixture.fixture_id == fixture_id)
                        .first()
                    )

                    if existing_fx:
                        logger.debug("Fixture %s already exists, skipping", fixture_id)
                        continue

                    date_str = fixture_data["fixture"]["date"]
                    if date_str.endswith("Z"):
                        date_str = date_str[:-1] + "+00:00"
                    fixture_datetime = datetime.fromisoformat(date_str)

                    api_status = fixture_data["fixture"]["status"]["short"]
                    status_map = {
                        "TBD": MatchStatus.NOT_STARTED,
                        "NS": MatchStatus.NOT_STARTED,
                        "1H": MatchStatus.FIRST_HALF,
                        "HT": MatchStatus.HALFTIME,
                        "2H": MatchStatus.SECOND_HALF,
                        "ET": MatchStatus.EXTRA_TIME,
                        "P": MatchStatus.PENALTY,
                        "FT": MatchStatus.FINISHED,
                        "AET": MatchStatus.FINISHED_AET,
                        "PEN": MatchStatus.FINISHED_PEN,
                        "LIVE": MatchStatus.LIVE,
                        "PST": MatchStatus.POSTPONED,
                        "CANC": MatchStatus.CANCELLED,
                    }
                    status = status_map.get(api_status, MatchStatus.NOT_STARTED)

                    goals = fixture_data.get("goals", {})
                    home_score = goals.get("home") or 0
                    away_score = goals.get("away") or 0

                    fixture = Fixture(
                        fixture_id=fixture_id,
                        home_team=fixture_data["teams"]["home"]["name"],
                        away_team=fixture_data["teams"]["away"]["name"],
                        home_team_logo=fixture_data["teams"]["home"].get("logo"),
                        away_team_logo=fixture_data["teams"]["away"].get("logo"),
                        date=fixture_datetime,
                        league=league_name,
                        season=str(league_config["season"]),
                        round=fixture_data["league"].get("round", "Round 1"),
                        status=status,
                        home_score=home_score,
                        away_score=away_score,
                        venue=(
                            fixture_data["fixture"]["venue"].get("name")
                            if fixture_data["fixture"].get("venue")
                            else None
                        ),
                        venue_city=(
                            fixture_data["fixture"]["venue"].get("city")
                            if fixture_data["fixture"].get("venue")
                            else None
                        ),
                        competition_id=league_config["id"],
                        league_id=league_config["id"],
                        match_timestamp=fixture_datetime,
                        last_updated=datetime.now(timezone.utc),
                    )

                    db.add(fixture)
                    count += 1

                except Exception as e:
                    logger.error(
                        "Error processing fixture %s: %s",
                        fixture_data.get("fixture", {}).get("id", "unknown"),
                        e,
                    )
                    continue

            db.commit()
            total_imported += count
            logger.info("Imported %s fixtures for %s", count, league_name)
            
    except Exception as e:
        logger.error(f"Error importing fixtures: {e}")
        db.rollback()
    finally:
        db.close()

async def verify_admin_assignments(app: FastAPI) -> None:
    """Verify and fix admin assignments in groups"""
    from sqlalchemy.orm import Session
    from ..db.database import SessionLocal
    from ..db.models import Group, User, group_members, MemberRole
    from datetime import datetime, timezone
    
    db = SessionLocal()
    try:
        logger.info("Verifying admin assignments...")
        
        # Get all groups
        groups = db.query(Group).all()
        fixes_applied = 0
        
        for group in groups:
            # Check if admin is in group_members table
            admin_member = db.query(group_members).filter(
                group_members.c.group_id == group.id,
                group_members.c.user_id == group.admin_id
            ).first()
            
            if not admin_member:
                logger.warning(f"Admin user {group.admin_id} not in group_members for group {group.name} - fixing")
                
                # Add admin to group_members table
                stmt = group_members.insert().values(
                    user_id=group.admin_id,
                    group_id=group.id,
                    role=MemberRole.ADMIN,
                    joined_at=datetime.now(timezone.utc),
                    last_active=datetime.now(timezone.utc)
                )
                db.execute(stmt)
                fixes_applied += 1
                
            elif admin_member.role != MemberRole.ADMIN:
                logger.warning(f"Admin user {group.admin_id} has incorrect role in group {group.name} - fixing")
                
                # Update admin role
                db.execute(
                    group_members.update().
                    where(
                        group_members.c.group_id == group.id,
                        group_members.c.user_id == group.admin_id
                    ).
                    values(role=MemberRole.ADMIN)
                )
                fixes_applied += 1
        
        if fixes_applied > 0:
            db.commit()
            logger.info(f"Applied {fixes_applied} admin assignment fixes")
        else:
            logger.info("All admin assignments are correct")
            
    except Exception as e:
        logger.error(f"Error verifying admin assignments: {e}")
        db.rollback()
    finally:
        db.close()

async def init_services(app: FastAPI) -> None:
    """Initialize all application services"""
    logger.info("Initializing application services...")
    
    # Initialize Redis cache
    await setup_redis_cache()
    
    # Initialize Football API service
    logger.info("Football API service initialized")
    
    # Import teams if needed
    await import_teams_on_startup(app)
    
    # Import fixtures if needed
    await import_fixtures_on_startup(app)
    
    # Verify admin assignments
    await verify_admin_assignments(app)
    
    logger.info("All services initialized successfully")

async def shutdown_services(app=None):
    """Shutdown all application services"""
    logger.info("Shutting down application services...")
    
    # Close Football API service
    await football_api_service.close()
    
    logger.info("All services shutdown successfully")