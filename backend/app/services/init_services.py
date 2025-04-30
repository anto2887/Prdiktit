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
    from sqlalchemy.orm import Session
    from ..db.session import SessionLocal
    from ..db.models import Team
    
    db = SessionLocal()
    try:
        # Check if we already have teams in the database
        team_count = db.query(Team).count()
        
        if team_count == 0:
            logger.info("No teams found in database. Importing from API...")
            
            # Import teams using your existing script logic
            leagues = {
                "Premier League": 39,
                "La Liga": 140, 
                "UEFA Champions League": 2
            }
            
            for league_name, league_id in leagues.items():
                logger.info(f"Importing teams for {league_name} (ID: {league_id})")
                params = {
                    'league': league_id,
                    'season': 2024  # Current season
                }
                
                # Make the API request
                teams_data = await football_api_service.make_api_request('teams', params)
                
                if teams_data:
                    logger.info(f"Found {len(teams_data)} teams for {league_name}")
                    count = 0
                    for team_data in teams_data:
                        # Check if team already exists
                        existing_team = db.query(Team).filter(Team.team_id == team_data['team']['id']).first()
                        if existing_team:
                            logger.info(f"Team {team_data['team']['name']} already exists, skipping")
                            continue
                            
                        # Create new team
                        team = Team(
                            team_id=team_data['team']['id'],
                            team_name=team_data['team']['name'],
                            team_logo=team_data['team']['logo'],
                            country=team_data['team']['country'],
                            league_id=league_id
                        )
                        db.add(team)
                        count += 1
                    
                    db.commit()
                    logger.info(f"Added {count} teams for {league_name}")
                else:
                    logger.warning(f"No teams found for {league_name}")
        else:
            logger.info(f"Found {team_count} teams in database, skipping import")
    except Exception as e:
        logger.error(f"Error importing teams: {e}")
        db.rollback()
    finally:
        db.close()

async def init_services(app: FastAPI) -> None:
    """
    Initialize all application services
    """
    logger.info("Initializing application services...")
    
    # Setup Redis cache
    await setup_redis_cache()
    logger.info("Redis cache initialized")
    
    # Initialize football API service
    if not settings.FOOTBALL_API_KEY:
        logger.warning("FOOTBALL_API_KEY not set. Football API service will not work properly.")
    else:
        logger.info("Football API service initialized")
    
    # Import teams at startup
    await import_teams_on_startup(app)
    
    # Add any other service initializations here
    
    logger.info("All services initialized successfully")

async def shutdown_services() -> None:
    """
    Shutdown all application services
    """
    logger.info("Shutting down application services...")
    
    # Add cleanup code for services here
    
    logger.info("All services shut down successfully")