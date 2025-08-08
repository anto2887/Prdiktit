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
    from ..db.database import SessionLocal
    from ..db.models import Team
    
    db = SessionLocal()
    try:
        # Check if we already have teams in the database
        team_count = db.query(Team).count()
        
        if team_count == 0:
            logger.info("No teams found in database. Importing from API...")
            
            # Import teams using your existing script logic
            leagues = {
                "Premier League": {"id": 39, "season": 2025},
                "La Liga": {"id": 140, "season": 2025},
                "UEFA Champions League": {"id": 2, "season": 2025},
                "MLS": {"id": 253, "season": 2025},
                "FIFA Club World Cup": {"id": 15, "season": 2025}
            }
            
            for league_name, league_config in leagues.items():
                logger.info(f"Importing teams for {league_name} (ID: {league_config['id']})")
                params = {
                    'league': league_config['id'],
                    'season': league_config['season']  # Use configured season
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
                            league_id=league_config['id']
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

async def import_fixtures_on_startup(app: FastAPI) -> None:
    """Import fixtures from API if not already in database"""
    from sqlalchemy.orm import Session
    from ..db.database import SessionLocal
    from ..db.models import Fixture, MatchStatus
    from datetime import datetime, timezone, timedelta
    
    db = SessionLocal()
    try:
        # Check if we already have fixtures in the database
        fixture_count = db.query(Fixture).count()
        
        if fixture_count == 0:
            logger.info("No fixtures found in database. Importing from API...")
            
            # Date range: 30 days back, 60 days forward
            today = datetime.now(timezone.utc)
            from_date = today - timedelta(days=30)
            to_date = today + timedelta(days=60)
            
            logger.info(f"Importing fixtures from {from_date.date()} to {to_date.date()}")
            
            # Import fixtures for configured leagues
            leagues = {
                "Premier League": {"id": 39, "season": 2025},
                "La Liga": {"id": 140, "season": 2025},
                "UEFA Champions League": {"id": 2, "season": 2025},
                "MLS": {"id": 253, "season": 2025},
                "FIFA Club World Cup": {"id": 15, "season": 2025}
            }
            
            total_imported = 0
            
            for league_name, league_config in leagues.items():
                logger.info(f"Importing fixtures for {league_name}")
                
                # Get fixtures from API
                fixtures_data = await football_api_service.make_api_request('fixtures', {
                    'league': league_config['id'],
                    'season': league_config['season'],
                    'from': from_date.strftime('%Y-%m-%d'),
                    'to': to_date.strftime('%Y-%m-%d')
                })
                
                if not fixtures_data:
                    logger.warning(f"No fixtures data for {league_name}")
                    continue
                
                count = 0
                for fixture_data in fixtures_data:
                    try:
                        fixture_id = fixture_data['fixture']['id']
                        
                        # Check if fixture exists
                        existing = db.query(Fixture).filter(Fixture.fixture_id == fixture_id).first()
                        
                        if existing:
                            logger.debug(f"Fixture {fixture_id} already exists, skipping")
                            continue
                        
                        # Parse date
                        date_str = fixture_data['fixture']['date']
                        if date_str.endswith('Z'):
                            date_str = date_str[:-1] + '+00:00'
                        fixture_datetime = datetime.fromisoformat(date_str)
                        
                        # Map status
                        api_status = fixture_data['fixture']['status']['short']
                        status_map = {
                            'TBD': MatchStatus.NOT_STARTED, 'NS': MatchStatus.NOT_STARTED,
                            '1H': MatchStatus.FIRST_HALF, 'HT': MatchStatus.HALFTIME,
                            '2H': MatchStatus.SECOND_HALF, 'ET': MatchStatus.EXTRA_TIME,
                            'P': MatchStatus.PENALTY, 'FT': MatchStatus.FINISHED,
                            'AET': MatchStatus.FINISHED_AET, 'PEN': MatchStatus.FINISHED_PEN,
                            'LIVE': MatchStatus.LIVE, 'PST': MatchStatus.POSTPONED,
                            'CANC': MatchStatus.CANCELLED
                        }
                        status = status_map.get(api_status, MatchStatus.NOT_STARTED)
                        
                        # Get scores
                        goals = fixture_data.get('goals', {})
                        home_score = goals.get('home') or 0
                        away_score = goals.get('away') or 0
                        
                        # CREATE new fixture
                        fixture = Fixture(
                            fixture_id=fixture_id,
                            home_team=fixture_data['teams']['home']['name'],
                            away_team=fixture_data['teams']['away']['name'],
                            home_team_logo=fixture_data['teams']['home'].get('logo'),
                            away_team_logo=fixture_data['teams']['away'].get('logo'),
                            date=fixture_datetime,
                            league=league_name,
                            season=str(league_config['season']),
                            round=fixture_data['league'].get('round', 'Round 1'),
                            status=status,
                            home_score=home_score,
                            away_score=away_score,
                            venue=fixture_data['fixture']['venue'].get('name') if fixture_data['fixture'].get('venue') else None,
                            venue_city=fixture_data['fixture']['venue'].get('city') if fixture_data['fixture'].get('venue') else None,
                            competition_id=league_config['id'],
                            match_timestamp=fixture_datetime,
                            last_updated=datetime.now(timezone.utc)
                        )
                        
                        db.add(fixture)
                        count += 1
                        
                    except Exception as e:
                        logger.error(f"Error processing fixture {fixture_data.get('fixture', {}).get('id', 'unknown')}: {e}")
                        continue
                
                db.commit()
                total_imported += count
                logger.info(f"Imported {count} fixtures for {league_name}")
                
        else:
            logger.info(f"Found {fixture_count} fixtures in database, skipping import")
            
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